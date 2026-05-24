import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StoreSkill, StoreSkillInstallStatus, StoreSkillStatus } from "@workhorse-station/shared";
import { HttpError } from "../projects/http-error.js";
import { isPathInside } from "../worktrees/git-worktree.js";
import { parseFrontmatter } from "./skill-frontmatter.js";
import { validateSkillName } from "./skill-fs.js";
import { getChatSkillsRoot } from "./skill-loader.js";

export function getStoreSkillRoot(): string {
  return path.join(os.homedir(), ".workhorse", "skills");
}

function getGlobalClaudeCodeSkillRoot(): string {
  return path.join(os.homedir(), ".claude", "skills");
}

function getProjectClaudeCodeSkillRoot(projectPath: string): string {
  return path.join(projectPath, ".claude", "skills");
}

export async function listStoreSkillsWithStatus(projectPath?: string): Promise<StoreSkillStatus[]> {
  const skills = await listStoreSkills();
  const results: StoreSkillStatus[] = [];

  for (const skill of skills) {
    const installed = await getInstallStatus(skill.name, projectPath);
    results.push({ skill, installed });
  }

  return results;
}

export async function getStoreSkillStatus(name: string, projectPath?: string): Promise<StoreSkillStatus> {
  const skill = await readStoreSkill(name);
  const installed = await getInstallStatus(name, projectPath);
  return { skill, installed };
}

export async function createStoreSkill(nameInput: unknown, descriptionInput?: unknown): Promise<StoreSkill> {
  const name = validateSkillName(nameInput);
  const root = getStoreSkillRoot();
  const skillPath = resolvePath(root, name);

  if (await pathExists(skillPath)) {
    throw new HttpError(409, "skill_path_exists", "Skill 文件夹已存在");
  }

  const description = typeof descriptionInput === "string" ? descriptionInput.trim() : "";

  await mkdir(root, { recursive: true });
  await mkdir(skillPath);

  const mdContent = `---
name: ${name}
description: ${description || ""}
---

# ${name}

${description || ""}
`;
  await writeFile(path.join(skillPath, "SKILL.md"), mdContent);

  return readStoreSkill(name);
}

export async function renameStoreSkill(nameInput: unknown, newNameInput: unknown): Promise<StoreSkill> {
  const name = validateSkillName(nameInput);
  const newName = validateSkillName(newNameInput);
  const root = getStoreSkillRoot();
  const sourcePath = resolvePath(root, name);
  const targetPath = resolvePath(root, newName);

  if (!(await pathExists(sourcePath))) {
    throw new HttpError(404, "skill_not_found", "Skill 文件夹不存在");
  }

  await assertManagedDirectory(sourcePath);

  if (await pathExists(targetPath)) {
    throw new HttpError(409, "skill_path_exists", "目标 Skill 文件夹已存在");
  }

  await rename(sourcePath, targetPath);

  // Update name in SKILL.md
  const newMdPath = path.join(targetPath, "SKILL.md");
  try {
    const raw = await readFile(newMdPath, "utf-8");
    const updated = raw.replace(/^name:\s*.*$/m, `name: ${newName}`);
    await writeFile(newMdPath, updated);
  } catch {
    // SKILL.md might not exist yet, skip update
  }

  return readStoreSkill(newName);
}

export async function deleteStoreSkill(nameInput: unknown, confirmNameInput: unknown): Promise<void> {
  const name = validateSkillName(nameInput);

  if (typeof confirmNameInput !== "string" || confirmNameInput.trim() !== name) {
    throw new HttpError(400, "skill_confirmation_mismatch", "删除确认名称与 Skill 名称不一致");
  }

  const skillPath = resolvePath(getStoreSkillRoot(), name);

  if (!(await pathExists(skillPath))) {
    throw new HttpError(404, "skill_not_found", "Skill 文件夹不存在");
  }

  await assertManagedDirectory(skillPath);
  await rm(skillPath, { recursive: true });
}

export async function installStoreSkill(
  nameInput: unknown,
  targets: string[],
  projectPath?: string,
  overwrite?: boolean
): Promise<void> {
  const name = validateSkillName(nameInput);
  const sourceRoot = getStoreSkillRoot();
  const sourcePath = resolvePath(sourceRoot, name);

  if (!(await pathExists(sourcePath))) {
    throw new HttpError(404, "skill_not_found", "Skill 文件夹不存在");
  }

  await assertManagedDirectory(sourcePath);

  for (const target of targets) {
    let targetRoot: string;

    switch (target) {
      case "claude-code":
        targetRoot = getGlobalClaudeCodeSkillRoot();
        break;
      case "chat":
        targetRoot = getChatSkillsRoot();
        break;
      case "claude-code-project":
        if (!projectPath) {
          throw new HttpError(400, "project_required", "安装到项目需要提供 projectPath");
        }
        targetRoot = getProjectClaudeCodeSkillRoot(projectPath);
        break;
      default:
        throw new HttpError(400, "invalid_target", `无效的安装目标: ${target}`);
    }

    await copySkillDir(sourcePath, targetRoot, name, overwrite ?? false);
  }
}

async function listStoreSkills(): Promise<StoreSkill[]> {
  const root = getStoreSkillRoot();

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }

  const skills: StoreSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;

    try {
      const skill = await readStoreSkill(entry.name);
      skills.push(skill);
    } catch (err) {
      console.warn(`[skill-store] 跳过无效 skill: ${entry.name}`, err instanceof Error ? err.message : err);
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

async function readStoreSkill(name: string): Promise<StoreSkill> {
  const root = getStoreSkillRoot();
  const skillPath = resolvePath(root, name);

  await assertManagedDirectory(skillPath);

  const mdPath = path.join(skillPath, "SKILL.md");
  let description = "";

  try {
    const raw = await readFile(mdPath, "utf-8");
    const parsed = parseFrontmatter(raw);
    if (parsed) {
      description = parsed.description;
    }
  } catch {
    // SKILL.md might not exist yet
  }

  return {
    name,
    description,
    path: skillPath
  };
}

async function getInstallStatus(name: string, projectPath?: string): Promise<StoreSkillInstallStatus> {
  let claudeCode = false;
  let chat = false;
  let claudeCodeProject = false;

  try {
    const ccPath = path.join(getGlobalClaudeCodeSkillRoot(), name);
    const ccStat = await stat(ccPath);
    claudeCode = ccStat.isDirectory();
  } catch {
    // not installed
  }

  try {
    const chatPath = path.join(getChatSkillsRoot(), name);
    const chatStat = await stat(chatPath);
    chat = chatStat.isDirectory();
  } catch {
    // not installed
  }

  if (projectPath) {
    try {
      const projPath = path.join(getProjectClaudeCodeSkillRoot(projectPath), name);
      const projStat = await stat(projPath);
      claudeCodeProject = projStat.isDirectory();
    } catch {
      // not installed
    }
  }

  return { claudeCode, chat, claudeCodeProject };
}

async function copySkillDir(sourcePath: string, targetRoot: string, name: string, overwrite: boolean): Promise<void> {
  const targetPath = path.join(targetRoot, name);
  const targetExists = await pathExists(targetPath);

  if (targetExists && !overwrite) {
    throw new HttpError(409, "skill_path_exists", `目标 Skill ${name} 已存在于 ${targetRoot}`);
  }

  if (targetExists) {
    await rm(targetPath, { recursive: true });
  }

  await mkdir(targetRoot, { recursive: true });

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  await exec("/bin/cp", ["-r", sourcePath, targetPath]);
}

function resolvePath(root: string, name: string): string {
  const targetPath = path.resolve(root, name);

  if (!isPathInside(path.resolve(root), targetPath)) {
    throw new HttpError(400, "validation_error", "Skill 名称格式不正确");
  }

  return targetPath;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

async function assertManagedDirectory(skillPath: string): Promise<void> {
  let skillStat;

  try {
    skillStat = await stat(skillPath);
  } catch (error) {
    if (isNotFound(error)) {
      throw new HttpError(404, "skill_not_found", "Skill 文件夹不存在");
    }
    throw error;
  }

  if (!skillStat.isDirectory()) {
    throw new HttpError(400, "skill_not_directory", "Skill 路径不是文件夹");
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "ENOENT";
}
