import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseFrontmatter } from "./skill-frontmatter.js";

export type SkillMetadata = {
  name: string;
  description: string;
  path: string;
};

export type LoadedSkill = {
  metadata: SkillMetadata;
  body: string;
};

export function getChatSkillsRoot(): string {
  return path.join(os.homedir(), ".workhorse", "chat-skills");
}

export async function listChatSkills(): Promise<SkillMetadata[]> {
  const root = getChatSkillsRoot();

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: SkillMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;

    const skillMdPath = path.join(root, entry.name, "SKILL.md");
    try {
      const meta = await parseSkillFrontmatter(skillMdPath);
      if (meta) {
        skills.push(meta);
      }
    } catch (err) {
      console.warn(`[skill-loader] 跳过无效 skill: ${entry.name}`, err instanceof Error ? err.message : err);
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

export async function loadChatSkill(name: string): Promise<LoadedSkill | null> {
  const root = getChatSkillsRoot();
  const skillMdPath = path.join(root, name, "SKILL.md");

  try {
    const raw = await readFile(skillMdPath, "utf-8");
    const parsed = parseFrontmatter(raw);

    if (!parsed) return null;

    return {
      metadata: {
        name: parsed.name || name,
        description: parsed.description || "",
        path: skillMdPath
      },
      body: parsed.body
    };
  } catch {
    return null;
  }
}

async function parseSkillFrontmatter(skillMdPath: string): Promise<SkillMetadata | null> {
  const raw = await readFile(skillMdPath, "utf-8");
  const parsed = parseFrontmatter(raw);
  if (!parsed || !parsed.name) return null;

  return {
    name: parsed.name,
    description: parsed.description || "",
    path: skillMdPath
  };
}

