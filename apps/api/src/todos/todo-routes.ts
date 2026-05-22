import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  CreateTodoRequest,
  DeleteTodoResponse,
  TodoResponse,
  TodosResponse,
  TodoStatus,
  UpdateTodoRequest
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "../projects/http-error.js";
import { getProject } from "../projects/project-repository.js";
import { getProjectNote } from "../notes/note-repository.js";
import { createTodo, deleteTodo, getProjectTodo, listTodos, updateTodo, type TodoWriteInput } from "./todo-repository.js";

type ProjectParams = {
  projectId: string;
};

type ProjectTodoParams = ProjectParams & {
  todoId: string;
};

const todoStatuses: TodoStatus[] = ["draft", "pending", "in_progress", "completed"];

export async function registerTodoRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get<{ Params: ProjectParams }>("/api/projects/:projectId/todos", async (request): Promise<ApiResponse<TodosResponse>> => {
    assertProjectExists(database, request.params.projectId);

    return {
      ok: true,
      data: {
        todos: listTodos(database.db, request.params.projectId)
      }
    };
  });

  server.post<{ Params: ProjectParams; Body: CreateTodoRequest }>(
    "/api/projects/:projectId/todos",
    async (request, reply): Promise<ApiResponse<TodoResponse>> => {
      assertProjectExists(database, request.params.projectId);
      const input = buildTodoInput(database, request.params.projectId, request.body);
      const todo = createTodo(database.db, input);
      database.persist();
      reply.status(201);

      return {
        ok: true,
        data: { todo }
      };
    }
  );

  server.patch<{ Params: ProjectTodoParams; Body: UpdateTodoRequest }>(
    "/api/projects/:projectId/todos/:todoId",
    async (request): Promise<ApiResponse<TodoResponse>> => {
      assertProjectExists(database, request.params.projectId);
      const currentTodo = getProjectTodo(database.db, request.params.projectId, request.params.todoId);

      if (!currentTodo) {
        throw new HttpError(404, "todo_not_found", "待办不存在");
      }

      const input = buildTodoInput(database, request.params.projectId, {
        title: request.body?.title ?? currentTodo.title,
        description: request.body?.description ?? currentTodo.description,
        status: request.body?.status ?? currentTodo.status,
        tags: request.body?.tags ?? currentTodo.tags,
        sourceNoteId: request.body?.sourceNoteId === undefined ? currentTodo.sourceNoteId : request.body.sourceNoteId
      });
      const todo = updateTodo(database.db, request.params.projectId, request.params.todoId, input);
      database.persist();

      if (!todo) {
        throw new HttpError(404, "todo_not_found", "待办不存在");
      }

      return {
        ok: true,
        data: { todo }
      };
    }
  );

  server.delete<{ Params: ProjectTodoParams }>(
    "/api/projects/:projectId/todos/:todoId",
    async (request): Promise<ApiResponse<DeleteTodoResponse>> => {
      assertProjectExists(database, request.params.projectId);

      if (!deleteTodo(database.db, request.params.projectId, request.params.todoId)) {
        throw new HttpError(404, "todo_not_found", "待办不存在");
      }

      database.persist();

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );
}

function assertProjectExists(database: DatabaseState, projectId: string) {
  if (!getProject(database.db, projectId)) {
    throw new HttpError(404, "project_not_found", "项目不存在");
  }
}

function buildTodoInput(database: DatabaseState, projectId: string, body: CreateTodoRequest | undefined): TodoWriteInput {
  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  const sourceNoteId = normalizeSourceNoteId(body.sourceNoteId);

  if (sourceNoteId && !getProjectNote(database.db, projectId, sourceNoteId)) {
    throw new HttpError(400, "source_note_not_found", "来源笔记不存在或不属于当前项目");
  }

  return {
    projectId,
    title: normalizeTitle(body.title),
    description: normalizeDescription(body.description),
    status: normalizeStatus(body.status),
    tags: normalizeTags(body.tags),
    sourceNoteId,
    sourceChatSuggestion: null
  };
}

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "待办标题不能为空");
  }

  const title = value.trim();

  if (!title) {
    throw new HttpError(400, "validation_error", "待办标题不能为空");
  }

  if (title.length > 120) {
    throw new HttpError(400, "validation_error", "待办标题不能超过 120 个字符");
  }

  return title;
}

function normalizeDescription(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "待办描述必须是文本");
  }

  if (value.length > 20000) {
    throw new HttpError(400, "validation_error", "待办描述不能超过 20000 个字符");
  }

  return value;
}

function normalizeStatus(value: unknown): TodoStatus {
  if (value === undefined) {
    return "pending";
  }

  if (typeof value !== "string" || !todoStatuses.includes(value as TodoStatus)) {
    throw new HttpError(400, "validation_error", "待办状态不合法");
  }

  return value as TodoStatus;
}

function normalizeTags(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    throw new HttpError(400, "validation_error", "待办标签必须是字符串数组");
  }

  const tags = value.map((tag) => tag.trim()).filter(Boolean);

  if (tags.some((tag) => tag.length > 30)) {
    throw new HttpError(400, "validation_error", "单个标签不能超过 30 个字符");
  }

  return tags;
}

function normalizeSourceNoteId(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "来源笔记 ID 不合法");
  }

  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
