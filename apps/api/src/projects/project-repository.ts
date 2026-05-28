import { randomUUID } from "node:crypto";
import type { CreateProjectRequest, ProjectSummary, SessionResultSummary } from "@workhorse-station/shared";
import type { DatabaseExecutor } from "../db/mysql.js";
import { execute, queryOne, queryRows } from "../db/mysql.js";

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

export async function listProjects(db: DatabaseExecutor) {
  return selectRows(
    db,
    `SELECT id, name, path, default_branch, description, latest_session_result, created_at, updated_at
     FROM projects
     ORDER BY updated_at DESC, created_at DESC`
  );
}

export async function getProject(db: DatabaseExecutor, id: string) {
  return selectOne(
    db,
    `SELECT id, name, path, default_branch, description, latest_session_result, created_at, updated_at
     FROM projects
     WHERE id = ?`,
    [id]
  );
}

export async function findProjectByPath(db: DatabaseExecutor, projectPath: string) {
  return selectOne(
    db,
    `SELECT id, name, path, default_branch, description, latest_session_result, created_at, updated_at
     FROM projects
     WHERE path = ?`,
    [projectPath]
  );
}

export async function createProject(db: DatabaseExecutor, input: ProjectWriteInput) {
  const id = input.id ?? randomUUID();
  await execute(
    db,
    `INSERT INTO projects (id, name, path, default_branch, description, latest_session_result)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    [id, input.name, input.path, input.defaultBranch, input.description]
  );

  const project = await getProject(db, id);

  if (!project) {
    throw new Error("Failed to read created project");
  }

  return project;
}

export async function updateProjectLatestSessionResult(db: DatabaseExecutor, id: string, latestSessionResult: SessionResultSummary | null) {
  await execute(
    db,
    `UPDATE projects
     SET latest_session_result = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [latestSessionResult ? JSON.stringify(latestSessionResult) : null, id]
  );

  return getProject(db, id);
}

export async function updateProject(db: DatabaseExecutor, id: string, input: ProjectWriteInput) {
  await execute(
    db,
    `UPDATE projects
     SET name = ?, path = ?, default_branch = ?, description = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [input.name, input.path, input.defaultBranch, input.description, id]
  );

  return getProject(db, id);
}

export async function deleteProject(db: DatabaseExecutor, id: string) {
  return (await execute(db, "DELETE FROM projects WHERE id = ?", [id])) > 0;
}

async function selectRows(db: DatabaseExecutor, sql: string, params: Array<string | null> = []) {
  const rows = await queryRows<ProjectRow>(db, sql, params);
  return rows.map(mapProjectRow);
}

async function selectOne(db: DatabaseExecutor, sql: string, params: string[]) {
  const row = await queryOne<ProjectRow>(db, sql, params);
  return row ? mapProjectRow(row) : null;
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
