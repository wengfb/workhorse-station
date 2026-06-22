import { execFile } from "node:child_process";

export async function which(command: string, env?: NodeJS.ProcessEnv): Promise<string | null> {
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
