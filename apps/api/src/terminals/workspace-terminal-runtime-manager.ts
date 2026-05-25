import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type {
  ExecutionListItem,
  SessionRuntimeStatus,
  WorkspaceTerminalSnapshotResponse,
  WorkspaceTerminalStreamEvent,
  WorkspaceTerminalSummary
} from "@workhorse-station/shared";
import { SessionPty } from "../sessions/session-pty.js";

type RuntimeTerminal = WorkspaceTerminalSummary & {
  buffer: string;
  pty: SessionPty | null;
  stopRequested: boolean;
};

const maxBufferLength = 200_000;

export class WorkspaceTerminalRuntimeManager extends EventEmitter {
  private readonly terminals = new Map<string, RuntimeTerminal>();

  list() {
    return Array.from(this.terminals.values())
      .map((terminal) => toExecutionListItem(terminal))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  listRunning() {
    return this.list().filter((terminal) => terminal.status === "running");
  }

  get(terminalId: string): WorkspaceTerminalSummary | null {
    const terminal = this.terminals.get(terminalId);
    return terminal ? toSummary(terminal) : null;
  }

  getSnapshot(terminalId: string): WorkspaceTerminalSnapshotResponse | null {
    const terminal = this.terminals.get(terminalId);

    if (!terminal) {
      return null;
    }

    return {
      terminalId,
      buffer: terminal.buffer,
      runtimeStatus: terminal.runtimeStatus,
      cwd: terminal.cwd
    };
  }

  startTerminal(input: {
    projectId: string | null;
    worktreeId: string | null;
    requestedWorktreeName: string | null;
    cwd: string;
  }) {
    const terminalId = randomUUID();
    const pty = new SessionPty();
    const shell = resolveShellBinary();
    const now = new Date().toISOString();

    const terminal: RuntimeTerminal = {
      id: terminalId,
      projectId: input.projectId,
      worktreeId: input.worktreeId,
      requestedWorktreeName: input.requestedWorktreeName,
      runtimeStatus: "starting",
      pid: null,
      cwd: input.cwd,
      createdAt: now,
      updatedAt: now,
      buffer: "",
      pty,
      stopRequested: false
    };

    this.terminals.set(terminalId, terminal);
    this.emitEvent({
      type: "terminal.runtime",
      terminalId,
      runtimeStatus: terminal.runtimeStatus,
      pid: terminal.pid,
      cwd: terminal.cwd
    });

    pty.on("output", (data: string) => {
      const nextBuffer = `${terminal.buffer}${data}`;
      terminal.buffer = nextBuffer.length > maxBufferLength ? nextBuffer.slice(-maxBufferLength) : nextBuffer;
      terminal.runtimeStatus = terminal.stopRequested ? "stopping" : "running";
      terminal.updatedAt = new Date().toISOString();

      this.emitEvent({
        type: "terminal.output",
        terminalId,
        runtimeStatus: terminal.runtimeStatus,
        pid: terminal.pid,
        cwd: terminal.cwd,
        output: data
      });
    });

    pty.on("exit", ({ exitCode }: { exitCode: number }) => {
      terminal.runtimeStatus = terminal.stopRequested || exitCode === 0 ? "stopped" : "failed";
      terminal.pid = null;
      terminal.pty = null;
      terminal.updatedAt = new Date().toISOString();

      this.emitEvent({
        type: "terminal.exit",
        terminalId,
        runtimeStatus: terminal.runtimeStatus,
        pid: null,
        cwd: terminal.cwd,
        exitCode: terminal.stopRequested ? null : exitCode
      });
    });

    try {
      const pid = pty.start({
        command: shell,
        args: [],
        cwd: input.cwd,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          LANG: "en_US.UTF-8",
          LC_ALL: "en_US.UTF-8"
        }
      });

      terminal.pid = pid;
      terminal.runtimeStatus = "running";
      terminal.updatedAt = new Date().toISOString();

      this.emitEvent({
        type: "terminal.started",
        terminalId,
        runtimeStatus: terminal.runtimeStatus,
        pid: terminal.pid,
        cwd: terminal.cwd
      });

      return toSummary(terminal);
    } catch (error) {
      terminal.runtimeStatus = "failed";
      terminal.updatedAt = new Date().toISOString();
      terminal.pty = null;
      this.emitEvent({
        type: "terminal.error",
        terminalId,
        runtimeStatus: terminal.runtimeStatus,
        pid: null,
        cwd: terminal.cwd,
        message: error instanceof Error ? error.message : "终端启动失败"
      });
      throw error;
    }
  }

  write(terminalId: string, data: string) {
    const terminal = this.terminals.get(terminalId);

    if (!terminal?.pty) {
      return false;
    }

    terminal.pty.write(data);
    return true;
  }

  resize(terminalId: string, cols: number, rows: number) {
    const terminal = this.terminals.get(terminalId);

    if (!terminal?.pty) {
      return false;
    }

    terminal.pty.resize(cols, rows);
    return true;
  }

  stopTerminal(terminalId: string) {
    const terminal = this.terminals.get(terminalId);

    if (!terminal?.pty) {
      return false;
    }

    terminal.stopRequested = true;
    terminal.runtimeStatus = "stopping";
    terminal.updatedAt = new Date().toISOString();
    this.emitEvent({
      type: "terminal.runtime",
      terminalId,
      runtimeStatus: terminal.runtimeStatus,
      pid: terminal.pid,
      cwd: terminal.cwd
    });
    terminal.pty.stop();
    return true;
  }

  deleteTerminal(terminalId: string) {
    const terminal = this.terminals.get(terminalId);

    if (!terminal) {
      return false;
    }

    if (terminal.pty) {
      terminal.stopRequested = true;
      terminal.pty.stop();
      terminal.pty = null;
    }

    this.terminals.delete(terminalId);
    return true;
  }

  private emitEvent(input: Omit<WorkspaceTerminalStreamEvent, "timestamp">) {
    this.emit("event", {
      ...input,
      timestamp: new Date().toISOString()
    } satisfies WorkspaceTerminalStreamEvent);
  }
}

function toSummary(terminal: RuntimeTerminal): WorkspaceTerminalSummary {
  return {
    id: terminal.id,
    projectId: terminal.projectId,
    worktreeId: terminal.worktreeId,
    requestedWorktreeName: terminal.requestedWorktreeName,
    runtimeStatus: terminal.runtimeStatus,
    pid: terminal.pid,
    cwd: terminal.cwd,
    createdAt: terminal.createdAt,
    updatedAt: terminal.updatedAt
  };
}

function toExecutionListItem(terminal: RuntimeTerminal): ExecutionListItem {
  return {
    id: terminal.id,
    kind: "workspace-terminal",
    projectId: terminal.projectId,
    projectName: null,
    name: terminal.cwd,
    status: terminal.runtimeStatus === "failed" ? "failed" : terminal.runtimeStatus === "stopped" ? "stopped" : "running",
    runtimeStatus: terminal.runtimeStatus,
    summary: null,
    todoId: null,
    worktreeId: terminal.worktreeId,
    requestedWorktreeName: terminal.requestedWorktreeName,
    pid: terminal.pid,
    cwd: terminal.cwd,
    createdAt: terminal.createdAt,
    updatedAt: terminal.updatedAt
  };
}

function resolveShellBinary() {
  const shell = process.env.SHELL?.trim();
  return shell || "/bin/bash";
}
