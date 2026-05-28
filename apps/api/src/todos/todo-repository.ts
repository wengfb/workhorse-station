import { randomUUID } from "node:crypto";
import type { ChatArtifactSourceRef, CreateTodoRequest, SessionResultSummary, TodoStatus, TodoSummary } from "@workhorse-station/shared";
import type { DatabaseExecutor } from "../db/mysql.js";
import { execute, queryCount, queryOne, queryRows } from "../db/mysql.js";

type TodoRow = {
  id: string;
  project_id: string | null;
  source_note_id: string | null;
  title: string;
  description: string;
  status: TodoStatus;
  tags: string;
  latest_session_result: string | null;
  source_chat_suggestion_json: string | null;
  created_at: string;
  updated_at: string;
};

export type TodoWriteInput = Required<Pick<CreateTodoRequest, "title" | "status">> & {
  id?: string;
  projectId: string;
  description: string;
  tags: string[];
  sourceNoteId: string | null;
  sourceChatSuggestion: ChatArtifactSourceRef | null;
};

const TODO_SELECT = `SELECT id, project_id, source_note_id, title, description, status, tags, latest_session_result, source_chat_suggestion_json, created_at, updated_at
     FROM todos`;

export async function listTodos(db: DatabaseExecutor, projectId: string, opts?: { page?: number; pageSize?: number; search?: string; tags?: string[]; statuses?: TodoStatus[] }) {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 12;
  const offset = (page - 1) * pageSize;

  const { where, params } = buildWhere(projectId, opts);

  return selectRows(
    db,
    `${TODO_SELECT}
     ${where}
     ORDER BY updated_at DESC, created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
}

export async function countTodos(db: DatabaseExecutor, projectId: string, opts?: { search?: string; tags?: string[]; statuses?: TodoStatus[] }) {
  const { where, params } = buildWhere(projectId, opts);
  return queryCount(db, `SELECT COUNT(*) as count FROM todos ${where}`, params);
}

function buildWhere(projectId: string, opts?: { search?: string; tags?: string[]; statuses?: TodoStatus[] }): { where: string; params: string[] } {
  const clauses: string[] = ["project_id = ?"];
  const params: string[] = [projectId];

  if (opts?.search) {
    const pattern = `%${opts.search}%`;
    clauses.push("(title LIKE ? OR description LIKE ? OR tags LIKE ?)");
    params.push(pattern, pattern, pattern);
  }

  if (opts?.tags?.length) {
    for (const tag of opts.tags) {
      clauses.push("tags LIKE ?");
      params.push(`%\"${tag}\"%`);
    }
  }

  if (opts?.statuses?.length) {
    clauses.push(`status IN (${opts.statuses.map(() => "?").join(", ")})`);
    params.push(...opts.statuses);
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, params };
}

export async function getProjectTodo(db: DatabaseExecutor, projectId: string, todoId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, source_note_id, title, description, status, tags, latest_session_result, source_chat_suggestion_json, created_at, updated_at
     FROM todos
     WHERE project_id = ? AND id = ?`,
    [projectId, todoId]
  );
}

export async function createTodo(db: DatabaseExecutor, input: TodoWriteInput) {
  const id = input.id ?? randomUUID();
  await execute(
    db,
    `INSERT INTO todos (id, project_id, source_note_id, title, description, status, tags, latest_session_result, source_chat_suggestion_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [id, input.projectId, input.sourceNoteId, input.title, input.description, input.status, JSON.stringify(input.tags), serializeSourceChatSuggestion(input.sourceChatSuggestion)]
  );

  const todo = await getProjectTodo(db, input.projectId, id);

  if (!todo) {
    throw new Error("Failed to read created todo");
  }

  return todo;
}

export async function updateTodoLatestSessionResult(db: DatabaseExecutor, projectId: string, todoId: string, latestSessionResult: SessionResultSummary | null) {
  await execute(
    db,
    `UPDATE todos
     SET latest_session_result = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [latestSessionResult ? JSON.stringify(latestSessionResult) : null, projectId, todoId]
  );

  return getProjectTodo(db, projectId, todoId);
}

export async function updateTodo(db: DatabaseExecutor, projectId: string, todoId: string, input: TodoWriteInput) {
  await execute(
    db,
    `UPDATE todos
     SET source_note_id = ?, title = ?, description = ?, status = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [input.sourceNoteId, input.title, input.description, input.status, JSON.stringify(input.tags), projectId, todoId]
  );

  return getProjectTodo(db, projectId, todoId);
}

export async function deleteTodo(db: DatabaseExecutor, projectId: string, todoId: string) {
  return (await execute(db, "DELETE FROM todos WHERE project_id = ? AND id = ?", [projectId, todoId])) > 0;
}

async function selectRows(db: DatabaseExecutor, sql: string, params: string[]) {
  const rows = await queryRows<TodoRow>(db, sql, params);
  return rows.map(mapTodoRow);
}

async function selectOne(db: DatabaseExecutor, sql: string, params: string[]) {
  const row = await queryOne<TodoRow>(db, sql, params);
  return row ? mapTodoRow(row) : null;
}

function mapTodoRow(row: TodoRow): TodoSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceNoteId: row.source_note_id,
    title: row.title,
    description: row.description,
    status: row.status,
    tags: parseTags(row.tags),
    latestSessionResult: parseLatestSessionResult(row.latest_session_result),
    sourceChatSuggestion: parseSourceChatSuggestion(row.source_chat_suggestion_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseTags(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function parseLatestSessionResult(raw: string | null): SessionResultSummary | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SessionResultSummary;
    return parsed && typeof parsed.sessionId === "string" && typeof parsed.sessionName === "string" && typeof parsed.summary === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function serializeSourceChatSuggestion(source: ChatArtifactSourceRef | null) {
  return source ? JSON.stringify(source) : null;
}

function parseSourceChatSuggestion(raw: string | null): ChatArtifactSourceRef | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ChatArtifactSourceRef;
    return parsed && typeof parsed.chatSessionId === "string" && typeof parsed.chatMessageId === "string" && typeof parsed.suggestionId === "string" ? parsed : null;
  } catch {
    return null;
  }
}
