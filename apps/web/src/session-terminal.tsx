import type { SessionRuntimeStatus, SessionStreamEvent } from "@workhorse-station/shared";
import { createSessionWebSocket, getSessionTerminal } from "./api";
import { PtyTerminal } from "./pty-terminal";

type SessionTerminalProps = {
  projectId: string;
  sessionId: string;
  runtimeStatus: SessionRuntimeStatus | null;
  onRuntimeEvent?: (event: SessionStreamEvent) => void;
  className?: string;
};

export function SessionTerminal({ projectId, sessionId, runtimeStatus, onRuntimeEvent, className }: SessionTerminalProps) {
  return (
    <PtyTerminal<SessionStreamEvent>
      runtimeStatus={runtimeStatus}
      loadSnapshot={() => getSessionTerminal(projectId, sessionId)}
      createSocket={() => createSessionWebSocket(projectId, sessionId)}
      onRuntimeEvent={onRuntimeEvent}
      className={className}
    />
  );
}
