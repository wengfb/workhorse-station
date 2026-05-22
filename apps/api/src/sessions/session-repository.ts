import { randomUUID } from "node:crypto";
import type { SessionSource, SessionStatus, SessionSummary } from "@workhorse-station/shared";
import type { Database } from "sql.js";

export type SessionWriteInput = {
  id?: string;
  projectId: string;
  worktreeId: string | null;
  todoId: string | null;
  promptDraftId: string | null;
  requestedWorktreeName: string | null;
  source: SessionSource;
  name: string;
  prompt: string;
  status: SessionStatus;
  summary: string | null;
};

type SessionRow = {
  id: string;
  project_id: string;
  worktree_id: string | null;
  todo_id: string | null;
  prompt_draft_id: string | null;
  requested_worktree_name: string | null;
  source: SessionSource;
  name: string;
  prompt: string;
  status: SessionStatus;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export function listSessions(db: Database, projectId: string) {
  return selectRows(
    db,
    `SELECT id, project_id, worktree_id, todo_id, prompt_draft_id, requested_worktree_name, source, name, prompt, status, summary, created_at, updated_at
     FROM sessions
     WHERE project_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [projectId]
  );
}

export function getProjectSession(db: Database, projectId: string, sessionId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, worktree_id, todo_id, prompt_draft_id, requested_worktree_name, source, name, prompt, status, summary, created_at, updated_at
     FROM sessions
     WHERE project_id = ? AND id = ?`,
    [projectId, sessionId]
  );
}

export function createSessionRecord(db: Database, input: SessionWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO sessions (id, project_id, worktree_id, todo_id, prompt_draft_id, requested_worktree_name, source, name, prompt, status, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.projectId,
      input.worktreeId,
      input.todoId,
      input.promptDraftId,
      input.requestedWorktreeName,
      input.source,
      input.name,
      input.prompt,
      input.status,
      input.summary
    ]
  );

  const session = getProjectSession(db, input.projectId, id);

  if (!session) {
    throw new Error("Failed to read created session");
  }

  return session;
}

export function updateSessionRecord(
  db: Database,
  projectId: string,
  sessionId: string,
  updates: {
    name: string;
    status: SessionStatus;
    summary: string | null;
  }
) {
  db.run(
    `UPDATE sessions
     SET name = ?, status = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [updates.name, updates.status, updates.summary, projectId, sessionId]
  );

  return getProjectSession(db, projectId, sessionId);
}

export function deleteSessionRecord(db: Database, projectId: string, sessionId: string) {
  db.run(`DELETE FROM sessions WHERE project_id = ? AND id = ?`, [projectId, sessionId]);
  return db.getRowsModified() > 0;
}

function selectRows(db: Database, sql: string, params: string[]) {
  const statement = db.prepare(sql, params);
  const rows: SessionSummary[] = [];

  try {
    while (statement.step()) {
      rows.push(mapSessionRow(statement.getAsObject() as SessionRow));
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

    return mapSessionRow(statement.getAsObject() as SessionRow);
  } finally {
    statement.free();
  }
}

function mapSessionRow(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    worktreeId: row.worktree_id,
    todoId: row.todo_id,
    promptDraftId: row.prompt_draft_id,
    requestedWorktreeName: row.requested_worktree_name,
    source: row.source,
    name: row.name,
    prompt: row.prompt,
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
