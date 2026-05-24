import { useEffect, useRef, useState } from "react";
import type { SessionRuntimeStatus, SessionStreamEvent } from "@workhorse-station/shared";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { createSessionEventSource, getSessionTerminal, resizeSessionTerminal, sendSessionInput } from "./api";

type SessionTerminalProps = {
  projectId: string;
  sessionId: string;
  runtimeStatus: SessionRuntimeStatus | null;
  onRuntimeEvent?: (event: SessionStreamEvent) => void;
};

const termTheme = {
  background: "#000000",
  foreground: "#d1fae5"
};

export function SessionTerminal({ projectId, sessionId, runtimeStatus, onRuntimeEvent }: SessionTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stoppedRef = useRef<HTMLDivElement | null>(null);
  const [snapshotBuffer, setSnapshotBuffer] = useState("");
  const isLive = runtimeStatus === "starting" || runtimeStatus === "running" || runtimeStatus === "stopping";

  useEffect(() => {
    let cancelled = false;

    void getSessionTerminal(projectId, sessionId)
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
  }, [projectId, sessionId]);

  // Readonly terminal for stopped sessions — renders ANSI buffer correctly
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
      fontSize: 13,
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
    terminal.write(snapshotBuffer || "暂无终端输出");

    const observer = new ResizeObserver(() => fit());
    observer.observe(container);

    return () => {
      observer.disconnect();
      terminal.dispose();
    };
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
      fontSize: 13,
      theme: termTheme
    });
    const fitAddon = new FitAddon();
    let disposed = false;

    terminal.loadAddon(fitAddon);
    terminal.open(container);

    const fitTerminal = () => {
      if (disposed || !container.isConnected || container.clientWidth === 0 || container.clientHeight === 0) {
        return;
      }

      try {
        fitAddon.fit();
        const cols = terminal.cols;
        const rows = terminal.rows;
        if (cols > 0 && rows > 0) {
          void resizeSessionTerminal(projectId, sessionId, { cols, rows }).catch(() => {});
        }
      } catch {
        // xterm can report transient layout errors while the modal is settling.
      }
    };

    const handleResize = () => {
      window.requestAnimationFrame(fitTerminal);
    };

    const inputDisposable = terminal.onData((data) => {
      if (runtimeStatus !== "running" && runtimeStatus !== "starting" && runtimeStatus !== "stopping") {
        return;
      }

      void sendSessionInput(projectId, sessionId, { data }).catch(() => {});
    });

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(fitTerminal);
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", handleResize);

    const initialFit = window.requestAnimationFrame(() => {
      fitTerminal();
    });

    void getSessionTerminal(projectId, sessionId)
      .then((snapshot) => {
        if (disposed) {
          return;
        }

        terminal.write(snapshot.buffer);
        window.requestAnimationFrame(fitTerminal);
      })
      .catch(() => {});

    const source = createSessionEventSource(projectId, sessionId, (event) => {
      onRuntimeEvent?.(event);
      if (event.type === "session.output" && event.output) {
        terminal.write(event.output);
      }
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(initialFit);
      source.close();
      inputDisposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, [isLive, projectId, sessionId, runtimeStatus, onRuntimeEvent]);

  if (!isLive) {
    return <div ref={stoppedRef} className="h-[60vh] min-h-[320px] w-full rounded-xl border border-white/10 bg-black" />;
  }

  return <div ref={containerRef} className="h-[60vh] min-h-[320px] w-full rounded-xl border border-white/10 bg-black" />;
}
