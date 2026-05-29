import { randomUUID } from "node:crypto";
import type {
  BetaMessageParam,
  BetaToolUnion
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type {
  ChatAttachment,
  ChatMessageSummary,
  ChatToolCall,
  ChatToolResult,
  ChatStreamEvent,
  ProjectSummary,
  WorktreeSummary
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { getClient, buildSystemPrompt, toBetaMessages, renderMessageContent, MODEL, MAX_TOKENS, MAX_TOOL_ITERATIONS } from "./chat-service.js";
import { getChatToolDefs, executeChatTool, getToolConfirmation } from "./chat-tools.js";
import { appendChatMessage, getChatSession } from "./chat-repository.js";
import { createChatStreamEvent } from "./chat-events.js";
import { listChatSkills } from "../skills/skill-loader.js";

const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000;

type PendingConfirmation = {
  resolve: (approved: boolean) => void;
  timeout: NodeJS.Timeout;
};

export class ChatStreamHandler {
  private chatSessionId: string;
  private database: DatabaseState;
  private project: ProjectSummary | null;
  private worktree: WorktreeSummary | null;
  private pendingConfirmations = new Map<string, PendingConfirmation>();
  private active = true;

  constructor(
    chatSessionId: string,
    database: DatabaseState,
    project: ProjectSummary | null,
    worktree: WorktreeSummary | null,
    private onEvent: (event: ChatStreamEvent) => void
  ) {
    this.chatSessionId = chatSessionId;
    this.database = database;
    this.project = project;
    this.worktree = worktree;
  }

  async processMessage(content: string, attachments: ChatAttachment[]): Promise<void> {
    try {
      const session = await getChatSession(this.database.db, this.chatSessionId);
      if (!session) {
        this.onEvent(createChatStreamEvent({
          type: "chat.error",
          chatSessionId: this.chatSessionId,
          message: "聊天会话不存在"
        }));
        return;
      }

      const history = session.messages ?? [];
      const messages = toBetaMessages(history);
      messages.push({
        role: "user",
        content: renderMessageContent(content, attachments)
      });

      const anthropic = getClient();
      const chatSkills = await listChatSkills();
      const toolDefs = getChatToolDefs(chatSkills);
      const tools: BetaToolUnion[] = toolDefs as BetaToolUnion[];
      const system = buildSystemPrompt(this.project, this.worktree, chatSkills);

      let iteration = 0;
      for (; iteration < MAX_TOOL_ITERATIONS && this.active; iteration++) {
        const stream = anthropic.beta.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages,
          tools,
          tool_choice: { type: "auto" },
          thinking: { type: "disabled" }
        });

        let replyText = "";
        const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
        let currentToolUse: { id: string; name: string; input_json: string } | null = null;
        let stopReason: string | null = null;

        for await (const event of stream) {
          if (!this.active) break;

          const rawEvent = event as {
            type: string;
            delta?: { type: string; text?: string; partial_json?: string; stop_reason?: string | null };
            content_block?: { type: string; id?: string; name?: string };
          };

          switch (rawEvent.type) {
            case "content_block_start":
              if (rawEvent.content_block?.type === "tool_use" && rawEvent.content_block.id) {
                currentToolUse = {
                  id: rawEvent.content_block.id,
                  name: rawEvent.content_block.name ?? "",
                  input_json: ""
                };
              }
              break;

            case "content_block_delta":
              if (rawEvent.delta?.type === "text_delta" && rawEvent.delta.text) {
                replyText += rawEvent.delta.text;
                this.onEvent(createChatStreamEvent({
                  type: "chat.text_delta",
                  chatSessionId: this.chatSessionId,
                  text: rawEvent.delta.text
                }));
              } else if (rawEvent.delta?.type === "input_json_delta" && rawEvent.delta.partial_json) {
                if (currentToolUse) {
                  currentToolUse.input_json += rawEvent.delta.partial_json;
                }
              }
              break;

            case "content_block_stop":
              if (currentToolUse) {
                try {
                  const input = JSON.parse(currentToolUse.input_json || "{}");
                  toolUseBlocks.push({
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input
                  });
                } catch {
                  toolUseBlocks.push({
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input: {}
                  });
                }
                currentToolUse = null;
              }
              break;

            case "message_delta":
              stopReason = rawEvent.delta?.stop_reason ?? null;
              break;
          }
        }

        if (!this.active) return;

        if (toolUseBlocks.length === 0) {
          const assistantMessage = await appendChatMessage(this.database.db, {
            id: randomUUID(),
            chatSessionId: this.chatSessionId,
            role: "assistant",
            content: replyText,
            attachments: [],
            artifactSuggestions: [],
            toolCalls: [],
            toolResults: []
          });
          await this.database.persist();
          this.emitMessageCommitted(assistantMessage);

          messages.push({ role: "assistant", content: replyText });
          break;
        }

        const chatToolCalls: ChatToolCall[] = toolUseBlocks.map((b) => ({
          id: b.id,
          name: b.name,
          input: b.input,
          status: "pending_confirmation" as const
        }));

        const toolResults: ChatToolResult[] = [];
        const toolResultContent: Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error: boolean }> = [];

        for (const tc of chatToolCalls) {
          const confirmation = getToolConfirmation(tc.name);

          this.onEvent(createChatStreamEvent({
            type: "chat.tool_use_pending",
            chatSessionId: this.chatSessionId,
            toolCall: { ...tc, status: "pending_confirmation" }
          }));

          if (confirmation === "confirm") {
            const approved = await this.waitForConfirmation(tc.id);
            tc.status = approved ? "approved" : "rejected";

            if (!approved) {
              const skipResult = "用户拒绝了此工具调用";
              const toolResult = { toolCallId: tc.id, result: skipResult, isError: false };
              toolResults.push(toolResult);
              toolResultContent.push({ type: "tool_result", tool_use_id: tc.id, content: skipResult, is_error: false });
              this.onEvent(createChatStreamEvent({
                type: "chat.tool_result",
                chatSessionId: this.chatSessionId,
                toolResult
              }));
              continue;
            }
          }

          tc.status = "executed";
          this.onEvent(createChatStreamEvent({
            type: "chat.tool_call",
            chatSessionId: this.chatSessionId,
            toolCall: tc
          }));

          const result = await executeChatTool(this.database.db, tc.name, tc.input);
          const toolResult = { toolCallId: tc.id, result: result.result, isError: result.isError };
          toolResults.push(toolResult);
          toolResultContent.push({ type: "tool_result", tool_use_id: tc.id, content: result.result, is_error: result.isError });

          this.onEvent(createChatStreamEvent({
            type: "chat.tool_result",
            chatSessionId: this.chatSessionId,
            toolResult
          }));
        }

        const assistantMessage = await appendChatMessage(this.database.db, {
          id: randomUUID(),
          chatSessionId: this.chatSessionId,
          role: "assistant",
          content: replyText,
          attachments: [],
          artifactSuggestions: [],
          toolCalls: chatToolCalls,
          toolResults
        });

        await this.database.persist();
        this.emitMessageCommitted(assistantMessage);

        const assistantContent: unknown[] = [];
        if (replyText) {
          assistantContent.push({ type: "text", text: replyText });
        }
        for (const b of toolUseBlocks) {
          assistantContent.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
        }
        messages.push({ role: "assistant", content: assistantContent as BetaMessageParam["content"] });

        if (toolResultContent.length > 0) {
          messages.push({ role: "user", content: toolResultContent as BetaMessageParam["content"] });
        }

        if (stopReason === "end_turn") {
          break;
        }
      }

      if (this.active && iteration >= MAX_TOOL_ITERATIONS) {
        this.onEvent(createChatStreamEvent({
          type: "chat.error",
          chatSessionId: this.chatSessionId,
          message: `工具调用轮次已达到上限（${MAX_TOOL_ITERATIONS}）`
        }));
        return;
      }

      if (this.active) {
        this.onEvent(createChatStreamEvent({
          type: "chat.done",
          chatSessionId: this.chatSessionId
        }));
      }
    } catch (error) {
      console.error("[ChatStream] processMessage error:", error);
      this.onEvent(createChatStreamEvent({
        type: "chat.error",
        chatSessionId: this.chatSessionId,
        message: error instanceof Error ? error.message : "未知错误"
      }));
    }
  }

  confirmTool(toolCallId: string, approved: boolean): void {
    const pending = this.pendingConfirmations.get(toolCallId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingConfirmations.delete(toolCallId);
      pending.resolve(approved);
    }
  }

  destroy(): void {
    this.active = false;
    for (const [id, pending] of this.pendingConfirmations) {
      clearTimeout(pending.timeout);
      pending.resolve(false);
    }
    this.pendingConfirmations.clear();
  }

  private emitMessageCommitted(chatMessage: ChatMessageSummary): void {
    this.onEvent(createChatStreamEvent({
      type: "chat.message_committed",
      chatSessionId: this.chatSessionId,
      chatMessage
    }));
  }

  private waitForConfirmation(toolCallId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingConfirmations.delete(toolCallId);
        resolve(false);
      }, CONFIRMATION_TIMEOUT_MS);

      this.pendingConfirmations.set(toolCallId, { resolve, timeout });
    });
  }
}

const activeHandlers = new Map<string, ChatStreamHandler>();

export function registerStreamHandler(chatSessionId: string, handler: ChatStreamHandler): void {
  activeHandlers.set(chatSessionId, handler);
}

export function getStreamHandler(chatSessionId: string): ChatStreamHandler | undefined {
  return activeHandlers.get(chatSessionId);
}

export function unregisterStreamHandler(chatSessionId: string): void {
  activeHandlers.delete(chatSessionId);
}
