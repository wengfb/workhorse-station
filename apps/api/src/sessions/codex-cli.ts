import { access } from "node:fs/promises";
import path from "node:path";
import { constants as fsConstants } from "node:fs";
import { which } from "../utils/which.js";

const defaultCandidates = [
  "/home/wengfb/.local/bin/codex",
  "/home/wengfb/.nvm/versions/node/v24.12.0/bin/codex",
  "/usr/local/bin/codex",
  "/usr/bin/codex"
];

export async function resolveCodexBinary(env?: NodeJS.ProcessEnv) {
  const candidates = [env?.CODEX_BIN, process.env.CODEX_BIN, ...defaultCandidates].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);

    try {
      await access(resolved, fsConstants.X_OK);
      return resolved;
    } catch {
      // try next candidate
    }
  }

  const fromWhich = await which("codex", env);

  if (fromWhich) {
    return fromWhich;
  }

  throw new Error("未找到 Codex 可执行文件，请设置 CODEX_BIN");
}
