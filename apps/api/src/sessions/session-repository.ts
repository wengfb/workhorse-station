import { randomUUID } from "node:crypto";
import type { OverviewSessionSummary, SessionRuntimeStatus, SessionSource, SessionStatus, SessionSummary } from "@workhorse-station/shared";
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
  runtimeStatus: SessionRuntimeStatus | null;
  summary: string | null;
  pid: number | null;
  cwd: string | null;
  resolvedWorktreePath: string | null;
  exitCode: number | null;
  lastActivityAt: string | null;
  resumeSessionId?: string | null;
  forkSession?: boolean;
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
  runtime_status: SessionRuntimeStatus | null;
  summary: string | null;
  pid: number | null;
  cwd: string | null;
  resolved_worktree_path: string | null;
  exit_code: number | null;
  last_activity_at: string | null;
  terminal_buffer: string | null;
  created_at: string;
  updated_at: string;
};

export function listSessions(db: Database, projectId: string) {
  return selectRows(
    db,
    `SELECT id, project_id, worktree_id, todo_id, prompt_draft_id, requested_worktree_name, source, name, prompt, status, runtime_status, summary, pid, cwd, resolved_worktree_path, exit_code, last_activity_at, terminal_buffer, created_at, updated_at
     FROM sessions
     WHERE project_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [projectId]
  );
}

export function getProjectSession(db: Database, projectId: string, sessionId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, worktree_id, todo_id, prompt_draft_id, requested_worktree_name, source, name, prompt, status, runtime_status, summary, pid, cwd, resolved_worktree_path, exit_code, last_activity_at, terminal_buffer, created_at, updated_at
     FROM sessions
     WHERE project_id = ? AND id = ?`,
    [projectId, sessionId]
  );
}

export function createSessionRecord(db: Database, input: SessionWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO sessions (id, project_id, worktree_id, todo_id, prompt_draft_id, requested_worktree_name, source, name, prompt, status, runtime_status, summary, pid, cwd, resolved_worktree_path, exit_code, last_activity_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.runtimeStatus,
      input.summary,
      input.pid,
      input.cwd,
      input.resolvedWorktreePath,
      input.exitCode,
      input.lastActivityAt
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
    summary: string | null;
  }
) {
  db.run(
    `UPDATE sessions
     SET name = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [updates.name, updates.summary, projectId, sessionId]
  );

  return getProjectSession(db, projectId, sessionId);
}

export function updateSessionLaunch(
  db: Database,
  projectId: string,
  sessionId: string,
  updates: {
    status: SessionStatus;
    runtimeStatus: SessionRuntimeStatus | null;
    worktreeId: string | null;
    requestedWorktreeName: string | null;
    pid: number | null;
    cwd: string | null;
    resolvedWorktreePath: string | null;
    lastActivityAt: string | null;
    summary: string | null;
  }
) {
  db.run(
    `UPDATE sessions
     SET status = ?, runtime_status = ?, worktree_id = ?, requested_worktree_name = ?, pid = ?, cwd = ?, resolved_worktree_path = ?, last_activity_at = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [
      updates.status,
      updates.runtimeStatus,
      updates.worktreeId,
      updates.requestedWorktreeName,
      updates.pid,
      updates.cwd,
      updates.resolvedWorktreePath,
      updates.lastActivityAt,
      updates.summary,
      projectId,
      sessionId
    ]
  );

  return getProjectSession(db, projectId, sessionId);
}

export function updateSessionRuntime(
  db: Database,
  projectId: string,
  sessionId: string,
  updates: {
    runtimeStatus: SessionRuntimeStatus | null;
    pid: number | null;
    lastActivityAt: string | null;
  }
) {
  db.run(
    `UPDATE sessions
     SET runtime_status = ?, pid = ?, last_activity_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [updates.runtimeStatus, updates.pid, updates.lastActivityAt, projectId, sessionId]
  );

  return getProjectSession(db, projectId, sessionId);
}

export function updateSessionCompletion(
  db: Database,
  projectId: string,
  sessionId: string,
  updates: {
    status: SessionStatus;
    runtimeStatus: SessionRuntimeStatus | null;
    exitCode: number | null;
    lastActivityAt: string | null;
    summary: string | null;
  }
) {
  db.run(
    `UPDATE sessions
     SET status = ?, runtime_status = ?, pid = NULL, exit_code = ?, last_activity_at = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [updates.status, updates.runtimeStatus, updates.exitCode, updates.lastActivityAt, updates.summary, projectId, sessionId]
  );

  return getProjectSession(db, projectId, sessionId);
}

export function reconcileSessionsOnStartup(db: Database) {
  db.run(
    `UPDATE sessions
     SET status = 'completed', runtime_status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('running', 'queued') OR runtime_status IN ('starting', 'running', 'stopping')`
  );
}

export function updateSessionTerminalBuffer(
  db: Database,
  projectId: string,
  sessionId: string,
  buffer: string
) {
  db.run(
    `UPDATE sessions
     SET terminal_buffer = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [buffer, projectId, sessionId]
  );
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
    runtimeStatus: row.runtime_status,
    summary: row.summary,
    pid: row.pid,
    cwd: row.cwd,
    resolvedWorktreePath: row.resolved_worktree_path,
    exitCode: row.exit_code,
    lastActivityAt: row.last_activity_at,
    terminalBuffer: row.terminal_buffer,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type OverviewSessionRow = SessionRow & {
  project_name: string;
};

export function listRunningSessions(db: Database): OverviewSessionSummary[] {
  const stmt = db.prepare(
    `SELECT s.id, s.project_id, s.worktree_id, s.todo_id, s.prompt_draft_id, s.requested_worktree_name, s.source, s.name, s.prompt, s.status, s.runtime_status, s.summary, s.pid, s.cwd, s.resolved_worktree_path, s.exit_code, s.last_activity_at, s.created_at, s.updated_at, p.name AS project_name
     FROM sessions s
     JOIN projects p ON s.project_id = p.id
     WHERE s.status IN ('running', 'queued')
     ORDER BY s.updated_at DESC`
  );
  const rows: OverviewSessionSummary[] = [];
  try {
    while (stmt.step()) {
      rows.push(mapOverviewSessionRow(stmt.getAsObject() as OverviewSessionRow));
    }
  } finally {
    stmt.free();
  }
  return rows;
}

export function listRecentSessions(db: Database, limit: number): OverviewSessionSummary[] {
  const stmt = db.prepare(
    `SELECT s.id, s.project_id, s.worktree_id, s.todo_id, s.prompt_draft_id, s.requested_worktree_name, s.source, s.name, s.prompt, s.status, s.runtime_status, s.summary, s.pid, s.cwd, s.resolved_worktree_path, s.exit_code, s.last_activity_at, s.created_at, s.updated_at, p.name AS project_name
     FROM sessions s
     JOIN projects p ON s.project_id = p.id
     ORDER BY s.updated_at DESC
     LIMIT ?`,
    [limit]
  );
  const rows: OverviewSessionSummary[] = [];
  try {
    while (stmt.step()) {
      rows.push(mapOverviewSessionRow(stmt.getAsObject() as OverviewSessionRow));
    }
  } finally {
    stmt.free();
  }
  return rows;
}

function mapOverviewSessionRow(row: OverviewSessionRow): OverviewSessionSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    name: row.name,
    status: row.status,
    runtimeStatus: row.runtime_status,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
