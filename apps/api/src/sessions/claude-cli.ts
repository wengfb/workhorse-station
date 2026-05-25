import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { constants as fsConstants } from "node:fs";

const defaultCandidates = [
  "/home/wengfb/.local/bin/claude",
  "/home/wengfb/.nvm/versions/node/v25.2.1/bin/claude",
  "/usr/local/bin/claude",
  "/usr/bin/claude"
];

async function which(command: string, env?: NodeJS.ProcessEnv): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("which", [command], { timeout: 5000, env }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }

      const resolved = stdout.toString().trim();
      resolve(resolved || null);
    });
  });
}

export async function resolveClaudeBinary(env?: NodeJS.ProcessEnv) {
  const candidates = [env?.CLAUDE_BIN, process.env.CLAUDE_BIN, ...defaultCandidates].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);

    try {
      await access(resolved, fsConstants.X_OK);
      return resolved;
    } catch {
      // try next candidate
    }
  }

  const fromWhich = await which("claude", env);

  if (fromWhich) {
    return fromWhich;
  }

  throw new Error("未找到 Claude 可执行文件，请设置 CLAUDE_BIN");
}
