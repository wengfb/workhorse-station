import { randomUUID } from "node:crypto";
import type { CreateTodoRequest, TodoStatus, TodoSummary } from "@workhorse-station/shared";
import type { Database } from "sql.js";

type TodoRow = {
  id: string;
  project_id: string | null;
  source_note_id: string | null;
  title: string;
  description: string;
  status: TodoStatus;
  tags: string;
  created_at: string;
  updated_at: string;
};

export type TodoWriteInput = Required<Pick<CreateTodoRequest, "title" | "status">> & {
  id?: string;
  projectId: string;
  description: string;
  tags: string[];
  sourceNoteId: string | null;
};

export function listTodos(db: Database, projectId: string) {
  return selectRows(
    db,
    `SELECT id, project_id, source_note_id, title, description, status, tags, created_at, updated_at
     FROM todos
     WHERE project_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [projectId]
  );
}

export function getProjectTodo(db: Database, projectId: string, todoId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, source_note_id, title, description, status, tags, created_at, updated_at
     FROM todos
     WHERE project_id = ? AND id = ?`,
    [projectId, todoId]
  );
}

export function createTodo(db: Database, input: TodoWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO todos (id, project_id, source_note_id, title, description, status, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.projectId, input.sourceNoteId, input.title, input.description, input.status, JSON.stringify(input.tags)]
  );

  const todo = getProjectTodo(db, input.projectId, id);

  if (!todo) {
    throw new Error("Failed to read created todo");
  }

  return todo;
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
