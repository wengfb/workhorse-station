import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  ApplyChatSuggestionRequest,
  ApplyChatSuggestionResponse,
  AppliedChatSuggestionTarget,
  ChatArtifactSuggestion,
  ChatArtifactSourceRef,
  ChatSessionResponse,
  ChatSessionsResponse,
  ConfirmToolRequest,
  CreateChatMessageRequest,
  CreateChatSessionRequest,
  DeleteChatSessionResponse
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { createNote, getProjectNote } from "../notes/note-repository.js";
import { HttpError } from "../projects/http-error.js";
import { createPromptDraft, getProjectPromptDraft } from "../prompt-drafts/prompt-draft-repository.js";
import { createTodo, getProjectTodo } from "../todos/todo-repository.js";
import { getProject } from "../projects/project-repository.js";
import { getProjectWorktree } from "../worktrees/worktree-repository.js";
import {
  appendChatMessage,
  createChatSession,
  deleteChatSession,
  getChatSession,
  getChatSessionMessage,
  listChatSessions,
  truncateChatMessages,
  updateChatMessageArtifactSuggestions,
  updateChatSessionContext,
  type ChatSessionWriteInput
} from "./chat-repository.js";
import { ChatStreamHandler, registerStreamHandler, getStreamHandler, unregisterStreamHandler } from "./chat-stream-handler.js";

type ChatSessionParams = {
  chatSessionId: string;
};

type ChatSuggestionParams = ChatSessionParams & {
  chatMessageId: string;
  suggestionId: string;
};

export async function registerChatRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get("/api/chat-sessions", async (): Promise<ApiResponse<ChatSessionsResponse>> => ({
    ok: true,
    data: {
      chatSessions: await listChatSessions(database.db)
    }
  }));

  server.post<{ Body: CreateChatSessionRequest }>("/api/chat-sessions", async (request, reply): Promise<ApiResponse<ChatSessionResponse>> => {
    const input = await buildChatSessionInput(database, request.body);
    const title = normalizeSessionTitle(request.body?.title);
    const chatSession = await createChatSession(database.db, {
      ...input,
      title
    });
    await database.persist();
    reply.status(201);

    return {
      ok: true,
      data: { chatSession }
    };
  });

  server.post<{ Params: ChatSessionParams; Body: CreateChatMessageRequest }>(
    "/api/chat-sessions/:chatSessionId/messages",
    async (request, reply) => {
      const currentSession = await getChatSession(database.db, request.params.chatSessionId);

      if (!currentSession) {
        throw new HttpError(404, "chat_session_not_found", "聊天会话不存在");
      }

      const content = normalizeMessageContent(request.body?.content);
      const attachments = normalizeAttachments(request.body?.attachments);

      if (!content && !attachments.length) {
        throw new HttpError(400, "validation_error", "消息内容不能为空");
      }

      const input = await buildChatSessionInput(database, {
        projectId: request.body?.projectId ?? currentSession.projectId,
        worktreeId: request.body?.worktreeId ?? currentSession.worktreeId
      });
      const title = deriveSessionTitle(currentSession.title, content, attachments);
      await updateChatSessionContext(database.db, currentSession.id, {
        ...input,
        title
      });

      await appendChatMessage(database.db, {
        chatSessionId: currentSession.id,
        role: "user",
        content,
        attachments,
        artifactSuggestions: [],
        toolCalls: [],
        toolResults: []
      });
      await database.persist();

      const project = input.projectId ? await getProject(database.db, input.projectId) : null;
      const worktree = input.projectId && input.worktreeId ? await getProjectWorktree(database.db, input.projectId, input.worktreeId) : null;

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      reply.raw.write("\n");

      const handler = new ChatStreamHandler(
        currentSession.id,
        database,
        project,
        worktree,
        (event) => {
          if (reply.raw.writable) {
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        }
      );

      registerStreamHandler(currentSession.id, handler);

      request.raw.socket?.on("close", () => {
        handler.destroy();
        unregisterStreamHandler(currentSession.id);
      });

      try {
        await handler.processMessage(content, attachments);
      } catch (err) {
        console.error("[ChatRoute] processMessage error:", err);
      } finally {
        unregisterStreamHandler(currentSession.id);
        if (reply.raw.writable) {
          reply.raw.end();
        }
      }
    }
  );

  server.post<{ Params: ChatSuggestionParams; Body: ApplyChatSuggestionRequest }>(
    "/api/chat-sessions/:chatSessionId/messages/:chatMessageId/suggestions/:suggestionId/apply",
    async (request): Promise<ApiResponse<ApplyChatSuggestionResponse>> => {
      const chatSession = await getChatSession(database.db, request.params.chatSessionId);

      if (!chatSession) {
        throw new HttpError(404, "chat_session_not_found", "聊天会话不存在");
      }

      const message = await getChatSessionMessage(database.db, chatSession.id, request.params.chatMessageId);

      if (!message || message.role !== "assistant") {
        throw new HttpError(404, "chat_message_not_found", "聊天建议消息不存在");
      }

      const suggestion = message.artifactSuggestions.find((item) => item.id === request.params.suggestionId);

      if (!suggestion) {
        throw new HttpError(404, "chat_suggestion_not_found", "聊天建议不存在");
      }

      const context = await buildChatSessionInput(database, {
        projectId: request.body?.projectId ?? chatSession.projectId,
        worktreeId: request.body?.worktreeId ?? chatSession.worktreeId
      });

      if (!context.projectId) {
        throw new HttpError(400, "project_required", "保存聊天建议前需先选择项目");
      }

      const existingTarget = await readAppliedSuggestionTarget(database, suggestion);

      if (existingTarget) {
        return {
          ok: true,
          data: {
            chatSession,
            suggestion,
            target: existingTarget,
            deduped: true
          }
        };
      }

      const sourceChatSuggestion: ChatArtifactSourceRef = {
        chatSessionId: chatSession.id,
        chatMessageId: message.id,
        suggestionId: suggestion.id
      };
      const target = await createAppliedSuggestionTarget(database, suggestion, context.projectId, context.worktreeId, sourceChatSuggestion);
      const savedSuggestion = markSuggestionSaved(suggestion, target.type, getAppliedTargetId(target), context.projectId, context.worktreeId);
      const nextSuggestions = message.artifactSuggestions.map((item) => (item.id === suggestion.id ? savedSuggestion : item));
      await updateChatMessageArtifactSuggestions(database.db, chatSession.id, message.id, nextSuggestions);
      await database.persist();

      return {
        ok: true,
        data: {
          chatSession: (await getChatSession(database.db, chatSession.id)) ?? chatSession,
          suggestion: savedSuggestion,
          target,
          deduped: false
        }
      };
    }
  );

  server.delete<{ Params: ChatSessionParams }>("/api/chat-sessions/:chatSessionId", async (request): Promise<ApiResponse<DeleteChatSessionResponse>> => {
    if (!(await deleteChatSession(database.db, request.params.chatSessionId))) {
      throw new HttpError(404, "chat_session_not_found", "聊天会话不存在");
    }

    await database.persist();

    return {
      ok: true,
      data: { deleted: true }
    };
  });

  server.delete<{ Params: ChatSessionParams; Querystring: { from: string } }>(
    "/api/chat-sessions/:chatSessionId/messages",
    async (request): Promise<ApiResponse<ChatSessionsResponse>> => {
      const { chatSessionId } = request.params;
      const { from } = request.query;

      if (!from) {
        throw new HttpError(400, "missing_from", "缺少 from 参数");
      }

      const session = await truncateChatMessages(database.db, chatSessionId, from);

      if (!session) {
        throw new HttpError(404, "chat_session_not_found", "聊天会话不存在");
      }

      await database.persist();

      return {
        ok: true,
        data: { chatSessions: [session] }
      };
    }
  );

  server.post<{ Params: ChatSessionParams; Body: ConfirmToolRequest }>(
    "/api/chat-sessions/:chatSessionId/confirm-tool",
    async (request): Promise<ApiResponse<{ confirmed: boolean }>> => {
      const handler = getStreamHandler(request.params.chatSessionId);

      if (!handler) {
        throw new HttpError(404, "stream_not_found", "没有活跃的聊天流");
      }

      handler.confirmTool(request.body.toolCallId, request.body.approved);

      return {
        ok: true,
        data: { confirmed: true }
      };
    }
  );
}

async function readAppliedSuggestionTarget(database: DatabaseState, suggestion: ChatArtifactSuggestion): Promise<AppliedChatSuggestionTarget | null> {
  if (suggestion.adoption?.status !== "saved" || !suggestion.adoption.targetType || !suggestion.adoption.targetId || !suggestion.adoption.projectId) {
    return null;
  }

  if (suggestion.adoption.targetType === "note") {
    const note = await getProjectNote(database.db, suggestion.adoption.projectId, suggestion.adoption.targetId);
    return note ? { type: "note", note } : null;
  }

  if (suggestion.adoption.targetType === "todo") {
    const todo = await getProjectTodo(database.db, suggestion.adoption.projectId, suggestion.adoption.targetId);
    return todo ? { type: "todo", todo } : null;
  }

  const promptDraft = await getProjectPromptDraft(database.db, suggestion.adoption.projectId, suggestion.adoption.targetId);
  return promptDraft ? { type: "prompt_draft", promptDraft } : null;
}

async function createAppliedSuggestionTarget(
  database: DatabaseState,
  suggestion: ChatArtifactSuggestion,
  projectId: string,
  worktreeId: string | null,
  sourceChatSuggestion: ChatArtifactSourceRef
): Promise<AppliedChatSuggestionTarget> {
  const title = normalizeSuggestionTitle(suggestion.title);
  const content = normalizeSuggestionContent(suggestion.content, suggestion.type === "prompt_draft" ? 40000 : 20000);
  const tags = normalizeSuggestionTags(suggestion.tags);

  if (suggestion.type === "note") {
    const note = await createNote(database.db, {
      projectId,
      title,
      content,
      tags,
      sourceChatSuggestion
    });
    return { type: "note", note };
  }

  if (suggestion.type === "todo") {
    const todo = await createTodo(database.db, {
      projectId,
      title,
      description: normalizeSuggestionDescription(suggestion.description ?? content),
      status: normalizeSuggestionTodoStatus(suggestion.status),
      tags,
      sourceNoteId: null,
      sourceChatSuggestion
    });
    return { type: "todo", todo };
  }

  const promptDraft = await createPromptDraft(database.db, {
    projectId,
    todoId: null,
    worktreeId,
    requestedWorktreeName: null,
    source: "direct",
    title,
    prompt: content,
    status: "draft",
    sourceChatSuggestion
  });
  return { type: "prompt_draft", promptDraft };
}

function normalizeSuggestionTitle(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "草稿标题不能为空");
  }

  const title = value.trim();

  if (!title) {
    throw new HttpError(400, "validation_error", "草稿标题不能为空");
  }

  if (title.length > 120) {
    throw new HttpError(400, "validation_error", "草稿标题不能超过 120 个字符");
  }

  return title;
}

function normalizeSuggestionContent(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "草稿内容不能为空");
  }

  const content = value.trim();

  if (!content) {
    throw new HttpError(400, "validation_error", "草稿内容不能为空");
  }

  if (content.length > maxLength) {
    throw new HttpError(400, "validation_error", `草稿内容不能超过 ${maxLength} 个字符`);
  }

  return content;
}

function normalizeSuggestionDescription(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "任务描述必须是文本");
  }

  if (value.length > 20000) {
    throw new HttpError(400, "validation_error", "任务描述不能超过 20000 个字符");
  }

  return value;
}

function normalizeSuggestionTags(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    throw new HttpError(400, "validation_error", "草稿标签必须是字符串数组");
  }

  const tags = value.map((tag) => tag.trim()).filter(Boolean);

  if (tags.some((tag) => tag.length > 30)) {
    throw new HttpError(400, "validation_error", "单个标签不能超过 30 个字符");
  }

  return tags;
}

function normalizeSuggestionTodoStatus(value: unknown) {
  if (value === undefined) {
    return "draft";
  }

  if (value !== "draft" && value !== "pending" && value !== "in_progress" && value !== "completed") {
    throw new HttpError(400, "validation_error", "任务状态不合法");
  }

  return value;
}

function markSuggestionSaved(
  suggestion: ChatArtifactSuggestion,
  targetType: ChatArtifactSuggestion["type"],
  targetId: string,
  projectId: string,
  worktreeId: string | null
): ChatArtifactSuggestion {
  return {
    ...suggestion,
    adoption: {
      status: "saved",
      targetType,
      targetId,
      projectId,
      worktreeId,
      adoptedAt: new Date().toISOString()
    }
  };
}

function getAppliedTargetId(target: AppliedChatSuggestionTarget) {
  if (target.type === "note") {
    return target.note.id;
  }

  if (target.type === "todo") {
    return target.todo.id;
  }

  return target.promptDraft.id;
}

async function buildChatSessionInput(database: DatabaseState, body: Pick<CreateChatSessionRequest, "projectId" | "worktreeId"> | undefined): Promise<ChatSessionWriteInput> {
  const projectId = normalizeOptionalId(body?.projectId, "项目 ID 不合法");
  const worktreeId = normalizeOptionalId(body?.worktreeId, "Worktree ID 不合法");

  if (!projectId && worktreeId) {
    throw new HttpError(400, "validation_error", "选择 worktree 时必须同时选择项目");
  }

  if (projectId && !(await getProject(database.db, projectId))) {
    throw new HttpError(400, "project_not_found", "项目不存在");
  }

  if (projectId && worktreeId && !(await getProjectWorktree(database.db, projectId, worktreeId))) {
    throw new HttpError(400, "worktree_not_found", "Worktree 不存在或不属于当前项目");
  }

  return {
    projectId,
    worktreeId,
    title: "新聊天"
  };
}

function normalizeSessionTitle(value: unknown) {
  if (typeof value !== "string") {
    return "新聊天";
  }

  const title = value.trim();
  return title ? title.slice(0, 120) : "新聊天";
}

function normalizeMessageContent(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "消息内容必须是文本");
  }

  const content = value.trim();

  if (content.length > 20000) {
    throw new HttpError(400, "validation_error", "消息内容不能超过 20000 个字符");
  }

  return content;
}

function normalizeAttachments(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, "validation_error", "附件格式不合法");
  }

  return value.map((attachment) => {
    if (!isObject(attachment)) {
      throw new HttpError(400, "validation_error", "附件格式不合法");
    }

    if (typeof attachment.name !== "string" || typeof attachment.mimeType !== "string" || typeof attachment.size !== "number" || typeof attachment.textContent !== "string") {
      throw new HttpError(400, "validation_error", "附件格式不合法");
    }

    if (attachment.textContent.length > 30000) {
      throw new HttpError(400, "validation_error", "单个附件内容不能超过 30000 个字符");
    }

    return {
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      textContent: attachment.textContent
    };
  });
}

function deriveSessionTitle(currentTitle: string, content: string, attachments: Array<{ name: string }>) {
  if (currentTitle !== "新聊天") {
    return currentTitle;
  }

  const candidate = content || attachments[0]?.name || "新聊天";
  return candidate.trim().slice(0, 40) || "新聊天";
}

function normalizeOptionalId(value: unknown, message: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", message);
  }

  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
