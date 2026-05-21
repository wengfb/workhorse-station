import { access, constants } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { WorktreeStatus } from "@workhorse-station/shared";

const execFileAsync = promisify(execFile);
const gitTimeoutMs = 30_000;

type GitResult = {
  stdout: string;
  stderr: string;
};

export type WorktreeGitEntry = {
  path: string;
  branch: string | null;
};

export async function validateGitBranchName(projectPath: string, branch: string) {
  await runGit(projectPath, ["check-ref-format", "--branch", branch]);
}

export async function branchExists(projectPath: string, branch: string) {
  try {
    await runGit(projectPath, ["show-ref", "--verify", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

export async function baseRefExists(projectPath: string, baseRef: string) {
  try {
    await runGit(projectPath, ["rev-parse", "--verify", baseRef]);
    return true;
  } catch {
    return false;
  }
}

export async function createGitWorktree(projectPath: string, worktreePath: string, branch: string, baseRef: string) {
  await runGit(projectPath, ["worktree", "add", "-b", branch, worktreePath, baseRef]);
}

export async function readGitWorktreeStatus(worktreePath: string): Promise<WorktreeStatus> {
  try {
    await access(worktreePath, constants.R_OK);
  } catch {
    return "missing";
  }

  try {
    const result = await runGit(worktreePath, ["status", "--porcelain"]);
    return result.stdout.trim() ? "dirty" : "clean";
  } catch {
    return "unknown";
  }
}

export async function listGitWorktrees(projectPath: string) {
  const result = await runGit(projectPath, ["worktree", "list", "--porcelain"]);
  return parseWorktreeList(result.stdout);
}

export async function removeGitWorktree(projectPath: string, worktreePath: string) {
  await runGit(projectPath, ["worktree", "remove", worktreePath]);
}

export async function deleteGitBranch(projectPath: string, branch: string) {
  await runGit(projectPath, ["branch", "-d", branch]);
}

export async function isBranchMerged(projectPath: string, branch: string, baseBranch: string) {
  try {
    await runGit(projectPath, ["merge-base", "--is-ancestor", branch, baseBranch]);
    return true;
  } catch {
    return false;
  }
}

export function isPathInside(parentPath: string, childPath: string) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function runGit(cwd: string, args: string[]): Promise<GitResult> {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0"
    },
    timeout: gitTimeoutMs,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });

  return { stdout, stderr };
}

function parseWorktreeList(output: string) {
  const entries: WorktreeGitEntry[] = [];
  let current: WorktreeGitEntry | null = null;

  for (const line of output.split("\n")) {
    if (!line) {
      if (current) {
        entries.push(current);
        current = null;
      }
      continue;
    }

    if (line.startsWith("worktree ")) {
      if (current) {
        entries.push(current);
      }
      current = {
        path: line.slice("worktree ".length),
        branch: null
      };
      continue;
    }

    if (current && line.startsWith("branch refs/heads/")) {
      current.branch = line.slice("branch refs/heads/".length);
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}
