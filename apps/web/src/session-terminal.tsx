import type { SessionRuntimeStatus, SessionStreamEvent } from "@workhorse-station/shared";
import { createSessionWebSocket, getSessionTerminal } from "./api";
import { PtyTerminal, type PtyTerminalSnapshot } from "./pty-terminal";

type SessionTerminalProps = {
  projectId: string;
  sessionId: string;
  runtimeStatus: SessionRuntimeStatus | null;
  cachedSnapshot?: PtyTerminalSnapshot | null;
  onBufferChange?: (snapshot: PtyTerminalSnapshot) => void;
  onRuntimeEvent?: (event: SessionStreamEvent) => void;
  className?: string;
  visible?: boolean;
};

export function SessionTerminal({ projectId, sessionId, runtimeStatus, cachedSnapshot, onBufferChange, onRuntimeEvent, className, visible }: SessionTerminalProps) {
  return (
    <PtyTerminal<SessionStreamEvent>
      sourceKey={`session:${sessionId}`}
      runtimeStatus={runtimeStatus}
      loadSnapshot={() => getSessionTerminal(projectId, sessionId)}
      createSocket={() => createSessionWebSocket(projectId, sessionId)}
      cachedSnapshot={cachedSnapshot}
      onBufferChange={onBufferChange}
      onRuntimeEvent={onRuntimeEvent}
      className={className}
      visible={visible}
    />
  );
}
