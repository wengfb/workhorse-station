import type { FastifyInstance } from "fastify";
import type { ApiResponse, CreateSessionRequest, DeleteSessionResponse, SessionResponse, SessionsResponse, SessionSource, SessionStatus, UpdateSessionRequest } from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { getProject } from "../projects/project-repository.js";
import { HttpError } from "../projects/http-error.js";
import { getProjectPromptDraft } from "../prompt-drafts/prompt-draft-repository.js";
import { getProjectTodo } from "../todos/todo-repository.js";
import { getProjectWorktree } from "../worktrees/worktree-repository.js";
import { createSessionRecord, deleteSessionRecord, getProjectSession, listSessions, updateSessionRecord, type SessionWriteInput } from "./session-repository.js";

type ProjectParams = {
  projectId: string;
};

type ProjectSessionParams = ProjectParams & {
  sessionId: string;
};

const sessionSources: SessionSource[] = ["direct", "todo"];
const sessionStatuses: SessionStatus[] = ["draft", "queued", "running", "completed"];

export async function registerSessionRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get<{ Params: ProjectParams }>("/api/projects/:projectId/sessions", async (request): Promise<ApiResponse<SessionsResponse>> => {
    assertProjectExists(database, request.params.projectId);

    return {
      ok: true,
      data: {
        sessions: listSessions(database.db, request.params.projectId)
      }
    };
  });

  server.post<{ Params: ProjectParams; Body: CreateSessionRequest }>("/api/projects/:projectId/sessions", async (request, reply): Promise<ApiResponse<SessionResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const input = buildSessionInput(database, request.params.projectId, request.body);
    const session = createSessionRecord(database.db, input);
    database.persist();
    reply.status(201);

    return {
      ok: true,
      data: { session }
    };
  });

  server.patch<{ Params: ProjectSessionParams; Body: UpdateSessionRequest }>("/api/projects/:projectId/sessions/:sessionId", async (request): Promise<ApiResponse<SessionResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const currentSession = getProjectSession(database.db, request.params.projectId, request.params.sessionId);

    if (!currentSession) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    const session = updateSessionRecord(database.db, request.params.projectId, request.params.sessionId, {
      name: normalizeName(request.body?.name ?? currentSession.name, currentSession.source, currentSession.todoId),
      status: normalizeStatus(request.body?.status ?? currentSession.status),
      summary: normalizeSummary(request.body?.summary === undefined ? currentSession.summary : request.body.summary)
    });
    database.persist();

    if (!session) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    return {
      ok: true,
      data: { session }
    };
  });

  server.delete<{ Params: ProjectSessionParams }>("/api/projects/:projectId/sessions/:sessionId", async (request): Promise<ApiResponse<DeleteSessionResponse>> => {
    assertProjectExists(database, request.params.projectId);

    if (!deleteSessionRecord(database.db, request.params.projectId, request.params.sessionId)) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    database.persist();

    return {
      ok: true,
      data: { deleted: true }
    };
  });
}

function assertProjectExists(database: DatabaseState, projectId: string) {
  if (!getProject(database.db, projectId)) {
    throw new HttpError(404, "project_not_found", "项目不存在");
  }
}

function buildSessionInput(database: DatabaseState, projectId: string, body: CreateSessionRequest | undefined): SessionWriteInput {
  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  const todoId = normalizeOptionalId(body.todoId, "待办 ID 不合法");
  const worktreeId = normalizeOptionalId(body.worktreeId, "Worktree ID 不合法");
  const promptDraftId = normalizeOptionalId(body.promptDraftId, "Prompt 草稿 ID 不合法");
  const requestedWorktreeName = normalizeRequestedWorktreeName(body.requestedWorktreeName);

  if (todoId && !getProjectTodo(database.db, projectId, todoId)) {
    throw new HttpError(400, "todo_not_found", "待办不存在或不属于当前项目");
  }

  if (worktreeId && !getProjectWorktree(database.db, projectId, worktreeId)) {
    throw new HttpError(400, "worktree_not_found", "Worktree 不存在或不属于当前项目");
  }

  if (promptDraftId && !getProjectPromptDraft(database.db, projectId, promptDraftId)) {
    throw new HttpError(400, "prompt_draft_not_found", "Prompt 草稿不存在或不属于当前项目");
  }

  const prompt = normalizePrompt(body.prompt);
  const source = normalizeSource(body.source);

  return {
    projectId,
    worktreeId,
    todoId,
    promptDraftId,
    requestedWorktreeName,
    source,
    name: normalizeName(body.name, source, todoId),
    prompt,
    status: normalizeStatus(body.status),
    summary: normalizeSummary(body.summary)
  };
}

function normalizePrompt(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "会话 Prompt 不能为空");
  }

  const prompt = value.trim();

  if (!prompt) {
    throw new HttpError(400, "validation_error", "会话 Prompt 不能为空");
  }

  if (prompt.length > 40000) {
    throw new HttpError(400, "validation_error", "会话 Prompt 不能超过 40000 个字符");
  }

  return value;
}

function normalizeName(value: unknown, source: SessionSource, todoId: string | null) {
  if (value === undefined || value === null || value === "") {
    return source === "todo" && todoId ? "待办会话" : "直接会话";
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "会话名称不合法");
  }

  const name = value.trim();

  if (!name) {
    throw new HttpError(400, "validation_error", "会话名称不能为空");
  }

  if (name.length > 120) {
    throw new HttpError(400, "validation_error", "会话名称不能超过 120 个字符");
  }

  return name;
}

function normalizeStatus(value: unknown): SessionStatus {
  if (value === undefined) {
    return "draft";
  }

  if (typeof value !== "string" || !sessionStatuses.includes(value as SessionStatus)) {
    throw new HttpError(400, "validation_error", "会话状态不合法");
  }

  return value as SessionStatus;
}

function normalizeSource(value: unknown): SessionSource {
  if (value === undefined) {
    return "direct";
  }

  if (typeof value !== "string" || !sessionSources.includes(value as SessionSource)) {
    throw new HttpError(400, "validation_error", "会话来源不合法");
  }

  return value as SessionSource;
}

function normalizeSummary(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "会话摘要必须是文本");
  }

  if (value.length > 20000) {
    throw new HttpError(400, "validation_error", "会话摘要不能超过 20000 个字符");
  }

  return value;
}

function normalizeRequestedWorktreeName(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "Worktree 名称不合法");
  }

  const name = value.trim();

  if (!name) {
    return null;
  }

  if (name.length > 120) {
    throw new HttpError(400, "validation_error", "Worktree 名称不能超过 120 个字符");
  }

  return name;
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
