import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  CreatePromptDraftPreviewRequest,
  CreatePromptDraftRequest,
  PromptDraftPreviewResponse,
  PromptDraftResponse,
  PromptDraftsResponse,
  PromptDraftStatus,
  SessionSource,
  UpdatePromptDraftRequest
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { getProject } from "../projects/project-repository.js";
import { HttpError } from "../projects/http-error.js";
import { requireProject } from "../utils/session-utils.js";
import { getProjectTodo } from "../todos/todo-repository.js";
import { getProjectWorktree } from "../worktrees/worktree-repository.js";
import { buildPromptPreview } from "./prompt-preview.js";
import { createPromptDraft, getProjectPromptDraft, listPromptDrafts, updatePromptDraft, type PromptDraftWriteInput } from "./prompt-draft-repository.js";

type ProjectParams = {
  projectId: string;
};

type ProjectPromptDraftParams = ProjectParams & {
  draftId: string;
};

const promptDraftStatuses: PromptDraftStatus[] = ["draft", "confirmed", "archived"];
const sessionSources: SessionSource[] = ["direct", "todo"];

export async function registerPromptDraftRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get<{ Params: ProjectParams }>("/api/projects/:projectId/prompt-drafts", async (request): Promise<ApiResponse<PromptDraftsResponse>> => {
    await assertProjectExists(database, request.params.projectId);

    return {
      ok: true,
      data: {
        promptDrafts: await listPromptDrafts(database.db, request.params.projectId)
      }
    };
  });

  server.post<{ Params: ProjectParams; Body: CreatePromptDraftPreviewRequest }>(
    "/api/projects/:projectId/prompt-drafts/preview",
    async (request): Promise<ApiResponse<PromptDraftPreviewResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const previewInput = normalizePreviewInput(request.body);
      const todo = previewInput.todoId ? await requireTodo(database, project.id, previewInput.todoId) : null;
      const worktree = previewInput.worktreeId ? await requireWorktree(database, project.id, previewInput.worktreeId) : null;
      const preview = buildPromptPreview({
        project,
        todo,
        worktree,
        input: previewInput
      });

      return {
        ok: true,
        data: preview
      };
    }
  );

  server.post<{ Params: ProjectParams; Body: CreatePromptDraftRequest }>(
    "/api/projects/:projectId/prompt-drafts",
    async (request, reply): Promise<ApiResponse<PromptDraftResponse>> => {
      await assertProjectExists(database, request.params.projectId);
      const input = await buildPromptDraftInput(database, request.params.projectId, request.body);
      const promptDraft = await createPromptDraft(database.db, input);
      await database.persist();
      reply.status(201);

      return {
        ok: true,
        data: { promptDraft }
      };
    }
  );

  server.patch<{ Params: ProjectPromptDraftParams; Body: UpdatePromptDraftRequest }>(
    "/api/projects/:projectId/prompt-drafts/:draftId",
    async (request): Promise<ApiResponse<PromptDraftResponse>> => {
      await assertProjectExists(database, request.params.projectId);
      const currentPromptDraft = await getProjectPromptDraft(database.db, request.params.projectId, request.params.draftId);

      if (!currentPromptDraft) {
        throw new HttpError(404, "prompt_draft_not_found", "Prompt 草稿不存在");
      }

      const input = await buildPromptDraftInput(database, request.params.projectId, {
        todoId: request.body?.todoId === undefined ? currentPromptDraft.todoId : request.body.todoId,
        worktreeId: request.body?.worktreeId === undefined ? currentPromptDraft.worktreeId : request.body.worktreeId,
        requestedWorktreeName:
          request.body?.requestedWorktreeName === undefined ? currentPromptDraft.requestedWorktreeName : request.body.requestedWorktreeName,
        source: request.body?.source ?? currentPromptDraft.source,
        title: request.body?.title ?? currentPromptDraft.title,
        prompt: request.body?.prompt ?? currentPromptDraft.prompt,
        status: request.body?.status ?? currentPromptDraft.status
      });
      const promptDraft = await updatePromptDraft(database.db, request.params.projectId, request.params.draftId, input);
      await database.persist();

      if (!promptDraft) {
        throw new HttpError(404, "prompt_draft_not_found", "Prompt 草稿不存在");
      }

      return {
        ok: true,
        data: { promptDraft }
      };
    }
  );
}

async function assertProjectExists(database: DatabaseState, projectId: string) {
  if (!(await getProject(database.db, projectId))) {
    throw new HttpError(404, "project_not_found", "项目不存在");
  }
}

async function requireTodo(database: DatabaseState, projectId: string, todoId: string) {
  const todo = await getProjectTodo(database.db, projectId, todoId);

  if (!todo) {
    throw new HttpError(400, "todo_not_found", "待办不存在或不属于当前项目");
  }

  return todo;
}

async function requireWorktree(database: DatabaseState, projectId: string, worktreeId: string) {
  const worktree = await getProjectWorktree(database.db, projectId, worktreeId);

  if (!worktree) {
    throw new HttpError(400, "worktree_not_found", "Worktree 不存在或不属于当前项目");
  }

  return worktree;
}

async function buildPromptDraftInput(database: DatabaseState, projectId: string, body: CreatePromptDraftRequest | UpdatePromptDraftRequest | undefined): Promise<PromptDraftWriteInput> {
  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  const todoId = normalizeOptionalId(body.todoId, "待办 ID 不合法");
  const worktreeId = normalizeOptionalId(body.worktreeId, "Worktree ID 不合法");
  const requestedWorktreeName = normalizeRequestedWorktreeName(body.requestedWorktreeName);

  if (todoId) {
    await requireTodo(database, projectId, todoId);
  }

  if (worktreeId) {
    await requireWorktree(database, projectId, worktreeId);
  }

  return {
    projectId,
    todoId,
    worktreeId,
    requestedWorktreeName,
    source: normalizeSource(body.source),
    title: normalizeTitle(body.title),
    prompt: normalizePrompt(body.prompt),
    status: normalizeStatus(body.status),
    sourceChatSuggestion: null
  };
}

function normalizePreviewInput(body: CreatePromptDraftPreviewRequest | undefined): CreatePromptDraftPreviewRequest {
  if (body === undefined) {
    return {};
  }

  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  return {
    todoId: normalizeOptionalId(body.todoId, "待办 ID 不合法"),
    worktreeId: normalizeOptionalId(body.worktreeId, "Worktree ID 不合法"),
    requestedWorktreeName: normalizeRequestedWorktreeName(body.requestedWorktreeName),
    source: body.source === undefined ? undefined : normalizeSource(body.source),
    title: body.title === undefined || body.title === null ? null : normalizeTitle(body.title)
  };
}

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "Prompt 标题不能为空");
  }

  const title = value.trim();

  if (!title) {
    throw new HttpError(400, "validation_error", "Prompt 标题不能为空");
  }

  if (title.length > 120) {
    throw new HttpError(400, "validation_error", "Prompt 标题不能超过 120 个字符");
  }

  return title;
}

function normalizePrompt(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "Prompt 内容不能为空");
  }

  const prompt = value.trim();

  if (!prompt) {
    throw new HttpError(400, "validation_error", "Prompt 内容不能为空");
  }

  if (prompt.length > 40000) {
    throw new HttpError(400, "validation_error", "Prompt 内容不能超过 40000 个字符");
  }

  return value;
}

function normalizeStatus(value: unknown): PromptDraftStatus {
  if (value === undefined) {
    return "draft";
  }

  if (typeof value !== "string" || !promptDraftStatuses.includes(value as PromptDraftStatus)) {
    throw new HttpError(400, "validation_error", "Prompt 草稿状态不合法");
  }

  return value as PromptDraftStatus;
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

function normalizeRequestedWorktreeName(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "请求 Worktree 名称不合法");
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 64 || !/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new HttpError(400, "validation_error", "请求 Worktree 名称只能包含字母、数字、点、下划线和短横线");
  }

  return trimmed;
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
