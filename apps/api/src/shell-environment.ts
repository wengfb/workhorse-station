import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";

const shellEnvMarker = "__WORKHORSE_SHELL_ENV_START__";
const terminalDefaults = {
  TERM: "xterm-256color"
} as const;

export type PtySpawnContext = {
  shell: string;
  env: NodeJS.ProcessEnv;
};

let cachedPtySpawnContextPromise: Promise<PtySpawnContext> | null = null;

export function getPtySpawnContext() {
  if (!cachedPtySpawnContextPromise) {
    cachedPtySpawnContextPromise = loadPtySpawnContext();
  }

  return cachedPtySpawnContextPromise;
}

async function loadPtySpawnContext(): Promise<PtySpawnContext> {
  const shell = await resolveLoginShell();
  const fallbackEnv = buildFallbackEnvironment(shell);

  try {
    const loginShellEnv = await readLoginShellEnvironment(shell, fallbackEnv);
    const mergedEnv: NodeJS.ProcessEnv = {
      ...fallbackEnv,
      ...loginShellEnv,
      ...terminalDefaults
    };

    mergedEnv.SHELL = normalizeShellPath(mergedEnv.SHELL) ?? shell;
    mergedEnv.HOME = mergedEnv.HOME || fallbackEnv.HOME;
    mergedEnv.USER = mergedEnv.USER || fallbackEnv.USER;
    mergedEnv.LOGNAME = mergedEnv.LOGNAME || fallbackEnv.LOGNAME;

    return {
      shell: mergedEnv.SHELL,
      env: mergedEnv
    };
  } catch (error) {
    console.warn("[shell-env] 无法从默认终端加载环境变量，回退到服务进程环境", error instanceof Error ? error.message : error);
    return {
      shell,
      env: {
        ...fallbackEnv,
        ...terminalDefaults
      }
    };
  }
}

async function resolveLoginShell() {
  const envShell = normalizeShellPath(process.env.SHELL);
  if (envShell) {
    return envShell;
  }

  const passwdShell = await readShellFromPasswd();
  return passwdShell ?? "/bin/bash";
}

async function readShellFromPasswd() {
  try {
    const passwd = await readFile("/etc/passwd", "utf8");
    const username = os.userInfo().username;

    for (const line of passwd.split("\n")) {
      if (!line || line.startsWith("#")) {
        continue;
      }

      const parts = line.split(":");
      if (parts[0] !== username) {
        continue;
      }

      return normalizeShellPath(parts[6]);
    }
  } catch {
    return null;
  }

  return null;
}

function buildFallbackEnvironment(shell: string): NodeJS.ProcessEnv {
  const user = os.userInfo();

  return {
    ...process.env,
    HOME: process.env.HOME || user.homedir,
    USER: process.env.USER || user.username,
    LOGNAME: process.env.LOGNAME || user.username,
    SHELL: normalizeShellPath(process.env.SHELL) ?? shell
  };
}

function readLoginShellEnvironment(shell: string, env: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
  return new Promise((resolve, reject) => {
    execFile(
      shell,
      ["-lic", `printf '%s\\0' '${shellEnvMarker}'; env -0`],
      {
        env,
        encoding: "buffer",
        maxBuffer: 8 * 1024 * 1024,
        timeout: 10_000
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          resolve(parseEnvironmentOutput(stdout));
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });
}

function parseEnvironmentOutput(stdout: Buffer) {
  const raw = stdout.toString("utf8");
  const markerIndex = raw.indexOf(shellEnvMarker);
  const payload = markerIndex >= 0 ? raw.slice(markerIndex + shellEnvMarker.length + 1) : raw;
  const env: NodeJS.ProcessEnv = {};

  for (const entry of payload.split("\0")) {
    if (!entry) {
      continue;
    }

    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    env[key] = entry.slice(separatorIndex + 1);
  }

  return env;
}

function normalizeShellPath(shell: string | undefined | null) {
  const value = shell?.trim();
  return value ? value : null;
}
