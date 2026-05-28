import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  ClaudeMdResponse,
  CreateMemoryRequest,
  CreateRuleRequest,
  DeleteMemoryRequest,
  DeleteRuleRequest,
  MemoriesResponse,
  MemoryIndexEntry,
  MemoryIndexResponse,
  MemoryResponse,
  RuleResponse,
  RulesResponse,
  UpdateClaudeMdRequest,
  UpdateMemoryRequest,
  UpdateRuleRequest
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "../projects/http-error.js";
import { getProject } from "../projects/project-repository.js";
import {
  claudeMdGlobalPath,
  claudeMdProjectPath,
  createMemory,
  createRule,
  deleteMemory,
  deleteRule,
  listMemories,
  listRules,
  readClaudeMd,
  readMemory,
  readMemoryIndex,
  readRule,
  saveClaudeMd,
  updateMemory,
  updateRule,
  writeMemoryIndex
} from "./memory-fs.js";

type ProjectParams = {
  projectId: string;
};

type NameParams = {
  name: string;
};

type ProjectNameParams = ProjectParams & NameParams;

export async function registerMemoryRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get("/api/claude-md/global", async (): Promise<ApiResponse<ClaudeMdResponse>> => {
    const filePath = claudeMdGlobalPath();
    const content = await readClaudeMd(filePath);

    return {
      ok: true,
      data: { path: filePath, content }
    };
  });

  server.put<{ Body: UpdateClaudeMdRequest }>(
    "/api/claude-md/global",
    async (request): Promise<ApiResponse<ClaudeMdResponse>> => {
      const filePath = claudeMdGlobalPath();
      await saveClaudeMd(filePath, request.body?.content ?? "");

      return {
        ok: true,
        data: { path: filePath, content: request.body?.content ?? "" }
      };
    }
  );

  server.get<{ Params: ProjectParams }>(
    "/api/projects/:projectId/claude-md",
    async (request): Promise<ApiResponse<ClaudeMdResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const filePath = claudeMdProjectPath(project.path);
      const content = await readClaudeMd(filePath);

      return {
        ok: true,
        data: { path: filePath, content }
      };
    }
  );

  server.put<{ Params: ProjectParams; Body: UpdateClaudeMdRequest }>(
    "/api/projects/:projectId/claude-md",
    async (request): Promise<ApiResponse<ClaudeMdResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const filePath = claudeMdProjectPath(project.path);
      await saveClaudeMd(filePath, request.body?.content ?? "");

      return {
        ok: true,
        data: { path: filePath, content: request.body?.content ?? "" }
      };
    }
  );

  server.get<{ Params: ProjectParams }>(
    "/api/projects/:projectId/rules",
    async (request): Promise<ApiResponse<RulesResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      return {
        ok: true,
        data: { rules: await listRules(project.path) }
      };
    }
  );

  server.get<{ Params: ProjectNameParams }>(
    "/api/projects/:projectId/rules/:name",
    async (request): Promise<ApiResponse<RuleResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const rule = await readRule(project.path, request.params.name);

      return {
        ok: true,
        data: { rule }
      };
    }
  );

  server.post<{ Params: ProjectParams; Body: CreateRuleRequest }>(
    "/api/projects/:projectId/rules",
    async (request, reply): Promise<ApiResponse<RuleResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const rule = await createRule(project.path, request.body?.name, request.body?.content);
      reply.status(201);

      return {
        ok: true,
        data: { rule }
      };
    }
  );

  server.put<{ Params: ProjectNameParams; Body: UpdateRuleRequest }>(
    "/api/projects/:projectId/rules/:name",
    async (request): Promise<ApiResponse<RuleResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const rule = await updateRule(project.path, request.params.name, request.body?.content ?? "");

      return {
        ok: true,
        data: { rule }
      };
    }
  );

  server.delete<{ Params: ProjectNameParams; Body: DeleteRuleRequest }>(
    "/api/projects/:projectId/rules/:name",
    async (request): Promise<ApiResponse<{ deleted: true }>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      await deleteRule(project.path, request.params.name, request.body?.confirmName);

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );

  server.get<{ Params: ProjectParams }>(
    "/api/projects/:projectId/memory",
    async (request): Promise<ApiResponse<MemoriesResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const result = await listMemories(project.path);

      return {
        ok: true,
        data: result
      };
    }
  );

  server.get<{ Params: ProjectNameParams }>(
    "/api/projects/:projectId/memory/:name",
    async (request): Promise<ApiResponse<MemoryResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const memory = await readMemory(project.path, request.params.name);

      return {
        ok: true,
        data: { memory }
      };
    }
  );

  server.post<{ Params: ProjectParams; Body: CreateMemoryRequest }>(
    "/api/projects/:projectId/memory",
    async (request, reply): Promise<ApiResponse<MemoryResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const memory = await createMemory(project.path, {
        name: request.body?.name,
        type: request.body?.type,
        description: request.body?.description,
        content: request.body?.content
      });
      reply.status(201);

      return {
        ok: true,
        data: { memory }
      };
    }
  );

  server.put<{ Params: ProjectNameParams; Body: UpdateMemoryRequest }>(
    "/api/projects/:projectId/memory/:name",
    async (request): Promise<ApiResponse<MemoryResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const memory = await updateMemory(project.path, request.params.name, {
        name: request.body?.name,
        type: request.body?.type,
        description: request.body?.description,
        content: request.body?.content
      });

      return {
        ok: true,
        data: { memory }
      };
    }
  );

  server.delete<{ Params: ProjectNameParams; Body: DeleteMemoryRequest }>(
    "/api/projects/:projectId/memory/:name",
    async (request): Promise<ApiResponse<{ deleted: true }>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      await deleteMemory(project.path, request.params.name, request.body?.confirmName);

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );

  server.get<{ Params: ProjectParams }>(
    "/api/projects/:projectId/memory-index",
    async (request): Promise<ApiResponse<MemoryIndexResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const entries = await readMemoryIndex(project.path);

      return {
        ok: true,
        data: { entries }
      };
    }
  );

  server.put<{ Params: ProjectParams; Body: { entries: MemoryIndexEntry[] } }>(
    "/api/projects/:projectId/memory-index",
    async (request): Promise<ApiResponse<MemoryIndexResponse>> => {
      const project = await getProject(database.db, request.params.projectId);
      if (!project) throw new HttpError(404, "project_not_found", "项目不存在");

      const entries = request.body?.entries ?? [];
      await writeMemoryIndex(project.path, entries);

      return {
        ok: true,
        data: { entries }
      };
    }
  );
}
