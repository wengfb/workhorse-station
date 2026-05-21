import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ApiResponse, HealthResponse, MetaResponse, ProjectsResponse } from "@workhorse-station/shared";
import { initDatabase } from "./db/init.js";

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 3001);
const database = await initDatabase();

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  }
});

await server.register(cors, {
  origin: true
});

server.setErrorHandler((error, _request, reply) => {
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
    phase: "Phase 0",
    database: {
      connected: database.connected,
      path: database.path,
      fts5: database.fts5
    }
  }
}));

server.get("/api/projects", async (): Promise<ApiResponse<ProjectsResponse>> => ({
  ok: true,
  data: {
    projects: []
  }
}));

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
