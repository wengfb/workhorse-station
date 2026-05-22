import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  ChatSessionResponse,
  ChatSessionsResponse,
  CreateChatMessageRequest,
  CreateChatSessionRequest,
  DeleteChatSessionResponse
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "../projects/http-error.js";
import { getProject } from "../projects/project-repository.js";
import { getProjectWorktree } from "../worktrees/worktree-repository.js";
import {
  appendChatMessage,
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatSessions,
  updateChatSessionContext,
  type ChatSessionWriteInput
} from "./chat-repository.js";
import { generateChatReply } from "./chat-service.js";

type ChatSessionParams = {
  chatSessionId: string;
};

export async function registerChatRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get("/api/chat-sessions", async (): Promise<ApiResponse<ChatSessionsResponse>> => ({
    ok: true,
    data: {
      chatSessions: listChatSessions(database.db)
    }
  }));

  server.post<{ Body: CreateChatSessionRequest }>("/api/chat-sessions", async (request, reply): Promise<ApiResponse<ChatSessionResponse>> => {
    const input = buildChatSessionInput(database, request.body);
    const title = normalizeSessionTitle(request.body?.title);
    const chatSession = createChatSession(database.db, {
      ...input,
      title
    });
    database.persist();
    reply.status(201);

    return {
      ok: true,
      data: { chatSession }
    };
  });

  server.post<{ Params: ChatSessionParams; Body: CreateChatMessageRequest }>(
    "/api/chat-sessions/:chatSessionId/messages",
    async (request): Promise<ApiResponse<ChatSessionResponse>> => {
      const currentSession = getChatSession(database.db, request.params.chatSessionId);

      if (!currentSession) {
        throw new HttpError(404, "chat_session_not_found", "聊天会话不存在");
      }

      const content = normalizeMessageContent(request.body?.content);
      const attachments = normalizeAttachments(request.body?.attachments);

      if (!content && !attachments.length) {
        throw new HttpError(400, "validation_error", "消息内容不能为空");
      }

      const input = buildChatSessionInput(database, {
        projectId: request.body?.projectId ?? currentSession.projectId,
        worktreeId: request.body?.worktreeId ?? currentSession.worktreeId
      });
      const title = deriveSessionTitle(currentSession.title, content, attachments);
      const updatedSession = updateChatSessionContext(database.db, currentSession.id, {
        ...input,
        title
      });

      if (!updatedSession) {
        throw new HttpError(404, "chat_session_not_found", "聊天会话不存在");
      }

      appendChatMessage(database.db, {
        chatSessionId: currentSession.id,
        role: "user",
        content,
        attachments,
        artifactSuggestions: []
      });
      database.persist();

      const project = input.projectId ? getProject(database.db, input.projectId) : null;
      const worktree = input.projectId && input.worktreeId ? getProjectWorktree(database.db, input.projectId, input.worktreeId) : null;
      const refreshedSession = getChatSession(database.db, currentSession.id);

      if (!refreshedSession) {
        throw new HttpError(404, "chat_session_not_found", "聊天会话不存在");
      }

      const assistant = await generateChatReply({
        chatSession: refreshedSession,
        project,
        worktree
      });

      appendChatMessage(database.db, {
        chatSessionId: currentSession.id,
        role: "assistant",
        content: assistant.reply,
        attachments: [],
        artifactSuggestions: assistant.artifactSuggestions
      });
      database.persist();

      return {
        ok: true,
        data: {
          chatSession: getChatSession(database.db, currentSession.id) ?? refreshedSession
        }
      };
    }
  );

  server.delete<{ Params: ChatSessionParams }>("/api/chat-sessions/:chatSessionId", async (request): Promise<ApiResponse<DeleteChatSessionResponse>> => {
    if (!deleteChatSession(database.db, request.params.chatSessionId)) {
      throw new HttpError(404, "chat_session_not_found", "聊天会话不存在");
    }

    database.persist();

    return {
      ok: true,
      data: { deleted: true }
    };
  });
}

function buildChatSessionInput(database: DatabaseState, body: Pick<CreateChatSessionRequest, "projectId" | "worktreeId"> | undefined): ChatSessionWriteInput {
  const projectId = normalizeOptionalId(body?.projectId, "项目 ID 不合法");
  const worktreeId = normalizeOptionalId(body?.worktreeId, "Worktree ID 不合法");

  if (!projectId && worktreeId) {
    throw new HttpError(400, "validation_error", "选择 worktree 时必须同时选择项目");
  }

  if (projectId && !getProject(database.db, projectId)) {
    throw new HttpError(400, "project_not_found", "项目不存在");
  }

  if (projectId && worktreeId && !getProjectWorktree(database.db, projectId, worktreeId)) {
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
