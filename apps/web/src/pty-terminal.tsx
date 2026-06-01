import { useEffect, useRef } from "react";
import type { SessionRuntimeStatus } from "@workhorse-station/shared";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { Eraser, RefreshCw } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

type PtyTerminalEvent = {
  output?: string;
  runtimeStatus?: SessionRuntimeStatus | null;
  cwd?: string | null;
};

export type PtyTerminalSnapshot = {
  buffer: string;
  runtimeStatus: SessionRuntimeStatus | null;
  cwd: string | null;
};

type PtyTerminalProps<TEvent extends PtyTerminalEvent> = {
  sourceKey: string;
  runtimeStatus: SessionRuntimeStatus | null;
  loadSnapshot: () => Promise<PtyTerminalSnapshot>;
  createSocket: () => WebSocket;
  cachedSnapshot?: PtyTerminalSnapshot | null;
  onBufferChange?: (snapshot: PtyTerminalSnapshot) => void;
  onRuntimeEvent?: (event: TEvent) => void;
  className?: string;
  visible?: boolean;
};

const termTheme = {
  background: "#000000"
};

const defaultContainerClassName = "h-[60vh] min-h-[320px] w-full rounded-xl border border-white/10 bg-black";
const maxBufferedLength = 200_000;

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

function bindTerminalCopyShortcut(terminal: Terminal) {
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown" || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.key.toLowerCase() !== "c") {
      return true;
    }

    event.preventDefault();
    event.stopPropagation();

    const selection = terminal.getSelection();
    if (selection) {
      void navigator.clipboard.writeText(selection).catch(() => {});
    }

    return false;
  });
}

function trimTerminalBuffer(buffer: string) {
  return buffer.length > maxBufferedLength ? buffer.slice(-maxBufferedLength) : buffer;
}

export function PtyTerminal<TEvent extends PtyTerminalEvent>({
  sourceKey,
  runtimeStatus,
  loadSnapshot,
  createSocket,
  cachedSnapshot,
  onBufferChange,
  onRuntimeEvent,
  className,
  visible = true
}: PtyTerminalProps<TEvent>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const controlsRef = useRef<TerminalControls | null>(null);
  const relayoutCleanupRef = useRef<(() => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const inputDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const activeTokenRef = useRef(0);
  const currentSnapshotRef = useRef<PtyTerminalSnapshot>({
    buffer: "",
    runtimeStatus: null,
    cwd: null
  });
  const loadSnapshotRef = useRef(loadSnapshot);
  const createSocketRef = useRef(createSocket);
  const cachedSnapshotRef = useRef(cachedSnapshot);
  const onBufferChangeRef = useRef(onBufferChange);
  const onRuntimeEventRef = useRef(onRuntimeEvent);
  const runtimeStatusRef = useRef(runtimeStatus);
  const containerClassName = className ?? defaultContainerClassName;
  const isLive = runtimeStatus === "starting" || runtimeStatus === "running" || runtimeStatus === "stopping";

  loadSnapshotRef.current = loadSnapshot;
  createSocketRef.current = createSocket;
  cachedSnapshotRef.current = cachedSnapshot;
  onBufferChangeRef.current = onBufferChange;
  onRuntimeEventRef.current = onRuntimeEvent;
  runtimeStatusRef.current = runtimeStatus;

  const closeSocket = () => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
    socketRef.current = null;
  };

  const fitTerminal = () => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const container = containerRef.current;
    if (!terminal || !fitAddon || !container || !container.isConnected || container.clientWidth === 0 || container.clientHeight === 0) {
      return;
    }

    try {
      fitAddon.fit();
      const cols = terminal.cols;
      const rows = terminal.rows;
      const socket = socketRef.current;
      if (cols > 0 && rows > 0 && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    } catch {
      // xterm can report transient layout errors while the modal is settling.
    }
  };

  const getCellSize = () => {
    const terminal = terminalRef.current;
    const dims = (terminal as XtermWithPrivateCore | null)?._core?._renderService?.dimensions;
    if (!dims?.css) {
      return null;
    }
    return {
      width: dims.css.cell.width,
      height: dims.css.cell.height
    };
  };

  const publishSnapshot = (snapshot: PtyTerminalSnapshot, persist = true) => {
    currentSnapshotRef.current = {
      buffer: trimTerminalBuffer(snapshot.buffer),
      runtimeStatus: snapshot.runtimeStatus,
      cwd: snapshot.cwd
    };
    if (persist) {
      onBufferChangeRef.current?.(currentSnapshotRef.current);
    }
  };

  const renderSnapshot = (snapshot: PtyTerminalSnapshot, showEmptyPlaceholder: boolean) => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    publishSnapshot(snapshot, false);
    terminal.reset();

    if (currentSnapshotRef.current.buffer) {
      terminal.write(currentSnapshotRef.current.buffer);
    } else if (showEmptyPlaceholder) {
      terminal.write("暂无终端输出");
    }

    if (visible) {
      window.requestAnimationFrame(fitTerminal);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: false,
      disableStdin: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 14,
      theme: termTheme,
      scrollback: 100_000,
      allowProposedApi: true
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    bindTerminalCopyShortcut(terminal);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    controlsRef.current = {
      clear: () => terminal.clear(),
      fit: () => {
        const currentContainer = containerRef.current;
        if (!currentContainer) {
          return;
        }
        relayoutCleanupRef.current?.();
        relayoutCleanupRef.current = forceTerminalReflow(currentContainer, fitTerminal, getCellSize);
      }
    };

    inputDisposableRef.current = terminal.onData((data: string) => {
      const socket = socketRef.current;
      if (socket?.readyState !== WebSocket.OPEN || terminal.options.disableStdin) {
        return;
      }
      socket.send(JSON.stringify({ type: "input", data }));
    });

    resizeObserverRef.current = new ResizeObserver(() => {
      window.requestAnimationFrame(fitTerminal);
    });
    resizeObserverRef.current.observe(container);

    const handleResize = () => {
      window.requestAnimationFrame(fitTerminal);
    };

    window.addEventListener("resize", handleResize);
    window.requestAnimationFrame(fitTerminal);

    return () => {
      activeTokenRef.current += 1;
      closeSocket();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      inputDisposableRef.current?.dispose();
      inputDisposableRef.current = null;
      relayoutCleanupRef.current?.();
      relayoutCleanupRef.current = null;
      controlsRef.current = null;
      fitAddonRef.current = null;
      terminalRef.current = null;
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      controlsRef.current?.fit();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [sourceKey, visible]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    const token = activeTokenRef.current + 1;
    activeTokenRef.current = token;
    closeSocket();

    terminal.options.cursorBlink = isLive;
    terminal.options.disableStdin = !isLive;

    const initialSnapshot = cachedSnapshotRef.current ?? {
      buffer: "",
      runtimeStatus: runtimeStatusRef.current,
      cwd: currentSnapshotRef.current.cwd
    };
    renderSnapshot(initialSnapshot, !isLive);

    let receivedOutput = false;

    const openSocket = () => {
      const ws = createSocketRef.current();
      socketRef.current = ws;

      ws.onopen = () => {
        if (activeTokenRef.current !== token) {
          return;
        }
        fitTerminal();
      };

      ws.onerror = () => {
        if (activeTokenRef.current !== token) {
          return;
        }
        terminal.write("\r\n[WebSocket 连接失败]\r\n");
      };

      ws.onclose = () => {
        if (activeTokenRef.current !== token) {
          return;
        }
        terminal.write("\r\n[WebSocket 已断开]\r\n");
      };

      ws.onmessage = (msg) => {
        if (activeTokenRef.current !== token) {
          return;
        }

        try {
          const event = JSON.parse(typeof msg.data === "string" ? msg.data : String(msg.data)) as TEvent;
          onRuntimeEventRef.current?.(event);

          const nextSnapshot: PtyTerminalSnapshot = {
            buffer: currentSnapshotRef.current.buffer,
            runtimeStatus: event.runtimeStatus ?? currentSnapshotRef.current.runtimeStatus,
            cwd: event.cwd ?? currentSnapshotRef.current.cwd
          };

          if (typeof event.output === "string") {
            receivedOutput = true;
            terminal.write(event.output);
            nextSnapshot.buffer = trimTerminalBuffer(`${currentSnapshotRef.current.buffer}${event.output}`);
          }

          publishSnapshot(nextSnapshot);
        } catch {
          // ignore malformed messages
        }
      };
    };

    if (isLive) {
      openSocket();
    }

    const shouldLoadSnapshot = !cachedSnapshotRef.current || !isLive;
    if (shouldLoadSnapshot) {
      void loadSnapshotRef.current()
        .then((snapshot) => {
          if (activeTokenRef.current !== token) {
            return;
          }
          if (isLive && receivedOutput) {
            return;
          }

          renderSnapshot(snapshot, !isLive);
          publishSnapshot(snapshot);
        })
        .catch(() => {});
    }

    return () => {
      if (activeTokenRef.current === token) {
        closeSocket();
      }
    };
  }, [sourceKey, isLive]);

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
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
