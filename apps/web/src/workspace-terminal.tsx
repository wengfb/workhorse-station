import type { SessionRuntimeStatus, WorkspaceTerminalStreamEvent } from "@workhorse-station/shared";
import { createWorkspaceTerminalWebSocket, getWorkspaceTerminal } from "./api";
import { PtyTerminal, type PtyTerminalSnapshot } from "./pty-terminal";

type WorkspaceTerminalProps = {
  terminalId: string;
  runtimeStatus: SessionRuntimeStatus | null;
  onBufferChange?: (snapshot: PtyTerminalSnapshot) => void;
  onRuntimeEvent?: (event: WorkspaceTerminalStreamEvent) => void;
  className?: string;
  visible?: boolean;
};

export function WorkspaceTerminal({ terminalId, runtimeStatus, onBufferChange, onRuntimeEvent, className, visible }: WorkspaceTerminalProps) {
  return (
    <PtyTerminal<WorkspaceTerminalStreamEvent>
      key={`workspace-terminal:${terminalId}`}
      sourceKey={`workspace-terminal:${terminalId}`}
      runtimeStatus={runtimeStatus}
      loadSnapshot={() => getWorkspaceTerminal(terminalId)}
      createSocket={() => createWorkspaceTerminalWebSocket(terminalId)}
      onBufferChange={onBufferChange}
      onRuntimeEvent={onRuntimeEvent}
      className={className}
      visible={visible}
    />
  );
}
