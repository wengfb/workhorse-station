import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MemoryIndexEntry, MemorySummary, MemoryType, RuleSummary } from "@workhorse-station/shared";
import { HttpError } from "../projects/http-error.js";
import { isPathInside } from "../worktrees/git-worktree.js";

// ─── Path resolution ───

export function claudeMdGlobalPath() {
  return path.join(os.homedir(), ".claude", "CLAUDE.md");
}

export function claudeMdProjectPath(projectPath: string) {
  return path.join(projectPath, "CLAUDE.md");
}

export function rulesRoot(projectPath: string) {
  return path.join(projectPath, ".claude", "rules");
}

export function memoryRoot(projectPath: string) {
  const transformed = projectPath.replace(/\//g, "-");
  return path.join(os.homedir(), ".claude", "projects", transformed, "memory");
}

// ─── File I/O helpers ───

export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function writeTextFile(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

export async function deleteFile(filePath: string) {
  try {
    await rm(filePath);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

// ─── Name validation ───

export function validateName(nameInput: unknown) {
  if (typeof nameInput !== "string") {
    throw new HttpError(400, "validation_error", "名称不能为空");
  }

  const name = nameInput.trim();

  if (!name) {
    throw new HttpError(400, "validation_error", "名称不能为空");
  }

  if (name === "." || name === ".." || name.length > 120 || /[\\/\x00-\x1f]/.test(name)) {
    throw new HttpError(400, "validation_error", "名称格式不正确");
  }

  return name;
}

// ─── CLAUDE.md ───

export async function readClaudeMd(filePath: string) {
  return (await readTextFile(filePath)) ?? "";
}

export async function saveClaudeMd(filePath: string, content: string) {
  await writeTextFile(filePath, content);
}

// ─── Rules ───

export async function listRules(projectPath: string): Promise<RuleSummary[]> {
  const root = rulesRoot(projectPath);

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }

  const rules: RuleSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    rules.push({
      name: entry.name.replace(/\.md$/, ""),
      path: path.join(root, entry.name)
    });
  }

  return rules.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

export async function readRule(projectPath: string, name: string) {
  const filePath = resolveRulePath(projectPath, name);
  const content = await readTextFile(filePath);

  if (content === null) {
    throw new HttpError(404, "rule_not_found", "规则文件不存在");
  }

  const parsed = parseRuleFrontmatter(content);

  return {
    name,
    path: filePath,
    content: parsed.body,
    frontmatter: { name: parsed.name, description: parsed.description }
  };
}

export async function createRule(projectPath: string, nameInput: unknown, content?: string) {
  const name = validateName(nameInput);
  const filePath = resolveRulePath(projectPath, name);

  if (await pathExists(filePath)) {
    throw new HttpError(409, "rule_exists", "规则文件已存在");
  }

  const body = content ?? "";
  const frontmatter = buildRuleFrontmatter(name, body);
  await writeTextFile(filePath, frontmatter);

  return readRule(projectPath, name);
}

export async function updateRule(projectPath: string, nameInput: unknown, content: string) {
  const name = validateName(nameInput);
  const filePath = resolveRulePath(projectPath, name);

  if (!(await pathExists(filePath))) {
    throw new HttpError(404, "rule_not_found", "规则文件不存在");
  }

  const existing = await readRule(projectPath, name);
  const newFrontmatter = buildRuleFrontmatter(name, content);
  await writeTextFile(filePath, newFrontmatter);

  return {
    ...existing,
    content
  };
}

export async function deleteRule(projectPath: string, nameInput: unknown, confirmNameInput: unknown) {
  const name = validateName(nameInput);

  if (typeof confirmNameInput !== "string" || confirmNameInput.trim() !== name) {
    throw new HttpError(400, "confirmation_mismatch", "删除确认名称与规则名称不一致");
  }

  const filePath = resolveRulePath(projectPath, name);

  if (!(await pathExists(filePath))) {
    throw new HttpError(404, "rule_not_found", "规则文件不存在");
  }

  await deleteFile(filePath);
}

// ─── Auto memory ───

export async function listMemories(projectPath: string) {
  const root = memoryRoot(projectPath);

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) return { memories: [] as MemorySummary[], indexEntries: [] as MemoryIndexEntry[] };
    throw error;
  }

  const memories: MemorySummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === "MEMORY.md") continue;

    const filePath = path.join(root, entry.name);
    const content = await readTextFile(filePath);
    if (!content) continue;

    const parsed = parseMemoryFrontmatter(content);
    memories.push({
      name: entry.name.replace(/\.md$/, ""),
      type: (parsed.metadata?.type as MemoryType) ?? "reference",
      description: parsed.description ?? "",
      path: filePath
    });
  }

  const indexContent = await readTextFile(path.join(root, "MEMORY.md"));
  const indexEntries = indexContent ? parseMEMORYmd(indexContent) : [];

  return {
    memories: memories.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")),
    indexEntries
  };
}

export async function readMemory(projectPath: string, nameInput: unknown) {
  const name = validateName(nameInput);
  const filePath = resolveMemoryPath(projectPath, name);

  const content = await readTextFile(filePath);
  if (content === null) {
    throw new HttpError(404, "memory_not_found", "记忆文件不存在");
  }

  const parsed = parseMemoryFrontmatter(content);

  return {
    name,
    type: (parsed.metadata?.type as MemoryType) ?? "reference",
    description: parsed.description ?? "",
    content: parsed.body,
    metadata: parsed.metadata ?? {}
  };
}

export async function createMemory(projectPath: string, input: {
  name: unknown;
  type: unknown;
  description: unknown;
  content: unknown;
}) {
  const name = validateName(input.name);
  const type = validateMemoryType(input.type);
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const body = typeof input.content === "string" ? input.content : "";

  const filePath = resolveMemoryPath(projectPath, name);

  if (await pathExists(filePath)) {
    throw new HttpError(409, "memory_exists", "记忆文件已存在");
  }

  const frontmatter = buildMemoryFrontmatter({ name, type, description });
  const fileContent = `${frontmatter}\n${body}`;
  await writeTextFile(filePath, fileContent);

  await syncMemoryIndex(projectPath, name, description);

  return readMemory(projectPath, name);
}

export async function updateMemory(projectPath: string, nameInput: unknown, input: {
  name?: unknown;
  type?: unknown;
  description?: unknown;
  content: unknown;
}) {
  const oldName = validateName(nameInput);
  const newName = input.name !== undefined ? validateName(input.name) : oldName;
  const type = input.type !== undefined ? validateMemoryType(input.type) : undefined;
  const description = typeof input.description === "string" ? input.description.trim() : undefined;
  const body = typeof input.content === "string" ? input.content : "";

  const oldFilePath = resolveMemoryPath(projectPath, oldName);

  if (!(await pathExists(oldFilePath))) {
    throw new HttpError(404, "memory_not_found", "记忆文件不存在");
  }

  const existing = await readMemory(projectPath, oldName);
  const effectiveType = type ?? existing.type;
  const effectiveDescription = description ?? existing.description;
  const mergedMeta = { ...existing.metadata };

  if (type) mergedMeta.type = type;

  const frontmatter = buildMemoryFrontmatter({
    name: newName,
    type: effectiveType,
    description: effectiveDescription,
    extraMeta: mergedMeta
  });
  const fileContent = `${frontmatter}\n${body}`;

  if (oldName !== newName) {
    const newFilePath = resolveMemoryPath(projectPath, newName);
    if (await pathExists(newFilePath)) {
      throw new HttpError(409, "memory_exists", "目标记忆文件已存在");
    }
    await writeTextFile(newFilePath, fileContent);
    await deleteFile(oldFilePath);
    await removeFromMemoryIndex(projectPath, oldName);
    await syncMemoryIndex(projectPath, newName, effectiveDescription);
  } else {
    await writeTextFile(oldFilePath, fileContent);
  }

  return readMemory(projectPath, newName);
}

export async function deleteMemory(projectPath: string, nameInput: unknown, confirmNameInput: unknown) {
  const name = validateName(nameInput);

  if (typeof confirmNameInput !== "string" || confirmNameInput.trim() !== name) {
    throw new HttpError(400, "confirmation_mismatch", "删除确认名称与记忆名称不一致");
  }

  const filePath = resolveMemoryPath(projectPath, name);

  if (!(await pathExists(filePath))) {
    throw new HttpError(404, "memory_not_found", "记忆文件不存在");
  }

  await deleteFile(filePath);
  await removeFromMemoryIndex(projectPath, name);
}

export async function readMemoryIndex(projectPath: string) {
  const root = memoryRoot(projectPath);
  const content = await readTextFile(path.join(root, "MEMORY.md"));
  return content ? parseMEMORYmd(content) : [];
}

export async function writeMemoryIndex(projectPath: string, entries: MemoryIndexEntry[]) {
  const root = memoryRoot(projectPath);
  const lines = entries.map((e) => `- [${e.name}](${e.file}) — ${e.description}`);
  await writeTextFile(path.join(root, "MEMORY.md"), lines.join("\n") + "\n");
}

// ─── Internal helpers ───

function resolveRulePath(projectPath: string, name: string) {
  const filePath = path.resolve(rulesRoot(projectPath), `${name}.md`);
  if (!isPathInside(path.resolve(rulesRoot(projectPath)), filePath)) {
    throw new HttpError(400, "validation_error", "规则名称格式不正确");
  }
  return filePath;
}

function resolveMemoryPath(projectPath: string, name: string) {
  const root = memoryRoot(projectPath);
  const filePath = path.resolve(root, `${name}.md`);
  if (!isPathInside(path.resolve(root), filePath)) {
    throw new HttpError(400, "validation_error", "记忆名称格式不正确");
  }
  return filePath;
}

function validateMemoryType(typeInput: unknown): MemoryType {
  const valid: MemoryType[] = ["user", "feedback", "project", "reference"];
  if (typeof typeInput === "string" && valid.includes(typeInput as MemoryType)) {
    return typeInput as MemoryType;
  }
  throw new HttpError(400, "validation_error", "记忆类型必须是 user、feedback、project 或 reference");
}

// ─── Frontmatter parsing ───

type ParsedRuleFrontmatter = {
  name: string;
  description: string;
  body: string;
};

type ParsedMemoryFrontmatter = {
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  body: string;
};

function parseRuleFrontmatter(raw: string): ParsedRuleFrontmatter {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!fmMatch) return { name: "", description: "", body: raw };

  const fmBlock = fmMatch[1];
  const body = raw.slice(fmMatch[0].length).trim();
  const name = extractYamlValue(fmBlock, "name");
  const description = extractYamlValue(fmBlock, "description");

  return { name, description, body };
}

function parseMemoryFrontmatter(raw: string): ParsedMemoryFrontmatter {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!fmMatch) return { name: "", description: null, metadata: null, body: raw };

  const fmBlock = fmMatch[1];
  const body = raw.slice(fmMatch[0].length).trim();
  const name = extractYamlValue(fmBlock, "name");
  const description = extractYamlValue(fmBlock, "description") || null;
  const metadata = extractYamlBlock(fmBlock, "metadata");

  return { name, description, metadata, body };
}

function extractYamlValue(block: string, key: string): string {
  const lines = block.split("\n");
  let collecting = false;
  let value = "";
  let indent = "";

  for (const line of lines) {
    if (!collecting) {
      const match = line.match(new RegExp(`^${key}:\\s*(.*)`));
      if (match) {
        const rest = match[1].trim();
        if (rest === ">" || rest === "|") {
          collecting = true;
          const keyMatch = line.match(/^(\s*)/);
          indent = keyMatch ? keyMatch[1] + "  " : "  ";
          continue;
        }
        return rest || "";
      }
    } else {
      if (!line.startsWith(indent) && line.trim() !== "") break;
      const content = line.startsWith(indent) ? line.slice(indent.length) : line.trim();
      value += (value ? " " : "") + content;
    }
  }

  return value.trim();
}

function extractYamlBlock(block: string, key: string): Record<string, unknown> | null {
  const lines = block.split("\n");
  let inBlock = false;
  let baseIndent = 0;
  const result: Record<string, unknown> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      const match = line.match(new RegExp(`^${key}:\\s*(.*)`));
      if (match) {
        const rest = match[1].trim();
        if (rest) {
          result[key] = rest;
          return result;
        }
        inBlock = true;
        const keyMatch = line.match(/^(\s*)/);
        baseIndent = keyMatch ? keyMatch[1].length + 2 : 2;
        continue;
      }
    } else {
      const currentIndent = line.search(/\S/);
      if (currentIndent < baseIndent || line.trim() === "") break;

      const trimmed = line.trim();
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > 0) {
        const subKey = trimmed.slice(0, colonIdx).trim();
        const subValue = trimmed.slice(colonIdx + 1).trim();
        result[subKey] = subValue;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ─── Frontmatter building ───

function buildRuleFrontmatter(name: string, body: string) {
  const firstLine = body.split("\n")[0]?.trim() ?? "";
  const description = firstLine.replace(/^#+\s*/, "").slice(0, 120);

  return [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    "metadata:",
    "  type: reference",
    "---",
    "",
    body
  ].join("\n");
}

function buildMemoryFrontmatter(opts: {
  name: string;
  type: string;
  description: string;
  extraMeta?: Record<string, unknown>;
}) {
  const meta = opts.extraMeta ?? {};
  const metaLines = ["metadata:"];

  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === "string") {
      metaLines.push(`  ${key}: ${value}`);
    }
  }

  if (!meta.type) metaLines.push(`  type: ${opts.type}`);
  if (!meta.node_type) metaLines.push("  node_type: memory");

  return [
    "---",
    `name: ${opts.name}`,
    `description: ${JSON.stringify(opts.description)}`,
    ...metaLines,
    "---",
    ""
  ].join("\n");
}

function parseMEMORYmd(content: string): MemoryIndexEntry[] {
  const entries: MemoryIndexEntry[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^- \[(.+?)\]\((.+?\.md)\) — (.+)$/);
    if (match) {
      entries.push({
        name: match[1].trim(),
        file: match[2].trim(),
        description: match[3].trim()
      });
    }
  }

  return entries;
}

async function syncMemoryIndex(projectPath: string, name: string, description: string) {
  const root = memoryRoot(projectPath);
  const indexPath = path.join(root, "MEMORY.md");
  const existing = await readTextFile(indexPath);
  const file = `${name}.md`;
  const lines = existing ? existing.split("\n").filter((l) => l.trim()) : [];

  const newLine = `- [${name}](${file}) — ${description || name}`;
  const existingIdx = lines.findIndex((l) => l.includes(`(${file})`));

  if (existingIdx >= 0) {
    lines[existingIdx] = newLine;
  } else {
    lines.push(newLine);
  }

  await writeTextFile(indexPath, lines.join("\n") + "\n");
}

async function removeFromMemoryIndex(projectPath: string, name: string) {
  const root = memoryRoot(projectPath);
  const indexPath = path.join(root, "MEMORY.md");
  const existing = await readTextFile(indexPath);
  if (!existing) return;

  const file = `${name}.md`;
  const lines = existing.split("\n").filter((l) => l.trim() && !l.includes(`(${file})`));
  await writeTextFile(indexPath, lines.join("\n") + "\n");
}

function pathExists(targetPath: string) {
  return stat(targetPath).then(
    () => true,
    (error) => {
      if (isNotFound(error)) return false;
      throw error;
    }
  );
}

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
