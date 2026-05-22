import type { SessionRuntimeStatus, SessionStreamEvent } from "@workhorse-station/shared";

export function createSessionEvent(event: Omit<SessionStreamEvent, "timestamp">): SessionStreamEvent {
  return {
    ...event,
    timestamp: new Date().toISOString()
  };
}

export function createRuntimeEvent(input: {
  type: SessionStreamEvent["type"];
  sessionId: string;
  runtimeStatus?: SessionRuntimeStatus | null;
  pid?: number | null;
  cwd?: string | null;
  output?: string;
  exitCode?: number | null;
  message?: string;
}) {
  return createSessionEvent(input);
}
