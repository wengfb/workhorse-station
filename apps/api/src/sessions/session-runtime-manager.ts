import { EventEmitter } from "node:events";
import type { AgentProvider } from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { formatMysqlDateTime } from "../db/mysql.js";
import { getProjectSession, updateSessionCompletion, updateSessionRuntime, updateSessionTerminalBuffer } from "./session-repository.js";
import { SessionPty } from "./session-pty.js";
import { createRuntimeEvent } from "./session-events.js";
import { getPtySpawnContext } from "../shell-environment.js";
import { getSessionProvider } from "./session-provider-registry.js";

function formatProviderExitSummary(provider: AgentProvider, exitCode: number) {
  const label = provider === "codex" ? "Codex" : "Claude";
  return `${label} 退出，exit code ${exitCode}`;
}

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
  flushInProgress: boolean;
  flushRequested: boolean;
  runtimeDirty: boolean;
  bufferDirty: boolean;
  bufferDirtyAt: number | null;
  lastBufferFlushedLength: number;
};

const maxBufferLength = 2_000_000;
const runtimeFlushTickMs = 1_000;
const bufferFlushDelayMs = 5_000;
const bufferFlushThresholdBytes = 50_000;

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
    provider: AgentProvider;
    cwd: string;
    resolvedWorktreePath: string | null;
    prompt: string;
    resumeSessionId?: string;
    forkSession?: boolean;
    initialBuffer?: string;
  }) {
    const { env } = await getPtySpawnContext();
    const provider = getSessionProvider(input.provider);
    const launchSpec = await provider.buildLaunchSpec(
      {
        sessionId: input.sessionId,
        cwd: input.cwd,
        prompt: input.prompt,
        resumeSessionId: input.resumeSessionId,
        forkSession: input.forkSession
      },
      env
    );
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
        void this.flushSession(input.sessionId);
      }, runtimeFlushTickMs),
      flushInProgress: false,
      flushRequested: false,
      runtimeDirty: false,
      bufferDirty: false,
      bufferDirtyAt: null,
      lastBufferFlushedLength: 0
    };

    this.sessions.set(input.sessionId, state);
    this.emit("event", createRuntimeEvent({ type: "session.runtime", sessionId: input.sessionId, runtimeStatus: state.runtimeStatus, cwd: state.cwd, pid: null }));

    pty.on("output", (data: string) => {
      void (async () => {
        const nextBuffer = `${state.buffer}${data}`;
        state.buffer = nextBuffer.length > maxBufferLength ? nextBuffer.slice(-maxBufferLength) : nextBuffer;
        state.lastActivityAt = formatMysqlDateTime();
        state.runtimeStatus = state.stopRequested ? "stopping" : "running";
        state.runtimeDirty = true;
        state.bufferDirty = true;
        state.bufferDirtyAt ??= Date.now();

        this.emit(
          "event",
          createRuntimeEvent({
            type: "session.output",
            sessionId: input.sessionId,
            output: data,
            runtimeStatus: state.runtimeStatus,
            cwd: state.cwd,
            pid: state.pid
          })
        );
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
        state.runtimeDirty = true;
        state.bufferDirty = true;
        state.bufferDirtyAt ??= Date.now();

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

        await this.flushSession(input.sessionId, true);
        await updateSessionCompletion(this.database.db, input.projectId, input.sessionId, {
          status: stoppedByUser || exitCode === 0 ? "completed" : "failed",
          runtimeStatus: state.runtimeStatus,
          exitCode: stoppedByUser ? null : exitCode,
          lastActivityAt: state.lastActivityAt,
          summary: stoppedByUser || exitCode === 0 ? currentSummary : currentSummary ?? formatProviderExitSummary(input.provider, exitCode)
        });
        await this.database.persist();
        this.sessions.delete(input.sessionId);
      })().catch((error) => {
        console.error("[SessionRuntime] exit handler error:", error);
      });
    });

    const pid = pty.start({
      command: launchSpec.command,
      args: launchSpec.args,
      cwd: launchSpec.cwd,
      env
    });

    state.pid = pid;
    state.runtimeStatus = "running";
    state.lastActivityAt = formatMysqlDateTime();
    state.runtimeDirty = true;
    this.emit("event", createRuntimeEvent({ type: "session.started", sessionId: input.sessionId, runtimeStatus: state.runtimeStatus, cwd: state.cwd, pid: state.pid }));

    return {
      pid,
      runtimeStatus: state.runtimeStatus,
      cwd: state.cwd,
      lastActivityAt: state.lastActivityAt,
      providerThreadId: launchSpec.providerThreadId,
      providerMetadata: launchSpec.providerMetadata
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
    session.lastActivityAt = formatMysqlDateTime();
    session.runtimeDirty = true;
    this.emit("event", createRuntimeEvent({ type: "session.runtime", sessionId, runtimeStatus: session.runtimeStatus, cwd: session.cwd, pid: session.pid }));
    session.pty.stop();
    void this.flushSession(sessionId, true).catch((error) => {
      console.error("[SessionRuntime] stop flush error:", error);
    });
    return true;
  }

  private async flushSession(sessionId: string, force = false) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    if (session.flushInProgress) {
      session.flushRequested = true;
      return true;
    }

    session.flushInProgress = true;

    try {
      do {
        session.flushRequested = false;

        const runtimeShouldFlush = force || session.runtimeDirty;
        const bufferShouldFlush = force || this.shouldFlushBuffer(session);

        if (runtimeShouldFlush) {
          session.runtimeDirty = false;
          try {
            await updateSessionRuntime(this.database.db, session.projectId, session.sessionId, {
              runtimeStatus: session.runtimeStatus,
              pid: session.pid,
              lastActivityAt: session.lastActivityAt
            });
          } catch (error) {
            session.runtimeDirty = true;
            throw error;
          }
        }

        if (bufferShouldFlush) {
          const bufferSnapshot = session.buffer;
          session.bufferDirty = false;
          try {
            await updateSessionTerminalBuffer(this.database.db, session.projectId, session.sessionId, bufferSnapshot);
            session.lastBufferFlushedLength = bufferSnapshot.length;
            if (!session.bufferDirty) {
              session.bufferDirtyAt = null;
            }
          } catch (error) {
            session.bufferDirty = true;
            throw error;
          }
        }

        await this.database.persist();
      } while (session.flushRequested);
    } finally {
      session.flushInProgress = false;
    }

    return true;
  }

  private shouldFlushBuffer(session: RuntimeSession) {
    if (!session.bufferDirty) {
      return false;
    }

    if (session.buffer.length - session.lastBufferFlushedLength >= bufferFlushThresholdBytes) {
      return true;
    }

    if (session.bufferDirtyAt === null) {
      return false;
    }

    return Date.now() - session.bufferDirtyAt >= bufferFlushDelayMs;
  }
}
