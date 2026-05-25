import type { SessionRuntimeStatus, WorkspaceTerminalStreamEvent } from "@workhorse-station/shared";
import { createWorkspaceTerminalWebSocket, getWorkspaceTerminal } from "./api";
import { PtyTerminal } from "./pty-terminal";

type WorkspaceTerminalProps = {
  terminalId: string;
  runtimeStatus: SessionRuntimeStatus | null;
  onRuntimeEvent?: (event: WorkspaceTerminalStreamEvent) => void;
  className?: string;
};

export function WorkspaceTerminal({ terminalId, runtimeStatus, onRuntimeEvent, className }: WorkspaceTerminalProps) {
  return (
    <PtyTerminal<WorkspaceTerminalStreamEvent>
      runtimeStatus={runtimeStatus}
      loadSnapshot={() => getWorkspaceTerminal(terminalId)}
      createSocket={() => createWorkspaceTerminalWebSocket(terminalId)}
      onRuntimeEvent={onRuntimeEvent}
      className={className}
    />
  );
}
