import { randomUUID } from "node:crypto";
import type {
  ExecutionListItem,
  OverviewSessionSummary,
  SessionRuntimeStatus,
  SessionSource,
  SessionStatus,
  SessionSummary
} from "@workhorse-station/shared";
import type { DatabaseExecutor, SqlParams } from "../db/mysql.js";
import { execute, queryOne, queryRows } from "../db/mysql.js";

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

type OverviewSessionRow = SessionRow & {
  project_name: string;
};

const SESSION_SELECT = `SELECT id, project_id, worktree_id, todo_id, prompt_draft_id, requested_worktree_name, source, name, prompt, status, runtime_status, summary, pid, cwd, resolved_worktree_path, exit_code, last_activity_at, terminal_buffer, created_at, updated_at
     FROM sessions`;

const OVERVIEW_SESSION_SELECT = `SELECT s.id, s.project_id, s.worktree_id, s.todo_id, s.prompt_draft_id, s.requested_worktree_name, s.source, s.name, s.prompt, s.status, s.runtime_status, s.summary, s.pid, s.cwd, s.resolved_worktree_path, s.exit_code, s.last_activity_at, s.terminal_buffer, s.created_at, s.updated_at, p.name AS project_name
     FROM sessions s
     JOIN projects p ON s.project_id = p.id`;

export async function listSessions(db: DatabaseExecutor, projectId: string) {
  return selectRows(
    db,
    `${SESSION_SELECT}
     WHERE project_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [projectId]
  );
}

export async function getProjectSession(db: DatabaseExecutor, projectId: string, sessionId: string) {
  return selectOne(
    db,
    `${SESSION_SELECT}
     WHERE project_id = ? AND id = ?`,
    [projectId, sessionId]
  );
}

export async function createSessionRecord(db: DatabaseExecutor, input: SessionWriteInput) {
  const id = input.id ?? randomUUID();
  await execute(
    db,
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

  const session = await getProjectSession(db, input.projectId, id);

  if (!session) {
    throw new Error("Failed to read created session");
  }

  return session;
}

export async function updateSessionRecord(
  db: DatabaseExecutor,
  projectId: string,
  sessionId: string,
  updates: {
    name: string;
    summary: string | null;
  }
) {
  await execute(
    db,
    `UPDATE sessions
     SET name = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [updates.name, updates.summary, projectId, sessionId]
  );

  return getProjectSession(db, projectId, sessionId);
}

export async function updateSessionLaunch(
  db: DatabaseExecutor,
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
  await execute(
    db,
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

export async function updateSessionRuntime(
  db: DatabaseExecutor,
  projectId: string,
  sessionId: string,
  updates: {
    runtimeStatus: SessionRuntimeStatus | null;
    pid: number | null;
    lastActivityAt: string | null;
  }
) {
  await execute(
    db,
    `UPDATE sessions
     SET runtime_status = ?, pid = ?, last_activity_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [updates.runtimeStatus, updates.pid, updates.lastActivityAt, projectId, sessionId]
  );

  return getProjectSession(db, projectId, sessionId);
}

export async function updateSessionCompletion(
  db: DatabaseExecutor,
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
  await execute(
    db,
    `UPDATE sessions
     SET status = ?, runtime_status = ?, pid = NULL, exit_code = ?, last_activity_at = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [updates.status, updates.runtimeStatus, updates.exitCode, updates.lastActivityAt, updates.summary, projectId, sessionId]
  );

  return getProjectSession(db, projectId, sessionId);
}

export async function reconcileSessionsOnStartup(db: DatabaseExecutor) {
  await execute(
    db,
    `UPDATE sessions
     SET status = 'completed', runtime_status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('running', 'queued') OR runtime_status IN ('starting', 'running', 'stopping')`
  );
}

export async function updateSessionTerminalBuffer(
  db: DatabaseExecutor,
  projectId: string,
  sessionId: string,
  buffer: string
) {
  await execute(
    db,
    `UPDATE sessions
     SET terminal_buffer = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [buffer, projectId, sessionId]
  );
}

export async function deleteSessionRecord(db: DatabaseExecutor, projectId: string, sessionId: string) {
  return (await execute(db, `DELETE FROM sessions WHERE project_id = ? AND id = ?`, [projectId, sessionId])) > 0;
}

export async function listRunningSessions(db: DatabaseExecutor): Promise<OverviewSessionSummary[]> {
  const rows = await queryRows<OverviewSessionRow>(
    db,
    `${OVERVIEW_SESSION_SELECT}
     WHERE s.status IN ('running', 'queued')
     ORDER BY s.updated_at DESC`
  );
  return rows.map(mapOverviewSessionRow);
}

export async function listRecentSessions(db: DatabaseExecutor, limit: number): Promise<OverviewSessionSummary[]> {
  const rows = await queryRows<OverviewSessionRow>(
    db,
    `${OVERVIEW_SESSION_SELECT}
     ORDER BY s.updated_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map(mapOverviewSessionRow);
}

export async function listExecutionSessions(db: DatabaseExecutor, limit?: number): Promise<ExecutionListItem[]> {
  const sql =
    `${OVERVIEW_SESSION_SELECT}
     ORDER BY s.updated_at DESC` +
    (typeof limit === "number" ? " LIMIT ?" : "");
  const rows = await queryRows<OverviewSessionRow>(db, sql, typeof limit === "number" ? [limit] : []);
  return rows.map(mapExecutionSessionRow);
}

export async function listRunningExecutionSessions(db: DatabaseExecutor): Promise<ExecutionListItem[]> {
  const rows = await queryRows<OverviewSessionRow>(
    db,
    `${OVERVIEW_SESSION_SELECT}
     WHERE s.status IN ('running', 'queued')
     ORDER BY s.updated_at DESC`
  );
  return rows.map(mapExecutionSessionRow);
}

async function selectRows(db: DatabaseExecutor, sql: string, params: SqlParams) {
  const rows = await queryRows<SessionRow>(db, sql, params);
  return rows.map(mapSessionRow);
}

async function selectOne(db: DatabaseExecutor, sql: string, params: SqlParams) {
  const row = await queryOne<SessionRow>(db, sql, params);
  return row ? mapSessionRow(row) : null;
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

function mapExecutionSessionRow(row: OverviewSessionRow): ExecutionListItem {
  return {
    id: row.id,
    kind: "session",
    projectId: row.project_id,
    projectName: row.project_name,
    name: row.name,
    status: row.status,
    source: row.source,
    runtimeStatus: row.runtime_status,
    summary: row.summary,
    todoId: row.todo_id,
    worktreeId: row.worktree_id,
    requestedWorktreeName: row.requested_worktree_name,
    pid: row.pid,
    cwd: row.cwd,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
