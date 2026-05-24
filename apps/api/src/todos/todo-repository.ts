import { randomUUID } from "node:crypto";
import type { ChatArtifactSourceRef, CreateTodoRequest, SessionResultSummary, TodoStatus, TodoSummary } from "@workhorse-station/shared";
import type { Database } from "sql.js";

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

export function listTodos(db: Database, projectId: string, opts?: { page?: number; pageSize?: number; search?: string; tags?: string[] }) {
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

export function countTodos(db: Database, projectId: string, opts?: { search?: string; tags?: string[] }) {
  const { where, params } = buildWhere(projectId, opts);
  const sql = `SELECT COUNT(*) as count FROM todos ${where}`;
  const stmt = db.prepare(sql, params);
  try {
    if (stmt.step()) {
      return (stmt.getAsObject() as { count: number }).count;
    }
    return 0;
  } finally {
    stmt.free();
  }
}

function buildWhere(projectId: string, opts?: { search?: string; tags?: string[] }): { where: string; params: string[] } {
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
      params.push(`%"${tag}"%`);
    }
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, params };
}

export function getProjectTodo(db: Database, projectId: string, todoId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, source_note_id, title, description, status, tags, latest_session_result, source_chat_suggestion_json, created_at, updated_at
     FROM todos
     WHERE project_id = ? AND id = ?`,
    [projectId, todoId]
  );
}

export function createTodo(db: Database, input: TodoWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO todos (id, project_id, source_note_id, title, description, status, tags, latest_session_result, source_chat_suggestion_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [id, input.projectId, input.sourceNoteId, input.title, input.description, input.status, JSON.stringify(input.tags), serializeSourceChatSuggestion(input.sourceChatSuggestion)]
  );

  const todo = getProjectTodo(db, input.projectId, id);

  if (!todo) {
    throw new Error("Failed to read created todo");
  }

  return todo;
}

export function updateTodoLatestSessionResult(db: Database, projectId: string, todoId: string, latestSessionResult: SessionResultSummary | null) {
  db.run(
    `UPDATE todos
     SET latest_session_result = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [latestSessionResult ? JSON.stringify(latestSessionResult) : null, projectId, todoId]
  );

  return getProjectTodo(db, projectId, todoId);
}

export function updateTodo(db: Database, projectId: string, todoId: string, input: TodoWriteInput) {
  db.run(
    `UPDATE todos
     SET source_note_id = ?, title = ?, description = ?, status = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [input.sourceNoteId, input.title, input.description, input.status, JSON.stringify(input.tags), projectId, todoId]
  );

  return getProjectTodo(db, projectId, todoId);
}

export function deleteTodo(db: Database, projectId: string, todoId: string) {
  db.run("DELETE FROM todos WHERE project_id = ? AND id = ?", [projectId, todoId]);
  return db.getRowsModified() > 0;
}

function selectRows(db: Database, sql: string, params: string[]) {
  const statement = db.prepare(sql, params);
  const rows: TodoSummary[] = [];

  try {
    while (statement.step()) {
      rows.push(mapTodoRow(statement.getAsObject() as TodoRow));
    }
  } finally {
    statement.free();
  }

  return rows;
}

function selectOne(db: Database, sql: string, params: string[]) {
  const statement = db.prepare(sql, params);

  try {
    if (!statement.step()) {
      return null;
    }

    return mapTodoRow(statement.getAsObject() as TodoRow);
  } finally {
    statement.free();
  }
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
