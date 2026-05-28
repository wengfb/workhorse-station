import { EventEmitter } from "node:events";
import type { DatabaseState } from "../db/init.js";
import { formatMysqlDateTime } from "../db/mysql.js";
import { getProjectSession, updateSessionCompletion, updateSessionRuntime, updateSessionTerminalBuffer } from "./session-repository.js";
import { resolveClaudeBinary } from "./claude-cli.js";
import { SessionPty } from "./session-pty.js";
import { createRuntimeEvent } from "./session-events.js";
import { getPtySpawnContext } from "../shell-environment.js";

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
    initialBuffer?: string;
  }) {
    const { env } = await getPtySpawnContext();
    const command = await resolveClaudeBinary(env);
    const pty = new SessionPty();

    const state: RuntimeSession = {
      sessionId: input.sessionId,
      projectId: input.projectId,
      pid: null,
      runtimeStatus: "starting",
      cwd: input.cwd,
      resolvedWorktreePath: input.resolvedWorktreePath,
      buffer: input.initialBuffer ?? "",
      lastActivityAt: null,
      pty,
      stopRequested: false,
      flushTimer: setInterval(() => {
        void flushToDb();
      }, flushIntervalMs),
      lastFlushedLength: 0
    };

    const flushToDb = async () => {
      if (state.buffer.length > state.lastFlushedLength) {
        state.lastFlushedLength = state.buffer.length;
        await updateSessionTerminalBuffer(this.database.db, input.projectId, input.sessionId, state.buffer);
        await this.database.persist();
      }
    };

    this.sessions.set(input.sessionId, state);
    this.emit("event", createRuntimeEvent({ type: "session.runtime", sessionId: input.sessionId, runtimeStatus: state.runtimeStatus, cwd: state.cwd, pid: null }));

    pty.on("output", (data: string) => {
      void (async () => {
        const nextBuffer = `${state.buffer}${data}`;
        state.buffer = nextBuffer.length > maxBufferLength ? nextBuffer.slice(-maxBufferLength) : nextBuffer;
        state.lastActivityAt = formatMysqlDateTime();
        state.runtimeStatus = state.stopRequested ? "stopping" : "running";
        await updateSessionRuntime(this.database.db, input.projectId, input.sessionId, {
          runtimeStatus: state.runtimeStatus,
          pid: state.pid,
          lastActivityAt: state.lastActivityAt
        });
        await this.database.persist();

        if (state.buffer.length - state.lastFlushedLength >= flushThresholdBytes) {
          state.lastFlushedLength = state.buffer.length;
          await updateSessionTerminalBuffer(this.database.db, input.projectId, input.sessionId, state.buffer);
          await this.database.persist();
        }

        this.emit("event", createRuntimeEvent({ type: "session.output", sessionId: input.sessionId, output: data, runtimeStatus: state.runtimeStatus, cwd: state.cwd, pid: state.pid }));
      })().catch((error) => {
        console.error("[SessionRuntime] output handler error:", error);
      });
    });

    pty.on("exit", ({ exitCode }: { exitCode: number }) => {
      void (async () => {
        clearInterval(state.flushTimer);
        const stoppedByUser = state.stopRequested;
        const currentSession = await getProjectSession(this.database.db, input.projectId, input.sessionId);
        const currentSummary = currentSession?.summary ?? null;
        state.runtimeStatus = stoppedByUser || exitCode === 0 ? "stopped" : "failed";
        state.lastActivityAt = formatMysqlDateTime();

        await updateSessionTerminalBuffer(this.database.db, input.projectId, input.sessionId, state.buffer);

        await updateSessionCompletion(this.database.db, input.projectId, input.sessionId, {
          status: stoppedByUser || exitCode === 0 ? "completed" : "failed",
          runtimeStatus: state.runtimeStatus,
          exitCode: stoppedByUser ? null : exitCode,
          lastActivityAt: state.lastActivityAt,
          summary:
            stoppedByUser || exitCode === 0 ? currentSummary : currentSummary ?? `Claude Code 退出，exit code ${exitCode}`
        });
        await this.database.persist();
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
      })().catch((error) => {
        console.error("[SessionRuntime] exit handler error:", error);
      });
    });

    const cliArgs = buildClaudeArgs(input.sessionId, input.prompt, input.resumeSessionId, input.forkSession);

    const pid = pty.start({
      command,
      args: cliArgs,
      cwd: input.cwd,
      env
    });

    state.pid = pid;
    state.runtimeStatus = "running";
    state.lastActivityAt = formatMysqlDateTime();
    await updateSessionRuntime(this.database.db, input.projectId, input.sessionId, {
      runtimeStatus: state.runtimeStatus,
      pid: state.pid,
      lastActivityAt: state.lastActivityAt
    });
    await this.database.persist();
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

  async stopSession(projectId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.stopRequested = true;
    session.runtimeStatus = "stopping";
    await updateSessionRuntime(this.database.db, projectId, sessionId, {
      runtimeStatus: session.runtimeStatus,
      pid: session.pid,
      lastActivityAt: formatMysqlDateTime()
    });
    await this.database.persist();
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
