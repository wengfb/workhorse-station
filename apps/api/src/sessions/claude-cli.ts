import { access } from "node:fs/promises";
import path from "node:path";
import { constants as fsConstants } from "node:fs";

const defaultCandidates = [
  process.env.CLAUDE_BIN,
  "/home/wengfb/.local/bin/claude",
  "/usr/local/bin/claude",
  "/usr/bin/claude"
].filter((value): value is string => Boolean(value));

export async function resolveClaudeBinary() {
  for (const candidate of defaultCandidates) {
    const resolved = path.resolve(candidate);

    try {
      await access(resolved, fsConstants.X_OK);
      return resolved;
    } catch {
      // try next candidate
    }
  }

  throw new Error("未找到 Claude 可执行文件，请设置 CLAUDE_BIN");
}
