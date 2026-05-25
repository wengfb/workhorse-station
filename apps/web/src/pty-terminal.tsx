import { useEffect, useRef, useState } from "react";
import type { SessionRuntimeStatus } from "@workhorse-station/shared";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { Eraser, RefreshCw } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

type PtyTerminalProps<TEvent extends { output?: string }> = {
  runtimeStatus: SessionRuntimeStatus | null;
  loadSnapshot: () => Promise<{ buffer: string }>;
  createSocket: () => WebSocket;
  onRuntimeEvent?: (event: TEvent) => void;
  className?: string;
};

const termTheme = {
  background: "#000000"
};

const defaultContainerClassName = "h-[60vh] min-h-[320px] w-full rounded-xl border border-white/10 bg-black";

type TerminalControls = {
  clear: () => void;
  fit: () => void;
};

type XtermWithPrivateCore = Terminal & {
  _core?: {
    _renderService?: {
      dimensions?: {
        css?: {
          cell: {
            width: number;
            height: number;
          };
        };
      };
    };
  };
};

function forceTerminalReflow(container: HTMLDivElement, runFit: () => void, getCellSize?: () => { width: number; height: number } | null) {
  runFit();

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width <= 2 && height <= 2) {
    return () => {};
  }

  const cellSize = getCellSize?.();
  const widthDelta = cellSize ? Math.max(Math.ceil(cellSize.width) + 2, 12) : 24;
  const heightDelta = cellSize ? Math.max(Math.ceil(cellSize.height) + 2, 18) : 24;
  const shrinkWidth = width > widthDelta + 8;

  const originalWidth = container.style.width;
  const originalHeight = container.style.height;

  const restore = () => {
    container.style.width = originalWidth;
    container.style.height = originalHeight;
  };

  if (shrinkWidth) {
    container.style.width = `${width - widthDelta}px`;
  } else if (height > heightDelta + 8) {
    container.style.height = `${height - heightDelta}px`;
  } else {
    return () => {};
  }
  runFit();

  let rafRestoreId = 0;
  const rafId = window.requestAnimationFrame(() => {
    restore();
    runFit();

    rafRestoreId = window.requestAnimationFrame(runFit);
  });

  const timeoutId = window.setTimeout(() => {
    restore();
    runFit();
  }, 120);

  return () => {
    window.cancelAnimationFrame(rafId);
    window.cancelAnimationFrame(rafRestoreId);
    window.clearTimeout(timeoutId);
    restore();
  };
}

export function PtyTerminal<TEvent extends { output?: string }>({ runtimeStatus, loadSnapshot, createSocket, onRuntimeEvent, className }: PtyTerminalProps<TEvent>) {
  const liveContainerRef = useRef<HTMLDivElement | null>(null);
  const stoppedContainerRef = useRef<HTMLDivElement | null>(null);
  const stoppedTerminalRef = useRef<Terminal | null>(null);
  const controlsRef = useRef<TerminalControls | null>(null);
  const relayoutCleanupRef = useRef<(() => void) | null>(null);
  const [snapshotBuffer, setSnapshotBuffer] = useState("");
  const isLive = runtimeStatus === "starting" || runtimeStatus === "running" || runtimeStatus === "stopping";
  const containerClassName = className ?? defaultContainerClassName;

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

    const container = stoppedContainerRef.current;
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
    stoppedTerminalRef.current = terminal;

    const fit = () => {
      try {
        fitAddon.fit();
      } catch {
        // transient layout error
      }
    };

    const getCellSize = () => {
      const dims = (terminal as XtermWithPrivateCore)._core?._renderService?.dimensions;
      if (!dims?.css) {
        return null;
      }
      return {
        width: dims.css.cell.width,
        height: dims.css.cell.height
      };
    };

    controlsRef.current = {
      clear: () => terminal.clear(),
      fit: () => {
        relayoutCleanupRef.current?.();
        relayoutCleanupRef.current = forceTerminalReflow(container, fit, getCellSize);
      }
    };

    fit();

    const observer = new ResizeObserver(() => fit());
    observer.observe(container);

    return () => {
      observer.disconnect();
      relayoutCleanupRef.current?.();
      relayoutCleanupRef.current = null;
      stoppedTerminalRef.current = null;
      controlsRef.current = null;
      terminal.dispose();
    };
  }, [isLive]);

  useEffect(() => {
    if (isLive) {
      return;
    }

    const terminal = stoppedTerminalRef.current;
    if (!terminal) {
      return;
    }

    terminal.reset();
    terminal.write(snapshotBuffer || "暂无终端输出");
  }, [isLive, snapshotBuffer]);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const container = liveContainerRef.current;
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

    const getCellSize = () => {
      const dims = (terminal as XtermWithPrivateCore)._core?._renderService?.dimensions;
      if (!dims?.css) {
        return null;
      }
      return {
        width: dims.css.cell.width,
        height: dims.css.cell.height
      };
    };

    controlsRef.current = {
      clear: () => terminal.clear(),
      fit: () => {
        relayoutCleanupRef.current?.();
        relayoutCleanupRef.current = forceTerminalReflow(container, fitTerminal, getCellSize);
      }
    };

    ws.onopen = () => {
      fitTerminal();
    };

    ws.onerror = () => {
      terminal.write("\r\n[WebSocket 连接失败]\r\n");
    };

    ws.onclose = () => {
      terminal.write("\r\n[WebSocket 已断开]\r\n");
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
      relayoutCleanupRef.current?.();
      relayoutCleanupRef.current = null;
      controlsRef.current = null;
      window.cancelAnimationFrame(initialFit);
      ws.close();
      inputDisposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, [createSocket, isLive, loadSnapshot, onRuntimeEvent]);

  return (
    <div className={`relative ${containerClassName}`}>
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-black/70 p-1 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => controlsRef.current?.fit()}
          className="rounded-md p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
          aria-label="调整终端布局"
          title="调整终端布局"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => controlsRef.current?.clear()}
          className="rounded-md p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
          aria-label="清空当前终端显示"
          title="清空当前终端显示"
        >
          <Eraser className="h-4 w-4" />
        </button>
      </div>
      {isLive ? <div ref={liveContainerRef} className="h-full w-full" /> : <div ref={stoppedContainerRef} className="h-full w-full" />}
    </div>
  );
}
