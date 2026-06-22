import type { AgentProvider } from "@workhorse-station/shared";
import { resolveClaudeBinary } from "./claude-cli.js";
import { resolveCodexBinary } from "./codex-cli.js";
import type { SessionProvider } from "./session-provider.js";

const claudeProvider: SessionProvider = {
  provider: "claude",
  async buildLaunchSpec(input, env) {
    const command = await resolveClaudeBinary(env);
    const args = ["--dangerously-skip-permissions"];

    if (input.resumeSessionId) {
      args.push("--resume", input.resumeSessionId);
      if (input.forkSession) {
        args.push("--fork-session");
      }
    } else {
      args.push("--session-id", input.sessionId);
    }

    if (input.prompt.trim()) {
      args.push(input.prompt);
    }

    return {
      command,
      args,
      cwd: input.cwd,
      providerThreadId: input.resumeSessionId ?? input.sessionId,
      providerMetadata: null
    };
  }
};

const codexProvider: SessionProvider = {
  provider: "codex",
  async buildLaunchSpec(input, env) {
    const command = await resolveCodexBinary(env);
    const args: string[] = ["--dangerously-bypass-approvals-and-sandbox"];
    const startedAt = new Date().toISOString();

    if (input.resumeSessionId) {
      args.push(input.forkSession ? "fork" : "resume", input.resumeSessionId);
    }

    if (input.prompt.trim()) {
      args.push(input.prompt);
    }

    return {
      command,
      args,
      cwd: input.cwd,
      providerThreadId: input.resumeSessionId ?? null,
      providerMetadata: {
        startedAt,
        launchMode: input.resumeSessionId ? (input.forkSession ? "fork" : "resume") : "start"
      }
    };
  }
};

const providers = new Map<AgentProvider, SessionProvider>([
  ["claude", claudeProvider],
  ["codex", codexProvider]
]);

export function getSessionProvider(provider: AgentProvider): SessionProvider {
  const resolved = providers.get(provider);

  if (!resolved) {
    throw new Error(`Unsupported session provider: ${provider}`);
  }

  return resolved;
}
