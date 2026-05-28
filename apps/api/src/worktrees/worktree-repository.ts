import { randomUUID } from "node:crypto";
import type { WorktreeStatus, WorktreeSummary } from "@workhorse-station/shared";
import type { DatabaseExecutor } from "../db/mysql.js";
import { execute, queryOne, queryRows } from "../db/mysql.js";

type WorktreeRow = {
  id: string;
  project_id: string;
  name: string;
  path: string;
  branch: string;
  status: WorktreeStatus;
  created_at: string;
  updated_at: string;
};

export type WorktreeWriteInput = {
  id?: string;
  projectId: string;
  name: string;
  path: string;
  branch: string;
  status: WorktreeStatus;
};

export async function listWorktrees(db: DatabaseExecutor, projectId: string) {
  return selectRows(
    db,
    `SELECT id, project_id, name, path, branch, status, created_at, updated_at
     FROM worktrees
     WHERE project_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [projectId]
  );
}

export async function getProjectWorktree(db: DatabaseExecutor, projectId: string, worktreeId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, name, path, branch, status, created_at, updated_at
     FROM worktrees
     WHERE project_id = ? AND id = ?`,
    [projectId, worktreeId]
  );
}

export async function findWorktreeByName(db: DatabaseExecutor, projectId: string, name: string) {
  return selectOne(
    db,
    `SELECT id, project_id, name, path, branch, status, created_at, updated_at
     FROM worktrees
     WHERE project_id = ? AND name = ?`,
    [projectId, name]
  );
}

export async function findWorktreeByBranch(db: DatabaseExecutor, projectId: string, branch: string) {
  return selectOne(
    db,
    `SELECT id, project_id, name, path, branch, status, created_at, updated_at
     FROM worktrees
     WHERE project_id = ? AND branch = ?`,
    [projectId, branch]
  );
}

export async function createWorktreeRecord(db: DatabaseExecutor, input: WorktreeWriteInput) {
  const id = input.id ?? randomUUID();
  await execute(
    db,
    `INSERT INTO worktrees (id, project_id, name, path, branch, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.projectId, input.name, input.path, input.branch, input.status]
  );

  const worktree = await getProjectWorktree(db, input.projectId, id);

  if (!worktree) {
    throw new Error("Failed to read created worktree");
  }

  return worktree;
}

export async function updateWorktreeStatus(db: DatabaseExecutor, id: string, status: WorktreeStatus) {
  return (
    await execute(
      db,
      `UPDATE worktrees
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, id]
    )
  ) > 0;
}

export async function deleteWorktreeRecord(db: DatabaseExecutor, id: string) {
  return (await execute(db, "DELETE FROM worktrees WHERE id = ?", [id])) > 0;
}

async function selectRows(db: DatabaseExecutor, sql: string, params: string[]) {
  const rows = await queryRows<WorktreeRow>(db, sql, params);
  return rows.map(mapWorktreeRow);
}

async function selectOne(db: DatabaseExecutor, sql: string, params: string[]) {
  const row = await queryOne<WorktreeRow>(db, sql, params);
  return row ? mapWorktreeRow(row) : null;
}

function mapWorktreeRow(row: WorktreeRow): WorktreeSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    path: row.path,
    branch: row.branch,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
