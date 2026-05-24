import { EventEmitter } from "node:events";
import type { DatabaseState } from "../db/init.js";
import { getProjectSession, updateSessionCompletion, updateSessionRuntime, updateSessionTerminalBuffer } from "./session-repository.js";
import { resolveClaudeBinary } from "./claude-cli.js";
import { SessionPty } from "./session-pty.js";
import { createRuntimeEvent } from "./session-events.js";

export type RuntimeSessionState = {
  sessionId: string;
  projectId: string;
  pid: number | null;
  runtimeStatus: "starting" | "running" | "stopping" | "stopped" | "failed";
  cwd: string;
  resolvedWorktreePath: string | null;
  buffer: string;
  lastActivityAt: string | null;
};

type RuntimeSession = RuntimeSessionState & {
  pty: SessionPty;
  stopRequested: boolean;
  flushTimer: ReturnType<typeof setInterval>;
  lastFlushedLength: number;
};

const maxBufferLength = 200_000;
const flushIntervalMs = 10_000;
const flushThresholdBytes = 50_000;

export class SessionRuntimeManager extends EventEmitter {
  private readonly sessions = new Map<string, RuntimeSession>();

  constructor(private readonly database: DatabaseState) {
    super();
  }

  get(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  getSnapshot(sessionId: string) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    return {
      sessionId,
      buffer: session.buffer,
      runtimeStatus: session.runtimeStatus,
      cwd: session.cwd
    };
  }

  async startSession(input: {
    sessionId: string;
    projectId: string;
    cwd: string;
    resolvedWorktreePath: string | null;
    prompt: string;
    resumeSessionId?: string;
    forkSession?: boolean;
  }) {
    const command = await resolveClaudeBinary();
    const pty = new SessionPty();

    const flushToDb = () => {
      if (state.buffer.length > state.lastFlushedLength) {
        state.lastFlushedLength = state.buffer.length;
        updateSessionTerminalBuffer(this.database.db, input.projectId, input.sessionId, state.buffer);
        this.database.persist();
      }
    };

    const flushTimer = setInterval(flushToDb, flushIntervalMs);

    const state: RuntimeSession = {
      sessionId: input.sessionId,
      projectId: input.projectId,
      pid: null,
      runtimeStatus: "starting",
      cwd: input.cwd,
      resolvedWorktreePath: input.resolvedWorktreePath,
      buffer: "",
      lastActivityAt: null,
      pty,
      stopRequested: false,
      flushTimer,
      lastFlushedLength: 0
    };

    this.sessions.set(input.sessionId, state);
    this.emit("event", createRuntimeEvent({ type: "session.runtime", sessionId: input.sessionId, runtimeStatus: state.runtimeStatus, cwd: state.cwd, pid: null }));

    pty.on("output", (data: string) => {
      const nextBuffer = `${state.buffer}${data}`;
      state.buffer = nextBuffer.length > maxBufferLength ? nextBuffer.slice(-maxBufferLength) : nextBuffer;
      state.lastActivityAt = new Date().toISOString();
      state.runtimeStatus = state.stopRequested ? "stopping" : "running";
      updateSessionRuntime(this.database.db, input.projectId, input.sessionId, {
        runtimeStatus: state.runtimeStatus,
        pid: state.pid,
        lastActivityAt: state.lastActivityAt
      });
      this.database.persist();

      if (state.buffer.length - state.lastFlushedLength >= flushThresholdBytes) {
        state.lastFlushedLength = state.buffer.length;
        updateSessionTerminalBuffer(this.database.db, input.projectId, input.sessionId, state.buffer);
        this.database.persist();
      }

      this.emit("event", createRuntimeEvent({ type: "session.output", sessionId: input.sessionId, output: data, runtimeStatus: state.runtimeStatus, cwd: state.cwd, pid: state.pid }));
    });

    pty.on("exit", ({ exitCode }: { exitCode: number }) => {
      clearInterval(state.flushTimer);
      const stoppedByUser = state.stopRequested;
      const currentSession = getProjectSession(this.database.db, input.projectId, input.sessionId);
      const currentSummary = currentSession?.summary ?? null;
      state.runtimeStatus = stoppedByUser || exitCode === 0 ? "stopped" : "failed";
      state.lastActivityAt = new Date().toISOString();

      updateSessionTerminalBuffer(this.database.db, input.projectId, input.sessionId, state.buffer);

      updateSessionCompletion(this.database.db, input.projectId, input.sessionId, {
        status: stoppedByUser || exitCode === 0 ? "completed" : "failed",
        runtimeStatus: state.runtimeStatus,
        exitCode: stoppedByUser ? null : exitCode,
        lastActivityAt: state.lastActivityAt,
        summary:
          stoppedByUser || exitCode === 0 ? currentSummary : currentSummary ?? `Claude Code 退出，exit code ${exitCode}`
      });
      this.database.persist();
      this.emit(
        "event",
        createRuntimeEvent({
          type: "session.exit",
          sessionId: input.sessionId,
          runtimeStatus: state.runtimeStatus,
          cwd: state.cwd,
          pid: null,
          exitCode: stoppedByUser ? null : exitCode
        })
      );
      this.sessions.delete(input.sessionId);
    });

    const cliArgs = buildClaudeArgs(input.sessionId, input.prompt, input.resumeSessionId, input.forkSession);

    const pid = pty.start({
      command,
      args: cliArgs,
      cwd: input.cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8"
      }
    });

    state.pid = pid;
    state.runtimeStatus = "running";
    state.lastActivityAt = new Date().toISOString();
    updateSessionRuntime(this.database.db, input.projectId, input.sessionId, {
      runtimeStatus: state.runtimeStatus,
      pid: state.pid,
      lastActivityAt: state.lastActivityAt
    });
    this.database.persist();
    this.emit("event", createRuntimeEvent({ type: "session.started", sessionId: input.sessionId, runtimeStatus: state.runtimeStatus, cwd: state.cwd, pid: state.pid }));

    return {
      pid,
      runtimeStatus: state.runtimeStatus,
      cwd: state.cwd,
      lastActivityAt: state.lastActivityAt
    };
  }

  write(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.pty.write(data);
    return true;
  }

  resize(sessionId: string, cols: number, rows: number) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.pty.resize(cols, rows);
    return true;
  }

  stopSession(projectId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.stopRequested = true;
    session.runtimeStatus = "stopping";
    updateSessionRuntime(this.database.db, projectId, sessionId, {
      runtimeStatus: session.runtimeStatus,
      pid: session.pid,
      lastActivityAt: new Date().toISOString()
    });
    this.database.persist();
    this.emit("event", createRuntimeEvent({ type: "session.runtime", sessionId, runtimeStatus: session.runtimeStatus, cwd: session.cwd, pid: session.pid }));
    session.pty.stop();
    return true;
  }
}

function buildClaudeArgs(sessionId: string, prompt: string, resumeSessionId?: string, forkSession?: boolean): string[] {
  const args = ["--dangerously-skip-permissions"];

  if (resumeSessionId) {
    args.push("--resume", resumeSessionId);
    if (forkSession) {
      args.push("--fork-session");
    }
  } else {
    args.push("--session-id", sessionId);
  }

  if (prompt.trim()) {
    args.push(prompt);
  }

  return args;
}
