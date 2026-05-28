import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  CreateProjectRequest,
  DeleteProjectResponse,
  ProjectResponse,
  ProjectsResponse,
  UpdateProjectRequest
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "./http-error.js";
import { normalizeProjectPath, validateDefaultBranch } from "./project-path.js";
import {
  createProject,
  deleteProject,
  findProjectByPath,
  getProject,
  listProjects,
  updateProject,
  type ProjectWriteInput
} from "./project-repository.js";
import { listWorktrees } from "../worktrees/worktree-repository.js";

type ProjectParams = {
  id: string;
};

export async function registerProjectRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get("/api/projects", async (): Promise<ApiResponse<ProjectsResponse>> => ({
    ok: true,
    data: {
      projects: await listProjects(database.db)
    }
  }));

  server.get<{ Params: ProjectParams }>("/api/projects/:id", async (request): Promise<ApiResponse<ProjectResponse>> => {
    const project = await getProject(database.db, request.params.id);

    if (!project) {
      throw new HttpError(404, "project_not_found", "项目不存在");
    }

    return {
      ok: true,
      data: { project }
    };
  });

  server.post<{ Body: CreateProjectRequest }>("/api/projects", async (request, reply): Promise<ApiResponse<ProjectResponse>> => {
    const input = await buildCreateInput(database, request.body);
    const project = await createProject(database.db, input);
    await database.persist();
    reply.status(201);

    return {
      ok: true,
      data: { project }
    };
  });

  server.patch<{ Params: ProjectParams; Body: UpdateProjectRequest }>(
    "/api/projects/:id",
    async (request): Promise<ApiResponse<ProjectResponse>> => {
      const currentProject = await getProject(database.db, request.params.id);

      if (!currentProject) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const input = await buildUpdateInput(database, currentProject, request.body);

      if (input.path !== currentProject.path && (await listWorktrees(database.db, currentProject.id)).length > 0) {
        throw new HttpError(409, "project_has_worktrees", "该项目已有 worktree，请先删除 worktree 后再修改代码目录");
      }

      const project = await updateProject(database.db, currentProject.id, input);
      await database.persist();

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      return {
        ok: true,
        data: { project }
      };
    }
  );

  server.delete<{ Params: ProjectParams }>(
    "/api/projects/:id",
    async (request): Promise<ApiResponse<DeleteProjectResponse>> => {
      const project = await getProject(database.db, request.params.id);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      if ((await listWorktrees(database.db, project.id)).length > 0) {
        throw new HttpError(409, "project_has_worktrees", "该项目已有 worktree，请先删除 worktree 后再删除项目记录");
      }

      await deleteProject(database.db, request.params.id);
      await database.persist();

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );
}

async function buildCreateInput(database: DatabaseState, body: CreateProjectRequest | undefined): Promise<ProjectWriteInput> {
  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  const name = normalizeName(body.name);
  const normalizedPath = await normalizeProjectPath(body.path, body.defaultBranch);
  await assertPathAvailable(database, normalizedPath.path);

  return {
    name,
    path: normalizedPath.path,
    defaultBranch: normalizedPath.defaultBranch,
    description: normalizeDescription(body.description)
  };
}

async function buildUpdateInput(
  database: DatabaseState,
  currentProject: ProjectWriteInput & { id: string; createdAt?: string; updatedAt?: string },
  body: UpdateProjectRequest | undefined
): Promise<ProjectWriteInput> {
  if (!isObject(body) || !hasProjectUpdateField(body)) {
    throw new HttpError(400, "validation_error", "至少需要提供一个要更新的字段");
  }

  const name = body.name === undefined ? currentProject.name : normalizeName(body.name);
  const description = body.description === undefined ? currentProject.description : normalizeDescription(body.description);

  if (body.path !== undefined) {
    const normalizedPath = await normalizeProjectPath(body.path, body.defaultBranch ?? currentProject.defaultBranch);
    await assertPathAvailable(database, normalizedPath.path, currentProject.id);

    return {
      name,
      path: normalizedPath.path,
      defaultBranch: normalizedPath.defaultBranch,
      description
    };
  }

  return {
    name,
    path: currentProject.path,
    defaultBranch: body.defaultBranch === undefined ? currentProject.defaultBranch : validateDefaultBranch(body.defaultBranch),
    description
  };
}

async function assertPathAvailable(database: DatabaseState, projectPath: string, exceptProjectId?: string) {
  const existingProject = await findProjectByPath(database.db, projectPath);

  if (existingProject && existingProject.id !== exceptProjectId) {
    throw new HttpError(409, "project_path_exists", "该代码目录已绑定到其他项目");
  }
}

function normalizeName(name: unknown) {
  if (typeof name !== "string") {
    throw new HttpError(400, "validation_error", "项目名称不能为空");
  }

  const trimmed = name.trim();

  if (!trimmed) {
    throw new HttpError(400, "validation_error", "项目名称不能为空");
  }

  if (trimmed.length > 80) {
    throw new HttpError(400, "validation_error", "项目名称不能超过 80 个字符");
  }

  return trimmed;
}

function normalizeDescription(description: unknown) {
  if (description === undefined || description === null) {
    return null;
  }

  if (typeof description !== "string") {
    throw new HttpError(400, "validation_error", "项目备注必须是文本");
  }

  const trimmed = description.trim();

  if (trimmed.length > 1000) {
    throw new HttpError(400, "validation_error", "项目备注不能超过 1000 个字符");
  }

  return trimmed || null;
}

function hasProjectUpdateField(body: Record<string, unknown>) {
  return ["name", "path", "defaultBranch", "description"].some((field) => Object.prototype.hasOwnProperty.call(body, field));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
