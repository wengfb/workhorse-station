import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "../../..");

export function loadRootEnv() {
  loadEnvFile(path.join(rootDir, ".env"), false);

  const mode = normalizeEnvMode(process.env.NODE_ENV);
  if (mode) {
    loadEnvFile(path.join(rootDir, `.env.${mode}`), true);
  }
}

function loadEnvFile(envPath: string, override: boolean) {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  const seenKeys = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (seenKeys.has(key) || (!override && process.env[key] !== undefined)) {
      continue;
    }

    seenKeys.add(key);
    process.env[key] = parseEnvValue(rawValue);
  }
}

function normalizeEnvMode(value: string | undefined) {
  if (value === "development" || value === "production" || value === "test") {
    return value;
  }

  return null;
}

function parseEnvValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  const commentIndex = trimmed.indexOf(" #");
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trimEnd() : trimmed;
}
