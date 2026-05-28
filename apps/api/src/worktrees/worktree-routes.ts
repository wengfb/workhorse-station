import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  CreateWorktreeRequest,
  DeleteWorktreeRequest,
  DeleteWorktreeResponse,
  WorktreeResponse,
  WorktreesResponse,
  WorktreeStatus
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { getProject } from "../projects/project-repository.js";
import { HttpError } from "../projects/http-error.js";
import {
  baseRefExists,
  branchExists,
  createGitWorktree,
  deleteGitBranch,
  isBranchMerged,
  isPathInside,
  listGitWorktrees,
  readGitWorktreeStatus,
  removeGitWorktree,
  validateGitBranchName
} from "./git-worktree.js";
import {
  createWorktreeRecord,
  deleteWorktreeRecord,
  findWorktreeByBranch,
  findWorktreeByName,
  getProjectWorktree,
  listWorktrees,
  updateWorktreeStatus
} from "./worktree-repository.js";

type ProjectWorktreeParams = {
  projectId: string;
};

type ProjectWorktreeDetailParams = ProjectWorktreeParams & {
  worktreeId: string;
};

export async function registerWorktreeRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get<{ Params: ProjectWorktreeParams }>(
    "/api/projects/:projectId/worktrees",
    async (request): Promise<ApiResponse<WorktreesResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const changed = await refreshWorktreeStatuses(database, project.id);

      if (changed) {
        await database.persist();
      }

      return {
        ok: true,
        data: {
          worktrees: await listWorktrees(database.db, project.id)
        }
      };
    }
  );

  server.post<{ Params: ProjectWorktreeParams; Body: CreateWorktreeRequest }>(
    "/api/projects/:projectId/worktrees",
    async (request, reply): Promise<ApiResponse<WorktreeResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const name = normalizeWorktreeName(request.body?.name);
      const branch = normalizeBranch(request.body?.branch, name);
      const baseBranch = normalizeBaseBranch(request.body?.baseBranch, project.defaultBranch);
      const worktreeRoot = getWorktreeRoot(project.path);
      const worktreePath = path.resolve(worktreeRoot, name);

      if (!isPathInside(worktreeRoot, worktreePath)) {
        throw new HttpError(400, "validation_error", "Worktree 名称格式不正确");
      }

      if (await findWorktreeByName(database.db, project.id, name)) {
        throw new HttpError(409, "worktree_name_exists", "该项目下已存在同名 worktree");
      }

      if (await findWorktreeByBranch(database.db, project.id, branch)) {
        throw new HttpError(409, "worktree_branch_exists", "该项目下已存在使用该分支的 worktree");
      }

      if (await pathExists(worktreePath)) {
        throw new HttpError(409, "worktree_path_exists", "Worktree 目标目录已存在");
      }

      try {
        await validateGitBranchName(project.path, branch);
      } catch {
        throw new HttpError(400, "worktree_branch_invalid", "Worktree 分支名格式不正确");
      }

      if (await branchExists(project.path, branch)) {
        throw new HttpError(409, "worktree_branch_exists", "本地已存在同名分支");
      }

      if (!(await baseRefExists(project.path, baseBranch))) {
        throw new HttpError(400, "worktree_base_ref_not_found", "基准分支或 ref 不存在");
      }

      await mkdir(worktreeRoot, { recursive: true });

      try {
        await createGitWorktree(project.path, worktreePath, branch, baseBranch);
      } catch {
        throw new HttpError(500, "worktree_create_failed", "Git worktree 创建失败");
      }

      const status = await readGitWorktreeStatus(worktreePath);
      const worktree = await createWorktreeRecord(database.db, {
        projectId: project.id,
        name,
        path: worktreePath,
        branch,
        status
      });
      await database.persist();
      reply.status(201);

      return {
        ok: true,
        data: { worktree }
      };
    }
  );

  server.delete<{ Params: ProjectWorktreeDetailParams; Body: DeleteWorktreeRequest }>(
    "/api/projects/:projectId/worktrees/:worktreeId",
    async (request): Promise<ApiResponse<DeleteWorktreeResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const worktree = await getProjectWorktree(database.db, project.id, request.params.worktreeId);

      if (!worktree) {
        throw new HttpError(404, "worktree_not_found", "Worktree 不存在");
      }

      const body = request.body;

      if (!isObject(body) || typeof body.confirmBranch !== "string" || body.confirmBranch.trim() !== worktree.branch) {
        throw new HttpError(400, "branch_confirmation_mismatch", "删除确认分支与 worktree 分支不一致");
      }

      const worktreeRoot = getWorktreeRoot(project.path);
      const worktreePath = path.resolve(worktree.path);

      if (!isPathInside(worktreeRoot, worktreePath)) {
        throw new HttpError(409, "worktree_path_invalid", "Worktree 路径不在项目约定目录下");
      }

      const status = await readGitWorktreeStatus(worktreePath);

      if (status !== worktree.status) {
        await updateWorktreeStatus(database.db, worktree.id, status);
        await database.persist();
      }

      if (status === "dirty") {
        throw new HttpError(409, "worktree_dirty", "该 worktree 有未提交或未跟踪改动，请先提交或清理后再删除");
      }

      if (status === "missing") {
        throw new HttpError(409, "worktree_missing", "Worktree 目录缺失，请先手动检查后再清理记录");
      }

      if (status === "unknown") {
        throw new HttpError(409, "worktree_status_unknown", "无法确认 worktree 状态，请先手动检查后再删除");
      }

      const gitWorktrees = await listGitWorktrees(project.path);
      const matchingEntries = gitWorktrees.filter((entry) => entry.branch === worktree.branch);
      const targetEntry = matchingEntries.find((entry) => path.resolve(entry.path) === worktreePath);

      if (!targetEntry) {
        throw new HttpError(409, "worktree_git_mismatch", "Git worktree 状态与数据库记录不一致");
      }

      if (matchingEntries.some((entry) => path.resolve(entry.path) !== worktreePath)) {
        throw new HttpError(409, "branch_checked_out_elsewhere", "该分支仍被其他 worktree 使用");
      }

      if (!(await isBranchMerged(project.path, worktree.branch, project.defaultBranch))) {
        throw new HttpError(409, "branch_not_merged", "该分支包含未合并提交，请合并、备份或手动处理后再删除");
      }

      try {
        await removeGitWorktree(project.path, worktreePath);
      } catch {
        throw new HttpError(500, "worktree_delete_failed", "Git worktree 删除失败");
      }

      try {
        await deleteGitBranch(project.path, worktree.branch);
      } catch {
        throw new HttpError(500, "branch_delete_failed", "本地分支删除失败");
      }

      await deleteWorktreeRecord(database.db, worktree.id);
      await database.persist();

      return {
        ok: true,
        data: {
          deleted: true,
          deletedBranch: worktree.branch
        }
      };
    }
  );
}

async function refreshWorktreeStatuses(database: DatabaseState, projectId: string) {
  let changed = false;

  for (const worktree of await listWorktrees(database.db, projectId)) {
    const status = await readGitWorktreeStatus(worktree.path);

    if (status !== worktree.status) {
      await updateWorktreeStatus(database.db, worktree.id, status);
      changed = true;
    }
  }

  return changed;
}

function getWorktreeRoot(projectPath: string) {
  return path.resolve(projectPath, ".claude", "worktree");
}

function normalizeWorktreeName(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "Worktree 名称不能为空");
  }

  const name = value.trim();

  if (!name) {
    throw new HttpError(400, "validation_error", "Worktree 名称不能为空");
  }

  if (name.length > 64 || name === "." || name === ".." || !/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new HttpError(400, "validation_error", "Worktree 名称只能包含字母、数字、点、下划线和短横线");
  }

  return name;
}

function normalizeBranch(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") {
    return `workhorse/${name}`;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "Worktree 分支名必须是文本");
  }

  const branch = value.trim();

  if (!branch || branch.length > 120 || /[\s\x00-\x1f]/.test(branch)) {
    throw new HttpError(400, "validation_error", "Worktree 分支名格式不正确");
  }

  return branch;
}

function normalizeBaseBranch(value: unknown, defaultBranch: string) {
  if (value === undefined || value === null || value === "") {
    return defaultBranch;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "基准分支必须是文本");
  }

  const baseBranch = value.trim();

  if (!baseBranch || baseBranch.length > 120 || /[\s\x00-\x1f]/.test(baseBranch)) {
    throw new HttpError(400, "validation_error", "基准分支格式不正确");
  }

  return baseBranch;
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
