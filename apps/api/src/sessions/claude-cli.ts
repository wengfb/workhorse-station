import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { constants as fsConstants } from "node:fs";

const defaultCandidates = [
  process.env.CLAUDE_BIN,
  "/home/wengfb/.local/bin/claude",
  "/home/wengfb/.nvm/versions/node/v25.2.1/bin/claude",
  "/usr/local/bin/claude",
  "/usr/bin/claude"
].filter((value): value is string => Boolean(value));

async function which(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("which", [command], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }

      const resolved = stdout.toString().trim();
      resolve(resolved || null);
    });
  });
}

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

  const fromWhich = await which("claude");

  if (fromWhich) {
    return fromWhich;
  }

  throw new Error("未找到 Claude 可执行文件，请设置 CLAUDE_BIN");
}
