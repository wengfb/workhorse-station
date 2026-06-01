import type { SessionRuntimeStatus, WorkspaceTerminalStreamEvent } from "@workhorse-station/shared";
import { createWorkspaceTerminalWebSocket, getWorkspaceTerminal } from "./api";
import { PtyTerminal, type PtyTerminalSnapshot } from "./pty-terminal";

type WorkspaceTerminalProps = {
  terminalId: string;
  runtimeStatus: SessionRuntimeStatus | null;
  cachedSnapshot?: PtyTerminalSnapshot | null;
  onBufferChange?: (snapshot: PtyTerminalSnapshot) => void;
  onRuntimeEvent?: (event: WorkspaceTerminalStreamEvent) => void;
  className?: string;
  visible?: boolean;
};

export function WorkspaceTerminal({ terminalId, runtimeStatus, cachedSnapshot, onBufferChange, onRuntimeEvent, className, visible }: WorkspaceTerminalProps) {
  return (
    <PtyTerminal<WorkspaceTerminalStreamEvent>
      sourceKey={`workspace-terminal:${terminalId}`}
      runtimeStatus={runtimeStatus}
      loadSnapshot={() => getWorkspaceTerminal(terminalId)}
      createSocket={() => createWorkspaceTerminalWebSocket(terminalId)}
      cachedSnapshot={cachedSnapshot}
      onBufferChange={onBufferChange}
      onRuntimeEvent={onRuntimeEvent}
      className={className}
      visible={visible}
    />
  );
}
