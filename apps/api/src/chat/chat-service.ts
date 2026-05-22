import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatArtifactSuggestion,
  ChatAttachment,
  ChatMessageSummary,
  ChatSessionSummary,
  TodoStatus,
  ProjectSummary,
  WorktreeSummary
} from "@workhorse-station/shared";
import { HttpError } from "../projects/http-error.js";

const model = "claude-opus-4-7";
const maxTokens = 1800;

let client: Anthropic | null = null;

export type GenerateChatReplyInput = {
  chatSession: ChatSessionSummary;
  project: ProjectSummary | null;
  worktree: WorktreeSummary | null;
};

export type GenerateChatReplyResult = {
  reply: string;
  artifactSuggestions: ChatArtifactSuggestion[];
};

type StructuredSuggestion = {
  type: "note" | "todo" | "prompt_draft";
  title: string;
  content: string;
  description?: string;
  tags?: string[];
  status?: TodoStatus;
};

type StructuredChatResponse = {
  reply: string;
  artifactSuggestions?: StructuredSuggestion[];
};

type ParsedChatReply = {
  reply: string;
  artifactSuggestions: ChatArtifactSuggestion[];
};

export async function generateChatReply(input: GenerateChatReplyInput): Promise<GenerateChatReplyResult> {
  const anthropic = getClient();
  const messages = buildMessages(input.chatSession.messages);
  const system = buildSystemPrompt(input.project, input.worktree);

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      // SDK 类型暂未覆盖 adaptive thinking，这里按官方文档直传。
      // @ts-expect-error adaptive thinking is supported by the API
      thinking: { type: "adaptive", display: "summarized" },
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply: { type: "string" },
              artifactSuggestions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    type: { type: "string", enum: ["note", "todo", "prompt_draft"] },
                    title: { type: "string" },
                    content: { type: "string" },
                    description: { type: "string" },
                    tags: {
                      type: "array",
                      items: { type: "string" }
                    },
                    status: { type: "string", enum: ["draft", "pending", "in_progress", "completed"] }
                  },
                  required: ["type", "title", "content"]
                }
              }
            },
            required: ["reply"]
          }
        }
      }
    });

    const text = extractText(response.content);
    const parsed = parseStructuredResponse(text);

    return {
      reply: parsed.reply,
      artifactSuggestions: parsed.artifactSuggestions ?? []
    };
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      const apiError = error as Error & { status?: number };
      throw new HttpError(apiError.status ?? 502, "anthropic_api_error", apiError.message);
    }

    throw error;
  }
}

function getClient() {
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

function buildSystemPrompt(project: ProjectSummary | null, worktree: WorktreeSummary | null) {
  return [
    "你是开发管理工作台首页聊天助手。",
    "你的职责是：回复用户，并在合适时生成可供用户确认的草稿建议。",
    "只能输出 JSON，字段必须符合 schema。",
    "AI 输出只能作为草稿建议，不能假设已经创建了笔记、任务或 prompt。",
    "如果用户是在整理开发工作，优先生成 note、todo、prompt_draft 建议。",
    `当前项目：${project ? `${project.name} (${project.path})` : "未选择项目"}`,
    `当前 worktree：${worktree ? `${worktree.name} (${worktree.branch})` : "未选择 worktree"}`
  ].join("\n");
}

function buildMessages(history: ChatMessageSummary[]) {
  return history.map((message) => ({
    role: message.role,
    content: [{ type: "text" as const, text: renderMessageContent(message.content, message.attachments) }]
  }));
}

function renderMessageContent(content: string, attachments: ChatAttachment[]) {
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

function extractText(content: Array<{ type: string; text?: string }>) {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function parseStructuredResponse(raw: string): ParsedChatReply {
  try {
    const parsed = JSON.parse(raw) as StructuredChatResponse;
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";

    if (!reply) {
      throw new Error("Missing reply");
    }

    return {
      reply,
      artifactSuggestions: Array.isArray(parsed.artifactSuggestions) ? parsed.artifactSuggestions.map(toArtifactSuggestion) : []
    };
  } catch {
    return {
      reply: raw || "已收到你的消息，但本次结构化建议解析失败。",
      artifactSuggestions: []
    };
  }
}

function toArtifactSuggestion(suggestion: StructuredSuggestion): ChatArtifactSuggestion {
  return {
    id: `${suggestion.type}-${Math.random().toString(36).slice(2, 10)}`,
    type: suggestion.type,
    title: suggestion.title,
    content: suggestion.content,
    description: suggestion.description,
    tags: Array.isArray(suggestion.tags) ? suggestion.tags.filter((tag) => typeof tag === "string") : undefined,
    status: suggestion.status
  };
}
