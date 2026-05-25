import { useEffect, useRef, useState } from "react";
import type { SessionRuntimeStatus } from "@workhorse-station/shared";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

type PtyTerminalProps<TEvent extends { output?: string }> = {
  runtimeStatus: SessionRuntimeStatus | null;
  loadSnapshot: () => Promise<{ buffer: string }>;
  createSocket: () => WebSocket;
  onRuntimeEvent?: (event: TEvent) => void;
};

const termTheme = {
  background: "#000000"
};

type StoppedTerminalState = {
  terminal: Terminal;
  fitAddon: FitAddon;
  observer: ResizeObserver;
};

export function PtyTerminal<TEvent extends { output?: string }>({ runtimeStatus, loadSnapshot, createSocket, onRuntimeEvent }: PtyTerminalProps<TEvent>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stoppedRef = useRef<HTMLDivElement | null>(null);
  const stoppedStateRef = useRef<StoppedTerminalState | null>(null);
  const [snapshotBuffer, setSnapshotBuffer] = useState("");
  const isLive = runtimeStatus === "starting" || runtimeStatus === "running" || runtimeStatus === "stopping";

  useEffect(() => {
    let cancelled = false;

    void loadSnapshot()
      .then((snapshot) => {
        if (!cancelled) {
          setSnapshotBuffer(snapshot.buffer);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshotBuffer("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadSnapshot]);

  useEffect(() => {
    if (isLive) {
      return;
    }

    const container = stoppedRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: false,
      disableStdin: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 14,
      theme: termTheme,
      scrollback: 100_000
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    const fit = () => {
      try {
        fitAddon.fit();
      } catch {
        // transient layout error
      }
    };

    fit();

    const observer = new ResizeObserver(() => fit());
    observer.observe(container);
    stoppedStateRef.current = { terminal, fitAddon, observer };

    return () => {
      observer.disconnect();
      terminal.dispose();
      stoppedStateRef.current = null;
    };
  }, [isLive]);

  useEffect(() => {
    if (isLive) {
      return;
    }

    const state = stoppedStateRef.current;
    if (!state) {
      return;
    }

    state.terminal.reset();
    state.terminal.write(snapshotBuffer || "暂无终端输出");
  }, [isLive, snapshotBuffer]);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 14,
      theme: termTheme
    });
    const fitAddon = new FitAddon();
    let disposed = false;

    terminal.loadAddon(fitAddon);
    terminal.open(container);

    const ws = createSocket();

    ws.onopen = () => {
      fitAddon.fit();
      const cols = terminal.cols;
      const rows = terminal.rows;
      if (cols > 0 && rows > 0) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    };

    ws.onerror = () => {
      terminal.write("\r\n[WebSocket 连接失败]\r\n");
    };

    ws.onclose = () => {
      terminal.write("\r\n[WebSocket 已断开]\r\n");
    };

    const fitTerminal = () => {
      if (disposed || !container.isConnected || container.clientWidth === 0 || container.clientHeight === 0) {
        return;
      }

      try {
        fitAddon.fit();
        const cols = terminal.cols;
        const rows = terminal.rows;
        if (cols > 0 && rows > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      } catch {
        // xterm can report transient layout errors while the modal is settling.
      }
    };

    const handleResize = () => {
      window.requestAnimationFrame(fitTerminal);
    };

    const inputDisposable = terminal.onData((data: string) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }
      ws.send(JSON.stringify({ type: "input", data }));
    });

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(typeof msg.data === "string" ? msg.data : String(msg.data)) as TEvent;
        onRuntimeEvent?.(event);
        if (typeof event.output === "string") {
          terminal.write(event.output);
        }
      } catch {
        // ignore malformed messages
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(fitTerminal);
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", handleResize);

    const initialFit = window.requestAnimationFrame(() => {
      fitTerminal();
    });

    void loadSnapshot()
      .then((snapshot) => {
        if (disposed) {
          return;
        }

        terminal.write(snapshot.buffer);
        window.requestAnimationFrame(fitTerminal);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      window.cancelAnimationFrame(initialFit);
      ws.close();
      inputDisposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, [createSocket, isLive, loadSnapshot, onRuntimeEvent]);

  if (!isLive) {
    return <div ref={stoppedRef} className="h-[60vh] min-h-[320px] w-full rounded-xl border border-white/10 bg-black" />;
  }

  return <div ref={containerRef} className="h-[60vh] min-h-[320px] w-full rounded-xl border border-white/10 bg-black" />;
}
