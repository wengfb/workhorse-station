import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import Fastify from "fastify";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { ApiResponse, HealthResponse, MetaResponse } from "@workhorse-station/shared";
import { registerChatRoutes } from "./chat/chat-routes.js";
import { initDatabase } from "./db/init.js";
import { registerNoteRoutes } from "./notes/note-routes.js";
import { registerPromptDraftRoutes } from "./prompt-drafts/prompt-draft-routes.js";
import { isHttpError } from "./projects/http-error.js";
import { registerProjectRoutes } from "./projects/project-routes.js";
import { registerSessionRoutes } from "./sessions/session-routes.js";
import { registerSkillRoutes } from "./skills/skill-routes.js";
import { registerSkillStoreRoutes } from "./skills/skill-store-routes.js";
import { registerChatSkillRoutes } from "./skills/chat-skill-routes.js";
import { registerMemoryRoutes } from "./memory/memory-routes.js";
import { reconcileSessionsOnStartup } from "./sessions/session-repository.js";
import { SessionRuntimeManager } from "./sessions/session-runtime-manager.js";
import { registerTodoRoutes } from "./todos/todo-routes.js";
import { registerWorktreeRoutes } from "./worktrees/worktree-routes.js";

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 3001);
const database = await initDatabase();
reconcileSessionsOnStartup(database.db);
database.persist();
const sessionRuntimeManager = new SessionRuntimeManager(database);

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  }
});

await server.register(cors, {
  origin: true
});

await server.register(fastifyWebsocket);

server.setErrorHandler((error, _request, reply) => {
  if (isHttpError(error)) {
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: error.code,
        message: error.message
      }
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  server.log.error(error);
  const response: ApiResponse<never> = {
    ok: false,
    error: {
      code: "internal_error",
      message: "Internal server error"
    }
  };
  reply.status(500).send(response);
});

server.get("/health", async (): Promise<ApiResponse<HealthResponse>> => ({
  ok: true,
  data: {
    status: "ok",
    service: "workhorse-station-api",
    timestamp: new Date().toISOString()
  }
}));

server.get("/api/meta", async (): Promise<ApiResponse<MetaResponse>> => ({
  ok: true,
  data: {
    appName: "Workhorse Station",
    phase: "Phase 2",
    database: {
      connected: database.connected,
      path: database.path,
      fts5: database.fts5
    }
  }
}));

await registerProjectRoutes(server, database);
await registerChatRoutes(server, database);
await registerWorktreeRoutes(server, database);
await registerNoteRoutes(server, database);
await registerTodoRoutes(server, database);
await registerPromptDraftRoutes(server, database);
await registerSessionRoutes(server, database, sessionRuntimeManager);
await registerSkillRoutes(server, database);
  await registerSkillStoreRoutes(server, database);
  await registerChatSkillRoutes(server);
await registerMemoryRoutes(server, database);

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDistPath = path.resolve(__dirname, "../../web/dist");

  await server.register(fastifyStatic, {
    root: webDistPath,
    prefix: "/"
  });

  server.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api/") && request.url !== "/health") {
      return reply.sendFile("index.html");
    }
    reply.status(404).send({
      ok: false,
      error: { code: "not_found", message: "Not found" }
    });
  });
}

const close = async () => {
  await server.close();
  database.close();
};

process.on("SIGINT", () => {
  void close().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void close().finally(() => process.exit(0));
});

try {
  await server.listen({ host, port });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
