import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  CreateSessionRequest,
  DeleteSessionResponse,
  RecentSessionsResponse,
  RunningSessionsResponse,
  SessionInputRequest,
  SessionResponse,
  SessionResizeRequest,
  SessionsResponse,
  SessionResultSummary,
  SessionSource,
  SessionStatus,
  SessionSummary,
  SessionTerminalSnapshotResponse,
  StopSessionResponse,
  UpdateSessionRequest,
  SessionHistoryResponse,
  SessionHistoryMessage,
  SessionHistoryMessageBlock
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { getProject, updateProjectLatestSessionResult } from "../projects/project-repository.js";
import { HttpError } from "../projects/http-error.js";
import { getProjectPromptDraft } from "../prompt-drafts/prompt-draft-repository.js";
import { getProjectTodo, updateTodoLatestSessionResult } from "../todos/todo-repository.js";
import {
  createSessionRecord,
  deleteSessionRecord,
  getProjectSession,
  listRecentSessions,
  listRunningSessions,
  listSessions,
  updateSessionCompletion,
  updateSessionLaunch,
  updateSessionRecord,
  type SessionWriteInput
} from "./session-repository.js";
import { resolveSessionWorktree } from "./resolve-session-worktree.js";
import { SessionRuntimeManager } from "./session-runtime-manager.js";
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";

 type ProjectParams = {
  projectId: string;
};

type ProjectSessionParams = ProjectParams & {
  sessionId: string;
};

const sessionSources: SessionSource[] = ["direct", "todo"];
const sessionStatuses: SessionStatus[] = ["draft", "queued", "running", "completed", "failed"];

export async function registerSessionRoutes(server: FastifyInstance, database: DatabaseState, runtimeManager: SessionRuntimeManager) {
  server.get<{ Params: ProjectParams }>("/api/projects/:projectId/sessions", async (request): Promise<ApiResponse<SessionsResponse>> => {
    assertProjectExists(database, request.params.projectId);

    return {
      ok: true,
      data: {
        sessions: listSessions(database.db, request.params.projectId)
      }
    };
  });

  server.post<{ Params: ProjectParams; Body: CreateSessionRequest }>("/api/projects/:projectId/sessions", async (request, reply): Promise<ApiResponse<SessionResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const input = buildSessionInput(database, request.params.projectId, request.body);
    const resolvedWorktree = await resolveSessionWorktree(database, {
      projectId: request.params.projectId,
      worktreeId: input.worktreeId,
      requestedWorktreeName: input.requestedWorktreeName
    });

    const session = createSessionRecord(database.db, {
      ...input,
      worktreeId: resolvedWorktree.worktreeId,
      requestedWorktreeName: resolvedWorktree.requestedWorktreeName,
      status: "queued",
      runtimeStatus: "starting",
      pid: null,
      cwd: resolvedWorktree.cwd,
      resolvedWorktreePath: resolvedWorktree.resolvedWorktreePath,
      exitCode: null,
      lastActivityAt: null
    });
    database.persist();

    try {
      const runtime = await runtimeManager.startSession({
        sessionId: session.id,
        projectId: request.params.projectId,
        cwd: resolvedWorktree.cwd,
        resolvedWorktreePath: resolvedWorktree.resolvedWorktreePath,
        prompt: input.prompt,
        resumeSessionId: input.resumeSessionId ?? undefined,
        forkSession: input.forkSession ?? false
      });

      const launchedSession = updateSessionLaunch(database.db, request.params.projectId, session.id, {
        status: "running",
        runtimeStatus: runtime.runtimeStatus,
        worktreeId: resolvedWorktree.worktreeId,
        requestedWorktreeName: resolvedWorktree.requestedWorktreeName,
        pid: runtime.pid,
        cwd: runtime.cwd,
        resolvedWorktreePath: resolvedWorktree.resolvedWorktreePath,
        lastActivityAt: runtime.lastActivityAt,
        summary: input.summary
      });
      database.persist();
      reply.status(201);

      if (!launchedSession) {
        throw new Error("Failed to read launched session");
      }

      return {
        ok: true,
        data: { session: launchedSession }
      };
    } catch (error) {
      updateSessionCompletion(database.db, request.params.projectId, session.id, {
        status: "failed",
        runtimeStatus: "failed",
        exitCode: 1,
        lastActivityAt: new Date().toISOString(),
        summary: error instanceof Error ? error.message : "Claude Code 启动失败"
      });
      database.persist();
      throw new HttpError(500, "session_start_failed", error instanceof Error ? error.message : "Claude Code 启动失败");
    }
  });

  server.patch<{ Params: ProjectSessionParams; Body: UpdateSessionRequest }>("/api/projects/:projectId/sessions/:sessionId", async (request): Promise<ApiResponse<SessionResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const currentSession = getProjectSession(database.db, request.params.projectId, request.params.sessionId);

    if (!currentSession) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    const updateRequest = normalizeUpdateRequest(request.body);
    const session = updateSessionRecord(database.db, request.params.projectId, request.params.sessionId, {
      name: normalizeName(request.body?.name ?? currentSession.name, currentSession.source, currentSession.todoId),
      summary: normalizeSummary(request.body?.summary === undefined ? currentSession.summary : request.body.summary)
    });

    if (!session) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    if (updateRequest.applyResultToTodo) {
      applySessionResultToTodo(database, request.params.projectId, session);
    }

    if (updateRequest.applyResultToProject) {
      applySessionResultToProject(database, request.params.projectId, session);
    }

    database.persist();

    return {
      ok: true,
      data: { session }
    };
  });

  server.post<{ Params: ProjectSessionParams }>("/api/projects/:projectId/sessions/:sessionId/stop", async (request): Promise<ApiResponse<StopSessionResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const currentSession = getProjectSession(database.db, request.params.projectId, request.params.sessionId);

    if (!currentSession) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    runtimeManager.stopSession(request.params.projectId, request.params.sessionId);
    const session = getProjectSession(database.db, request.params.projectId, request.params.sessionId) ?? currentSession;

    return {
      ok: true,
      data: { session }
    };
  });

  server.get<{ Params: ProjectSessionParams }>("/api/projects/:projectId/sessions/:sessionId/terminal", async (request): Promise<ApiResponse<SessionTerminalSnapshotResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const currentSession = getProjectSession(database.db, request.params.projectId, request.params.sessionId);

    if (!currentSession) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    const snapshot = runtimeManager.getSnapshot(request.params.sessionId);

    return {
      ok: true,
      data: snapshot ?? {
        sessionId: currentSession.id,
        buffer: currentSession.terminalBuffer ?? "",
        runtimeStatus: currentSession.runtimeStatus,
        cwd: currentSession.cwd
      }
    };
  });

  server.post<{ Params: ProjectSessionParams; Body: SessionInputRequest }>("/api/projects/:projectId/sessions/:sessionId/input", async (request): Promise<ApiResponse<SessionResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const session = getProjectSession(database.db, request.params.projectId, request.params.sessionId);

    if (!session) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    if (!isObject(request.body) || typeof request.body.data !== "string") {
      throw new HttpError(400, "validation_error", "终端输入必须是文本");
    }

    if (!runtimeManager.write(request.params.sessionId, request.body.data)) {
      throw new HttpError(409, "session_not_running", "会话当前未运行");
    }

    return {
      ok: true,
      data: { session }
    };
  });

  server.post<{ Params: ProjectSessionParams; Body: SessionResizeRequest }>("/api/projects/:projectId/sessions/:sessionId/resize", async (request): Promise<ApiResponse<SessionResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const session = getProjectSession(database.db, request.params.projectId, request.params.sessionId);

    if (!session) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    if (!isObject(request.body) || !Number.isInteger(request.body.cols) || !Number.isInteger(request.body.rows)) {
      throw new HttpError(400, "validation_error", "终端尺寸不合法");
    }

    if (!runtimeManager.resize(request.params.sessionId, request.body.cols, request.body.rows)) {
      throw new HttpError(409, "session_not_running", "会话当前未运行");
    }

    return {
      ok: true,
      data: { session }
    };
  });

  server.get<{ Params: ProjectSessionParams }>("/api/projects/:projectId/sessions/:sessionId/ws", { websocket: true }, (socket, request) => {
    const sessionId = request.params.sessionId;

    if (!getProjectSession(database.db, request.params.projectId, sessionId)) {
      socket.close(1008, "会话不存在");
      return;
    }

    socket.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "input" && typeof msg.data === "string") {
          runtimeManager.write(sessionId, msg.data);
        } else if (msg.type === "resize" && Number.isInteger(msg.cols) && Number.isInteger(msg.rows)) {
          runtimeManager.resize(sessionId, msg.cols, msg.rows);
        }
      } catch {
        // ignore malformed messages
      }
    });

    const onEvent = (event: { sessionId: string }) => {
      if (event.sessionId !== sessionId) return;
      if (socket.readyState !== 1) return;
      socket.send(JSON.stringify(event));
    };

    runtimeManager.on("event", onEvent);

    socket.on("close", () => {
      runtimeManager.off("event", onEvent);
    });
  });

  server.get<{ Params: ProjectSessionParams }>("/api/projects/:projectId/sessions/:sessionId/events", async (request, reply) => {
    assertProjectExists(database, request.params.projectId);

    if (!getProjectSession(database.db, request.params.projectId, request.params.sessionId)) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    reply.raw.write("\n");

    const onEvent = (event: { sessionId: string }) => {
      if (event.sessionId !== request.params.sessionId) {
        return;
      }

      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    runtimeManager.on("event", onEvent);
    request.raw.on("close", () => {
      runtimeManager.off("event", onEvent);
      reply.raw.end();
    });
  });

  server.get<{ Params: ProjectSessionParams }>("/api/projects/:projectId/sessions/:sessionId/history", async (request): Promise<ApiResponse<SessionHistoryResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const session = getProjectSession(database.db, request.params.projectId, request.params.sessionId);

    if (!session) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    const messages = await parseClaudeCodeHistory(session.cwd ?? undefined, request.params.sessionId);

    return {
      ok: true,
      data: {
        sessionId: request.params.sessionId,
        messages
      }
    };
  });

  server.delete<{ Params: ProjectSessionParams }>("/api/projects/:projectId/sessions/:sessionId", async (request): Promise<ApiResponse<DeleteSessionResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const stoppedRuntime = runtimeManager.stopSession(request.params.projectId, request.params.sessionId);

    if (!deleteSessionRecord(database.db, request.params.projectId, request.params.sessionId)) {
      throw new HttpError(404, "session_not_found", "会话不存在");
    }

    database.persist();

    return {
      ok: true,
      data: { deleted: true, stoppedRuntime }
    };
  });

  server.get("/api/sessions/running", async (): Promise<ApiResponse<RunningSessionsResponse>> => ({
    ok: true,
    data: { sessions: listRunningSessions(database.db) }
  }));

  server.get<{ Querystring: { limit?: string } }>("/api/sessions/recent", async (request): Promise<ApiResponse<RecentSessionsResponse>> => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 10, 1), 50);
    return {
      ok: true,
      data: { sessions: listRecentSessions(database.db, limit) }
    };
  });
}

function assertProjectExists(database: DatabaseState, projectId: string) {
  if (!getProject(database.db, projectId)) {
    throw new HttpError(404, "project_not_found", "项目不存在");
  }
}

function buildSessionInput(database: DatabaseState, projectId: string, body: CreateSessionRequest | undefined): SessionWriteInput {
  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  const todoId = normalizeOptionalId(body.todoId, "待办 ID 不合法");
  const worktreeId = normalizeOptionalId(body.worktreeId, "Worktree ID 不合法");
  const promptDraftId = normalizeOptionalId(body.promptDraftId, "Prompt 草稿 ID 不合法");
  const requestedWorktreeName = normalizeRequestedWorktreeName(body.requestedWorktreeName);

  if (todoId && !getProjectTodo(database.db, projectId, todoId)) {
    throw new HttpError(400, "todo_not_found", "待办不存在或不属于当前项目");
  }

  if (promptDraftId && !getProjectPromptDraft(database.db, projectId, promptDraftId)) {
    throw new HttpError(400, "prompt_draft_not_found", "Prompt 草稿不存在或不属于当前项目");
  }

  const prompt = normalizePrompt(body.prompt);
  const source = normalizeSource(body.source);
  const resumeSessionId = normalizeOptionalId(body.resumeSessionId, "续接会话 ID 不合法");
  const forkSession = normalizeBoolean(body.forkSession, "分叉标记不合法");

  return {
    projectId,
    worktreeId,
    todoId,
    promptDraftId,
    requestedWorktreeName,
    source,
    name: normalizeName(body.name, source, todoId),
    prompt,
    status: normalizeStatus(body.status),
    runtimeStatus: null,
    summary: normalizeSummary(body.summary),
    pid: null,
    cwd: null,
    resolvedWorktreePath: null,
    exitCode: null,
    lastActivityAt: null,
    resumeSessionId,
    forkSession
  };
}

function buildSessionResultSummary(session: SessionSummary): SessionResultSummary {
  return {
    sessionId: session.id,
    sessionName: session.name,
    summary: session.summary ?? "",
    status: session.status,
    exitCode: session.exitCode,
    updatedAt: session.updatedAt
  };
}

function assertSummaryPresent(summary: string | null) {
  if (!summary?.trim()) {
    throw new HttpError(400, "session_summary_required", "请先填写会话结果后再执行回写");
  }
}

function applySessionResultToTodo(database: DatabaseState, projectId: string, session: SessionSummary) {
  assertSummaryPresent(session.summary);

  if (!session.todoId) {
    throw new HttpError(400, "session_todo_missing", "当前会话没有关联任务");
  }

  if (!getProjectTodo(database.db, projectId, session.todoId)) {
    throw new HttpError(404, "todo_not_found", "待办不存在或不属于当前项目");
  }

  updateTodoLatestSessionResult(database.db, projectId, session.todoId, buildSessionResultSummary(session));
}

function applySessionResultToProject(database: DatabaseState, projectId: string, session: SessionSummary) {
  assertSummaryPresent(session.summary);

  if (!getProject(database.db, projectId)) {
    throw new HttpError(404, "project_not_found", "项目不存在");
  }

  updateProjectLatestSessionResult(database.db, projectId, buildSessionResultSummary(session));
}

function normalizeUpdateRequest(body: UpdateSessionRequest | undefined) {
  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  return {
    applyResultToTodo: normalizeBoolean(body.applyResultToTodo, "任务回写标记不合法"),
    applyResultToProject: normalizeBoolean(body.applyResultToProject, "项目回写标记不合法")
  };
}

function normalizePrompt(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "会话 Prompt 格式不合法");
  }

  const prompt = value.trim();

  if (prompt.length > 40000) {
    throw new HttpError(400, "validation_error", "会话 Prompt 不能超过 40000 个字符");
  }

  return value;
}

function normalizeName(value: unknown, source: SessionSource, todoId: string | null) {
  if (value === undefined || value === null || value === "") {
    return source === "todo" && todoId ? "待办会话" : "直接会话";
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "会话名称不合法");
  }

  const name = value.trim();

  if (!name) {
    throw new HttpError(400, "validation_error", "会话名称不能为空");
  }

  if (name.length > 120) {
    throw new HttpError(400, "validation_error", "会话名称不能超过 120 个字符");
  }

  return name;
}

function normalizeStatus(value: unknown): SessionStatus {
  if (value === undefined) {
    return "draft";
  }

  if (typeof value !== "string" || !sessionStatuses.includes(value as SessionStatus)) {
    throw new HttpError(400, "validation_error", "会话状态不合法");
  }

  return value as SessionStatus;
}

function normalizeSource(value: unknown): SessionSource {
  if (value === undefined) {
    return "direct";
  }

  if (typeof value !== "string" || !sessionSources.includes(value as SessionSource)) {
    throw new HttpError(400, "validation_error", "会话来源不合法");
  }

  return value as SessionSource;
}

function normalizeSummary(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "会话摘要必须是文本");
  }

  if (value.length > 20000) {
    throw new HttpError(400, "validation_error", "会话摘要不能超过 20000 个字符");
  }

  return value;
}

function normalizeRequestedWorktreeName(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "Worktree 名称不合法");
  }

  const name = value.trim();

  if (!name) {
    return null;
  }

  if (name.length > 120) {
    throw new HttpError(400, "validation_error", "Worktree 名称不能超过 120 个字符");
  }

  return name;
}

function normalizeBoolean(value: unknown, message: string) {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new HttpError(400, "validation_error", message);
  }

  return value;
}

function normalizeOptionalId(value: unknown, message: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", message);
  }

  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectCwdToClaudeSlug(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

type JsonlAssistantContent = {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
};

type JsonlUserMessage = {
  role: string;
  content: string | Array<{ type: string; tool_use_id?: string; content?: unknown }>;
};

type JsonlRecord = {
  type: string;
  message?: JsonlUserMessage | { content: JsonlAssistantContent[] };
  isSidechain?: boolean;
  timestamp?: string;
};

async function parseClaudeCodeHistory(cwd: string | undefined, sessionId: string): Promise<SessionHistoryMessage[]> {
  if (!cwd) {
    return [];
  }

  const slug = projectCwdToClaudeSlug(cwd);
  const jsonlPath = path.join(os.homedir(), ".claude", "projects", slug, `${sessionId}.jsonl`);

  if (!existsSync(jsonlPath)) {
    return [];
  }

  const messages: SessionHistoryMessage[] = [];
  let currentAssistant: SessionHistoryMessage | null = null;

  const fileStream = createReadStream(jsonlPath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    try {
      const record: JsonlRecord = JSON.parse(line);

      if (record.type === "user" && record.message) {
        const msg = record.message as JsonlUserMessage;

        if (Array.isArray(msg.content)) {
          const hasToolResult = msg.content.some(c => c.type === "tool_result");
          if (hasToolResult) {
            const blocks: SessionHistoryMessageBlock[] = msg.content
              .filter(c => c.type === "tool_result")
              .map(c => ({
                type: "tool_result" as const,
                toolResult: typeof c.content === "string" ? c.content : JSON.stringify(c.content)
              }));
            if (currentAssistant) {
              currentAssistant.content.push(...blocks);
            }
          } else {
            messages.push({
              role: "user",
              content: [{ type: "text", text: JSON.stringify(msg.content) }],
              timestamp: record.timestamp ?? null,
              isSidechain: record.isSidechain ?? false
            });
          }
        } else if (typeof msg.content === "string" && msg.content.trim()) {
          messages.push({
            role: "user",
            content: [{ type: "text", text: msg.content }],
            timestamp: record.timestamp ?? null,
            isSidechain: record.isSidechain ?? false
          });
        }
      } else if (record.type === "assistant" && record.message) {
        const msg = record.message as { content: JsonlAssistantContent[] };
        const blocks: SessionHistoryMessageBlock[] = [];

        if (Array.isArray(msg.content)) {
          for (const c of msg.content) {
            if (c.type === "text" && c.text) {
              blocks.push({ type: "text", text: c.text });
            } else if (c.type === "tool_use") {
              blocks.push({
                type: "tool_use",
                toolName: c.name ?? "unknown",
                toolInput: c.input ?? {}
              });
            }
          }
        }

        if (blocks.length > 0) {
          currentAssistant = {
            role: "assistant",
            content: blocks,
            timestamp: record.timestamp ?? null,
            isSidechain: record.isSidechain ?? false
          };
          messages.push(currentAssistant);
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}
