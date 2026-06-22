import type { AgentProvider } from "@workhorse-station/shared";

export type SessionProviderLaunchInput = {
  sessionId: string;
  cwd: string;
  prompt: string;
  resumeSessionId?: string;
  forkSession?: boolean;
};

export type SessionProviderLaunchSpec = {
  command: string;
  args: string[];
  cwd: string;
  providerThreadId: string | null;
  providerMetadata: Record<string, unknown> | null;
};

export type SessionProviderHistoryInput = {
  cwd: string | undefined;
  sessionId: string;
  providerThreadId?: string | null;
};

export type SessionProvider = {
  provider: AgentProvider;
  buildLaunchSpec: (input: SessionProviderLaunchInput, env?: NodeJS.ProcessEnv) => Promise<SessionProviderLaunchSpec>;
};
