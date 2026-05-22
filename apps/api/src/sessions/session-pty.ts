import { EventEmitter } from "node:events";
import * as pty from "node-pty";
import type { IPty } from "node-pty";

export type SessionPtyEvents = {
  output: (data: string) => void;
  exit: (event: { exitCode: number; signal: number }) => void;
  error: (error: Error) => void;
};

export class SessionPty extends EventEmitter {
  private process: IPty | null = null;

  start(input: {
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string | undefined>;
    cols?: number;
    rows?: number;
  }) {
    this.process = pty.spawn(input.command, input.args, {
      name: "xterm-256color",
      cwd: input.cwd,
      env: input.env,
      cols: input.cols ?? 120,
      rows: input.rows ?? 36
    });

    this.process.onData((data: string) => {
      this.emit("output", data);
    });

    this.process.onExit((event) => {
      this.emit("exit", event);
      this.process = null;
    });

    return this.process.pid;
  }

  write(data: string) {
    this.process?.write(data);
  }

  resize(cols: number, rows: number) {
    if (!this.process) {
      return;
    }

    this.process.resize(cols, rows);
  }

  stop() {
    this.process?.kill();
  }
}
