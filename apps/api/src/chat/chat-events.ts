import type { ChatStreamEvent } from "@workhorse-station/shared";

export function createChatStreamEvent(input: Omit<ChatStreamEvent, "timestamp">): ChatStreamEvent {
  return {
    ...input,
    timestamp: new Date().toISOString()
  };
}
