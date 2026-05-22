import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { DatabaseState } from "../db/init.js";
import { getProject } from "../projects/project-repository.js";
import { HttpError } from "../projects/http-error.js";
import {
  baseRefExists,
  branchExists,
  createGitWorktree,
  isPathInside,
  readGitWorktreeStatus,
  validateGitBranchName
} from "../worktrees/git-worktree.js";
import { createWorktreeRecord, findWorktreeByBranch, findWorktreeByName, getProjectWorktree, updateWorktreeStatus } from "../worktrees/worktree-repository.js";

export async function resolveSessionWorktree(
  database: DatabaseState,
  input: {
    projectId: string;
    worktreeId: string | null;
    requestedWorktreeName: string | null;
  }
) {
  const project = getProject(database.db, input.projectId);

  if (!project) {
    throw new HttpError(404, "project_not_found", "项目不存在");
  }

  if (input.worktreeId && input.requestedWorktreeName) {
    throw new HttpError(400, "validation_error", "已有 Worktree 和新 Worktree 名称不能同时填写");
  }

  if (input.worktreeId) {
    const worktree = getProjectWorktree(database.db, input.projectId, input.worktreeId);

    if (!worktree) {
      throw new HttpError(400, "worktree_not_found", "Worktree 不存在或不属于当前项目");
    }

    const status = await readGitWorktreeStatus(worktree.path);

    if (status !== worktree.status) {
      updateWorktreeStatus(database.db, worktree.id, status);
      database.persist();
    }

    if (status === "missing" || status === "unknown") {
      throw new HttpError(409, "worktree_unavailable", "Worktree 当前不可用，无法启动会话");
    }

    return {
      worktreeId: worktree.id,
      requestedWorktreeName: input.requestedWorktreeName,
      resolvedWorktreePath: worktree.path,
      cwd: worktree.path
    };
  }

  if (input.requestedWorktreeName) {
    const existing = findWorktreeByName(database.db, input.projectId, input.requestedWorktreeName);

    if (existing) {
      const status = await readGitWorktreeStatus(existing.path);

      if (status !== existing.status) {
        updateWorktreeStatus(database.db, existing.id, status);
        database.persist();
      }

      if (status === "missing" || status === "unknown") {
        throw new HttpError(409, "worktree_unavailable", "目标 Worktree 当前不可用，无法启动会话");
      }

      return {
        worktreeId: existing.id,
        requestedWorktreeName: input.requestedWorktreeName,
        resolvedWorktreePath: existing.path,
        cwd: existing.path
      };
    }

    const name = normalizeWorktreeName(input.requestedWorktreeName);
    const branch = `workhorse/${name}`;
    const baseBranch = project.defaultBranch;
    const worktreeRoot = path.resolve(project.path, ".claude", "worktree");
    const worktreePath = path.resolve(worktreeRoot, name);

    if (!isPathInside(worktreeRoot, worktreePath)) {
      throw new HttpError(400, "validation_error", "Worktree 名称格式不正确");
    }

    if (findWorktreeByBranch(database.db, input.projectId, branch) || (await branchExists(project.path, branch))) {
      throw new HttpError(409, "worktree_branch_exists", "该项目下已存在使用该分支的 worktree");
    }

    try {
      await validateGitBranchName(project.path, branch);
    } catch {
      throw new HttpError(400, "worktree_branch_invalid", "Worktree 分支名格式不正确");
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
    const worktree = createWorktreeRecord(database.db, {
      projectId: input.projectId,
      name,
      path: worktreePath,
      branch,
      status
    });
    database.persist();

    return {
      worktreeId: worktree.id,
      requestedWorktreeName: input.requestedWorktreeName,
      resolvedWorktreePath: worktree.path,
      cwd: worktree.path
    };
  }

  return {
    worktreeId: null,
    requestedWorktreeName: null,
    resolvedWorktreePath: null,
    cwd: project.path
  };
}

function normalizeWorktreeName(value: string) {
  const name = value.trim();

  if (!name || name.length > 64 || name === "." || name === ".." || !/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new HttpError(400, "validation_error", "Worktree 名称只能包含字母、数字、点、下划线和短横线");
  }

  return name;
}
