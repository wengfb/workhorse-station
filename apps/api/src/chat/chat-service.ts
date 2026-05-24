import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessageParam,
  BetaToolUnion,
  BetaToolUseBlock
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type {
  ChatAttachment,
  ChatMessageSummary,
  ChatSessionSummary,
  ChatToolCall,
  ChatToolResult,
  ProjectSummary,
  WorktreeSummary
} from "@workhorse-station/shared";
import type { SkillMetadata } from "../skills/skill-loader.js";
import { HttpError } from "../projects/http-error.js";
import { getChatToolDefs, executeChatTool } from "./chat-tools.js";
import type { ChatMessageWriteInput } from "./chat-repository.js";
import type { Database } from "sql.js";

export const MODEL = "claude-opus-4-7";
export const MAX_TOKENS = 2400;
export const MAX_TOOL_ITERATIONS = 5;

let client: Anthropic | null = null;

export type GenerateChatReplyInput = {
  chatSession: ChatSessionSummary;
  project: ProjectSummary | null;
  worktree: WorktreeSummary | null;
  db: Database;
};

export type GenerateChatReplyResult = {
  messages: ChatMessageWriteInput[];
};

export async function generateChatReply(input: GenerateChatReplyInput): Promise<GenerateChatReplyResult> {
  const anthropic = getClient();
  const toolDefs = getChatToolDefs();
  const tools: BetaToolUnion[] = toolDefs as BetaToolUnion[];
  const system = buildSystemPrompt(input.project, input.worktree);

  const collected: ChatMessageWriteInput[] = [];
  const history = input.chatSession.messages ?? [];
  let messages = toBetaMessages(history);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      tools,
      tool_choice: { type: "auto" },
      thinking: { type: "disabled" }
    });

    const textBlocks = response.content.filter((b) => b.type === "text") as { type: "text"; text: string }[];
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as BetaToolUseBlock[];
    const replyText = textBlocks.map((b) => b.text).join("\n").trim();

    if (toolUseBlocks.length === 0) {
      collected.push({
        id: randomUUID(),
        chatSessionId: input.chatSession.id,
        role: "assistant",
        content: replyText,
        attachments: [],
        artifactSuggestions: [],
        toolCalls: [],
        toolResults: []
      });

      messages.push({ role: "assistant", content: replyText });
      break;
    }

    const toolCalls: ChatToolCall[] = toolUseBlocks.map((b) => ({
      id: b.id,
      name: b.name,
      input: (b.input ?? {}) as Record<string, unknown>,
      status: "executed" as const
    }));

    collected.push({
      id: randomUUID(),
      chatSessionId: input.chatSession.id,
      role: "assistant",
      content: replyText,
      attachments: [],
      artifactSuggestions: [],
      toolCalls,
      toolResults: []
    });

    const assistantContent: unknown[] = [];
    if (replyText) {
      assistantContent.push({ type: "text", text: replyText });
    }
    for (const b of toolUseBlocks) {
      assistantContent.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
    }
    messages.push({ role: "assistant", content: assistantContent as BetaMessageParam["content"] });

    const toolResults: ChatToolResult[] = [];
    const toolResultContent: unknown[] = [];

    for (const block of toolUseBlocks) {
      const result = await executeChatTool(input.db, block.name, (block.input ?? {}) as Record<string, unknown>);
      toolResults.push({
        toolCallId: block.id,
        result: result.result,
        isError: result.isError
      });
      toolResultContent.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.result,
        is_error: result.isError
      });
    }

    collected.push({
      id: randomUUID(),
      chatSessionId: input.chatSession.id,
      role: "user",
      content: "",
      attachments: [],
      artifactSuggestions: [],
      toolCalls: [],
      toolResults
    });

    messages.push({ role: "user", content: toolResultContent as BetaMessageParam["content"] });

    if (response.stop_reason === "end_turn") {
      break;
    }
  }

  return { messages: collected };
}

export function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? null;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN ?? null;
  const baseURL = process.env.ANTHROPIC_BASE_URL ?? null;

  if (!apiKey && !authToken) {
    throw new HttpError(503, "anthropic_api_key_missing", "服务端未配置 ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN");
  }

  client ??= new Anthropic({
    apiKey: apiKey ?? undefined,
    authToken: authToken ?? undefined,
    baseURL: baseURL ?? undefined
  });
  return client;
}

export function buildSystemPrompt(project: ProjectSummary | null, worktree: WorktreeSummary | null, skills?: SkillMetadata[]) {
  const lines = [
    "你是开发管理工作台首页聊天助手。",
    "你可以使用工具来搜索笔记、创建笔记、查看任务、创建任务、创建 Prompt 草稿以及注册和修改项目。",
    "重要规则：",
    "- 在创建新笔记前，先搜索是否已有相关笔记，避免重复。",
    "- 创建笔记/任务/Prompt 草稿后，直接告诉用户结果，不要重复创建。",
    "- 搜索笔记时可以跨项目搜索，也可以限定项目。",
    "- 如果用户没指定项目，创建笔记时可以不传 projectId（创建为全局笔记）。",
    "- 创建任务和 Prompt 草稿必须指定 projectId。",
    "- 当用户想要执行开发任务（如修复bug、添加功能）时，使用 create_prompt_draft。",
    "- 当用户想要注册新项目时，使用 create_project，需要提供项目名称和代码目录的绝对路径。",
    "- 当用户想要修改项目信息（名称、目录、分支、描述）时，使用 update_project，需要提供项目 ID 和要修改的字段。",
    `当前项目：${project ? `${project.name} (${project.path}, id=${project.id})` : "未选择项目"}`,
    `当前 worktree：${worktree ? `${worktree.name} (${worktree.branch})` : "未选择 worktree"}`,
    project ? `如果需要创建任务或 Prompt 草稿，使用 projectId="${project.id}"。` : "如果需要创建任务或 Prompt 草稿，请先让用户选择一个项目。"
  ];

  if (skills && skills.length > 0) {
    const skillLines = skills.map((s) => `- ${s.name}: ${s.description}`);
    lines.push(
      "",
      "可用技能（通过 Skill 工具调用）：",
      "当用户的任务与以下技能匹配时，使用 Skill 工具加载对应技能的完整指令，然后按照技能指令执行。",
      ...skillLines
    );
  }

  return lines.join("\n");
}

export function toBetaMessages(history: ChatMessageSummary[]): BetaMessageParam[] {
  const result: BetaMessageParam[] = [];

  for (const msg of history) {
    if (msg.toolCalls.length > 0) {
      const blocks: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }> = [];
      if (msg.content) {
        blocks.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      result.push({
        role: "assistant",
        content: blocks as BetaMessageParam["content"]
      });
    }

    if (msg.toolResults.length > 0) {
      result.push({
        role: "user",
        content: msg.toolResults.map((tr) => ({
          type: "tool_result" as const,
          tool_use_id: tr.toolCallId,
          content: tr.result,
          is_error: tr.isError
        })) as BetaMessageParam["content"]
      });
    }

    if (msg.toolCalls.length === 0 && msg.toolResults.length === 0) {
      result.push({
        role: msg.role as "user" | "assistant",
        content: renderMessageContent(msg.content, msg.attachments)
      });
    }
  }

  return result;
}

export function renderMessageContent(content: string, attachments: ChatAttachment[]) {
  if (!attachments.length) {
    return content;
  }

  const attachmentText = attachments
    .map(
      (attachment) =>
        `附件：${attachment.name}\nMIME: ${attachment.mimeType}\n大小: ${attachment.size} bytes\n内容:\n${attachment.textContent}`
    )
    .join("\n\n");

  return `${content || "请结合附件处理。"}\n\n${attachmentText}`;
}
