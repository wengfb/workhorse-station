import type { AgentProvider } from "@workhorse-station/shared";
import { HttpError } from "../projects/http-error.js";
import type { DatabaseState } from "../db/init.js";
import { getProject } from "../projects/project-repository.js";

export function normalizeProvider(value: unknown): AgentProvider {
  if (value === undefined || value === null || value === "") {
    return "claude";
  }

  if (value === "claude" || value === "codex") {
    return value;
  }

  throw new HttpError(400, "validation_error", "执行器类型不合法");
}

export async function requireProject(database: DatabaseState, projectId: string) {
  const project = await getProject(database.db, projectId);
  if (!project) {
    throw new HttpError(404, "project_not_found", "项目不存在");
  }
  return project;
}
