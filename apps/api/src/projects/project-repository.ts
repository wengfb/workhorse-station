import { randomUUID } from "node:crypto";
import type { CreateProjectRequest, ProjectSummary, SessionResultSummary } from "@workhorse-station/shared";
import type { Database } from "sql.js";

type ProjectRow = {
  id: string;
  name: string;
  path: string;
  default_branch: string;
  description: string | null;
  latest_session_result: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectWriteInput = Required<Pick<CreateProjectRequest, "name" | "path" | "defaultBranch">> & {
  id?: string;
  description: string | null;
};

export function listProjects(db: Database) {
  return selectRows(
    db,
    `SELECT id, name, path, default_branch, description, latest_session_result, created_at, updated_at
     FROM projects
     ORDER BY updated_at DESC, created_at DESC`
  );
}

export function getProject(db: Database, id: string) {
  return selectOne(
    db,
    `SELECT id, name, path, default_branch, description, latest_session_result, created_at, updated_at
     FROM projects
     WHERE id = ?`,
    [id]
  );
}

export function findProjectByPath(db: Database, projectPath: string) {
  return selectOne(
    db,
    `SELECT id, name, path, default_branch, description, latest_session_result, created_at, updated_at
     FROM projects
     WHERE path = ?`,
    [projectPath]
  );
}

export function createProject(db: Database, input: ProjectWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO projects (id, name, path, default_branch, description, latest_session_result)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    [id, input.name, input.path, input.defaultBranch, input.description]
  );

  const project = getProject(db, id);

  if (!project) {
    throw new Error("Failed to read created project");
  }

  return project;
}

export function updateProjectLatestSessionResult(db: Database, id: string, latestSessionResult: SessionResultSummary | null) {
  db.run(
    `UPDATE projects
     SET latest_session_result = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [latestSessionResult ? JSON.stringify(latestSessionResult) : null, id]
  );

  return getProject(db, id);
}

export function updateProject(db: Database, id: string, input: ProjectWriteInput) {
  db.run(
    `UPDATE projects
     SET name = ?, path = ?, default_branch = ?, description = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [input.name, input.path, input.defaultBranch, input.description, id]
  );

  return getProject(db, id);
}

export function deleteProject(db: Database, id: string) {
  db.run("DELETE FROM projects WHERE id = ?", [id]);
  return db.getRowsModified() > 0;
}

function selectRows(db: Database, sql: string, params: (string | null)[] = []) {
  const statement = db.prepare(sql, params);
  const rows: ProjectSummary[] = [];

  try {
    while (statement.step()) {
      rows.push(mapProjectRow(statement.getAsObject() as ProjectRow));
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

    return mapProjectRow(statement.getAsObject() as ProjectRow);
  } finally {
    statement.free();
  }
}

function mapProjectRow(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    defaultBranch: row.default_branch,
    description: row.description,
    latestSessionResult: parseLatestSessionResult(row.latest_session_result),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
