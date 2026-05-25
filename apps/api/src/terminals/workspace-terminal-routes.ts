import type { FastifyInstance } from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ApiResponse,
  CreateWorkspaceTerminalRequest,
  DeleteWorkspaceTerminalResponse,
  SessionInputRequest,
  SessionResizeRequest,
  WorkspaceTerminalResponse,
  WorkspaceTerminalSnapshotResponse
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "../projects/http-error.js";
import { resolveSessionWorktree } from "../sessions/resolve-session-worktree.js";
import type { WorkspaceTerminalRuntimeManager } from "./workspace-terminal-runtime-manager.js";

type WorkspaceTerminalParams = {
  terminalId: string;
};

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");

export async function registerWorkspaceTerminalRoutes(server: FastifyInstance, database: DatabaseState, runtimeManager: WorkspaceTerminalRuntimeManager) {
  server.post<{ Body: CreateWorkspaceTerminalRequest }>("/api/workspace-terminal", async (request, reply): Promise<ApiResponse<WorkspaceTerminalResponse>> => {
    const input = normalizeCreateRequest(request.body);
    const resolved = input.projectId
      ? await resolveSessionWorktree(database, {
          projectId: input.projectId,
          worktreeId: input.worktreeId,
          requestedWorktreeName: input.requestedWorktreeName
        })
      : { worktreeId: null, requestedWorktreeName: null, cwd: workspaceRoot };

    const terminal = await runtimeManager.startTerminal({
      projectId: input.projectId,
      worktreeId: resolved.worktreeId,
      requestedWorktreeName: resolved.requestedWorktreeName,
      cwd: resolved.cwd
    });

    reply.status(201);
    return {
      ok: true,
      data: { terminal }
    };
  });

  server.get<{ Params: WorkspaceTerminalParams }>("/api/workspace-terminal/:terminalId", async (request): Promise<ApiResponse<WorkspaceTerminalSnapshotResponse>> => {
    const snapshot = runtimeManager.getSnapshot(request.params.terminalId);

    if (!snapshot) {
      throw new HttpError(404, "workspace_terminal_not_found", "终端不存在");
    }

    return {
      ok: true,
      data: snapshot
    };
  });

  server.post<{ Params: WorkspaceTerminalParams; Body: SessionInputRequest }>("/api/workspace-terminal/:terminalId/input", async (request): Promise<ApiResponse<WorkspaceTerminalResponse>> => {
    const terminal = runtimeManager.get(request.params.terminalId);

    if (!terminal) {
      throw new HttpError(404, "workspace_terminal_not_found", "终端不存在");
    }

    if (!isObject(request.body) || typeof request.body.data !== "string") {
      throw new HttpError(400, "validation_error", "终端输入必须是文本");
    }

    if (!runtimeManager.write(request.params.terminalId, request.body.data)) {
      throw new HttpError(409, "workspace_terminal_not_running", "终端当前未运行");
    }

    return {
      ok: true,
      data: { terminal }
    };
  });

  server.post<{ Params: WorkspaceTerminalParams; Body: SessionResizeRequest }>("/api/workspace-terminal/:terminalId/resize", async (request): Promise<ApiResponse<WorkspaceTerminalResponse>> => {
    const terminal = runtimeManager.get(request.params.terminalId);

    if (!terminal) {
      throw new HttpError(404, "workspace_terminal_not_found", "终端不存在");
    }

    if (!isObject(request.body) || !Number.isInteger(request.body.cols) || !Number.isInteger(request.body.rows)) {
      throw new HttpError(400, "validation_error", "终端尺寸不合法");
    }

    if (!runtimeManager.resize(request.params.terminalId, request.body.cols, request.body.rows)) {
      throw new HttpError(409, "workspace_terminal_not_running", "终端当前未运行");
    }

    return {
      ok: true,
      data: { terminal }
    };
  });

  server.post<{ Params: WorkspaceTerminalParams }>("/api/workspace-terminal/:terminalId/stop", async (request): Promise<ApiResponse<WorkspaceTerminalResponse>> => {
    const terminal = runtimeManager.get(request.params.terminalId);

    if (!terminal) {
      throw new HttpError(404, "workspace_terminal_not_found", "终端不存在");
    }

    if (!runtimeManager.stopTerminal(request.params.terminalId)) {
      throw new HttpError(409, "workspace_terminal_not_running", "终端当前未运行");
    }

    return {
      ok: true,
      data: { terminal: runtimeManager.get(request.params.terminalId) ?? terminal }
    };
  });

  server.delete<{ Params: WorkspaceTerminalParams }>("/api/workspace-terminal/:terminalId", async (request): Promise<ApiResponse<DeleteWorkspaceTerminalResponse>> => {
    const terminal = runtimeManager.get(request.params.terminalId);

    if (!terminal) {
      throw new HttpError(404, "workspace_terminal_not_found", "终端不存在");
    }

    runtimeManager.deleteTerminal(request.params.terminalId);

    return {
      ok: true,
      data: { deleted: true }
    };
  });

  server.get<{ Params: WorkspaceTerminalParams }>("/api/workspace-terminal/:terminalId/ws", { websocket: true }, (socket, request) => {
    const terminalId = request.params.terminalId;

    if (!runtimeManager.get(terminalId)) {
      socket.close(1008, "终端不存在");
      return;
    }

    socket.on("message", (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "input" && typeof message.data === "string") {
          runtimeManager.write(terminalId, message.data);
        } else if (message.type === "resize" && Number.isInteger(message.cols) && Number.isInteger(message.rows)) {
          runtimeManager.resize(terminalId, message.cols, message.rows);
        }
      } catch {
        // ignore malformed messages
      }
    });

    const onEvent = (event: { terminalId: string }) => {
      if (event.terminalId !== terminalId) {
        return;
      }

      if (socket.readyState !== 1) {
        return;
      }

      socket.send(JSON.stringify(event));
    };

    runtimeManager.on("event", onEvent);

    socket.on("close", () => {
      runtimeManager.off("event", onEvent);
    });
  });
}

function normalizeCreateRequest(body: CreateWorkspaceTerminalRequest | undefined) {
  if (body === undefined) {
    return {
      projectId: null,
      worktreeId: null,
      requestedWorktreeName: null
    };
  }

  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  const projectId = normalizeOptionalId(body.projectId, "项目 ID 不合法");
  const worktreeId = normalizeOptionalId(body.worktreeId, "Worktree ID 不合法");
  const requestedWorktreeName = normalizeOptionalText(body.requestedWorktreeName, "Worktree 名称不合法");

  if (!projectId && (worktreeId || requestedWorktreeName)) {
    throw new HttpError(400, "validation_error", "指定 Worktree 时必须同时提供项目 ID");
  }

  return {
    projectId,
    worktreeId,
    requestedWorktreeName
  };
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

function normalizeOptionalText(value: unknown, message: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", message);
  }

  return value.trim() || null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
