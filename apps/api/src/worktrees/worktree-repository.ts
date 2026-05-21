import { randomUUID } from "node:crypto";
import type { WorktreeStatus, WorktreeSummary } from "@workhorse-station/shared";
import type { Database } from "sql.js";

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

export function listWorktrees(db: Database, projectId: string) {
  return selectRows(
    db,
    `SELECT id, project_id, name, path, branch, status, created_at, updated_at
     FROM worktrees
     WHERE project_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [projectId]
  );
}

export function getProjectWorktree(db: Database, projectId: string, worktreeId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, name, path, branch, status, created_at, updated_at
     FROM worktrees
     WHERE project_id = ? AND id = ?`,
    [projectId, worktreeId]
  );
}

export function findWorktreeByName(db: Database, projectId: string, name: string) {
  return selectOne(
    db,
    `SELECT id, project_id, name, path, branch, status, created_at, updated_at
     FROM worktrees
     WHERE project_id = ? AND name = ?`,
    [projectId, name]
  );
}

export function findWorktreeByBranch(db: Database, projectId: string, branch: string) {
  return selectOne(
    db,
    `SELECT id, project_id, name, path, branch, status, created_at, updated_at
     FROM worktrees
     WHERE project_id = ? AND branch = ?`,
    [projectId, branch]
  );
}

export function createWorktreeRecord(db: Database, input: WorktreeWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO worktrees (id, project_id, name, path, branch, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.projectId, input.name, input.path, input.branch, input.status]
  );

  const worktree = getProjectWorktree(db, input.projectId, id);

  if (!worktree) {
    throw new Error("Failed to read created worktree");
  }

  return worktree;
}

export function updateWorktreeStatus(db: Database, id: string, status: WorktreeStatus) {
  db.run(
    `UPDATE worktrees
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, id]
  );

  return db.getRowsModified() > 0;
}

export function deleteWorktreeRecord(db: Database, id: string) {
  db.run("DELETE FROM worktrees WHERE id = ?", [id]);
  return db.getRowsModified() > 0;
}

function selectRows(db: Database, sql: string, params: string[]) {
  const statement = db.prepare(sql, params);
  const rows: WorktreeSummary[] = [];

  try {
    while (statement.step()) {
      rows.push(mapWorktreeRow(statement.getAsObject() as WorktreeRow));
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

    return mapWorktreeRow(statement.getAsObject() as WorktreeRow);
  } finally {
    statement.free();
  }
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
