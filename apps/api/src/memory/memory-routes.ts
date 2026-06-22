import type { FastifyInstance } from "fastify";
import type {
  AgentDocResponse,
  AgentProvider,
  ApiResponse,
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
  UpdateAgentDocRequest,
  UpdateClaudeMdRequest,
  UpdateMemoryRequest,
  UpdateRuleRequest
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "../projects/http-error.js";
import { normalizeProvider, requireProject } from "../utils/session-utils.js";
import {
  assertMemorySupported,
  assertRulesSupported,
  buildAgentDocResponse,
  claudeMdGlobalPath,
  claudeMdProjectPath,
  createMemory,
  createRule,
  deleteMemory,
  deleteRule,
  getAgentDocPath,
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

type ProviderQuery = {
  provider?: AgentProvider;
};

type ProjectParams = {
  projectId: string;
};

type NameParams = {
  name: string;
};

type ProjectNameParams = ProjectParams & NameParams;

export async function registerMemoryRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get<{ Querystring: ProviderQuery }>("/api/agent-docs/global", async (request): Promise<ApiResponse<AgentDocResponse>> => {
    const provider = normalizeProvider(request.query?.provider);
    const filePath = getAgentDocPath(provider, "global");
    const content = await readClaudeMd(filePath);

    return {
      ok: true,
      data: buildAgentDocResponse(provider, "global", filePath, content)
    };
  });

  server.put<{ Querystring: ProviderQuery; Body: UpdateAgentDocRequest }>(
    "/api/agent-docs/global",
    async (request): Promise<ApiResponse<AgentDocResponse>> => {
      const provider = normalizeProvider(request.query?.provider);
      const filePath = getAgentDocPath(provider, "global");
      const content = request.body?.content ?? "";
      await saveClaudeMd(filePath, content);

      return {
        ok: true,
        data: buildAgentDocResponse(provider, "global", filePath, content)
      };
    }
  );

  server.get<{ Params: ProjectParams; Querystring: ProviderQuery }>(
    "/api/projects/:projectId/agent-docs",
    async (request): Promise<ApiResponse<AgentDocResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      const filePath = getAgentDocPath(provider, "project", project.path);
      const content = await readClaudeMd(filePath);

      return {
        ok: true,
        data: buildAgentDocResponse(provider, "project", filePath, content)
      };
    }
  );

  server.put<{ Params: ProjectParams; Querystring: ProviderQuery; Body: UpdateAgentDocRequest }>(
    "/api/projects/:projectId/agent-docs",
    async (request): Promise<ApiResponse<AgentDocResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      const filePath = getAgentDocPath(provider, "project", project.path);
      const content = request.body?.content ?? "";
      await saveClaudeMd(filePath, content);

      return {
        ok: true,
        data: buildAgentDocResponse(provider, "project", filePath, content)
      };
    }
  );

  // Backward-compatible Claude-only aliases
  server.get("/api/claude-md/global", async (): Promise<ApiResponse<AgentDocResponse>> => {
    const filePath = claudeMdGlobalPath();
    const content = await readClaudeMd(filePath);

    return {
      ok: true,
      data: buildAgentDocResponse("claude", "global", filePath, content)
    };
  });

  server.put<{ Body: UpdateClaudeMdRequest }>(
    "/api/claude-md/global",
    async (request): Promise<ApiResponse<AgentDocResponse>> => {
      const filePath = claudeMdGlobalPath();
      const content = request.body?.content ?? "";
      await saveClaudeMd(filePath, content);

      return {
        ok: true,
        data: buildAgentDocResponse("claude", "global", filePath, content)
      };
    }
  );

  server.get<{ Params: ProjectParams }>(
    "/api/projects/:projectId/claude-md",
    async (request): Promise<ApiResponse<AgentDocResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const filePath = claudeMdProjectPath(project.path);
      const content = await readClaudeMd(filePath);

      return {
        ok: true,
        data: buildAgentDocResponse("claude", "project", filePath, content)
      };
    }
  );

  server.put<{ Params: ProjectParams; Body: UpdateClaudeMdRequest }>(
    "/api/projects/:projectId/claude-md",
    async (request): Promise<ApiResponse<AgentDocResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const filePath = claudeMdProjectPath(project.path);
      const content = request.body?.content ?? "";
      await saveClaudeMd(filePath, content);

      return {
        ok: true,
        data: buildAgentDocResponse("claude", "project", filePath, content)
      };
    }
  );

  server.get<{ Params: ProjectParams; Querystring: ProviderQuery }>(
    "/api/projects/:projectId/rules",
    async (request): Promise<ApiResponse<RulesResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);

      if (provider !== "claude") {
        return {
          ok: true,
          data: {
            provider,
            rules: [],
            available: false,
            readOnly: true,
            notice: "当前仅 Claude 支持项目规则目录。Codex 暂无独立规则目录映射。"
          }
        };
      }

      return {
        ok: true,
        data: {
          provider,
          rules: await listRules(project.path),
          available: true,
          readOnly: false,
          notice: null
        }
      };
    }
  );

  server.get<{ Params: ProjectNameParams; Querystring: ProviderQuery }>(
    "/api/projects/:projectId/rules/:name",
    async (request): Promise<ApiResponse<RuleResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertRulesSupported(provider);
      const rule = await readRule(project.path, request.params.name);

      return {
        ok: true,
        data: { rule }
      };
    }
  );

  server.post<{ Params: ProjectParams; Querystring: ProviderQuery; Body: CreateRuleRequest }>(
    "/api/projects/:projectId/rules",
    async (request, reply): Promise<ApiResponse<RuleResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertRulesSupported(provider);
      const rule = await createRule(project.path, request.body?.name, request.body?.content);
      reply.status(201);

      return {
        ok: true,
        data: { rule }
      };
    }
  );

  server.put<{ Params: ProjectNameParams; Querystring: ProviderQuery; Body: UpdateRuleRequest }>(
    "/api/projects/:projectId/rules/:name",
    async (request): Promise<ApiResponse<RuleResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertRulesSupported(provider);
      const rule = await updateRule(project.path, request.params.name, request.body?.content ?? "");

      return {
        ok: true,
        data: { rule }
      };
    }
  );

  server.delete<{ Params: ProjectNameParams; Querystring: ProviderQuery; Body: DeleteRuleRequest }>(
    "/api/projects/:projectId/rules/:name",
    async (request): Promise<ApiResponse<{ deleted: true }>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertRulesSupported(provider);
      await deleteRule(project.path, request.params.name, request.body?.confirmName);

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );

  server.get<{ Params: ProjectParams; Querystring: ProviderQuery }>(
    "/api/projects/:projectId/memory",
    async (request): Promise<ApiResponse<MemoriesResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);

      if (provider !== "claude") {
        return {
          ok: true,
          data: {
            provider,
            memories: [],
            indexEntries: [],
            available: false,
            readOnly: true,
            notice: "当前仅 Claude 暴露自动记忆目录。Codex 暂无等价自动记忆文件映射。"
          }
        };
      }

      const result = await listMemories(project.path);

      return {
        ok: true,
        data: {
          provider,
          ...result,
          available: true,
          readOnly: false,
          notice: null
        }
      };
    }
  );

  server.get<{ Params: ProjectNameParams; Querystring: ProviderQuery }>(
    "/api/projects/:projectId/memory/:name",
    async (request): Promise<ApiResponse<MemoryResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertMemorySupported(provider);
      const memory = await readMemory(project.path, request.params.name);

      return {
        ok: true,
        data: { memory }
      };
    }
  );

  server.post<{ Params: ProjectParams; Querystring: ProviderQuery; Body: CreateMemoryRequest }>(
    "/api/projects/:projectId/memory",
    async (request, reply): Promise<ApiResponse<MemoryResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertMemorySupported(provider);
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

  server.put<{ Params: ProjectNameParams; Querystring: ProviderQuery; Body: UpdateMemoryRequest }>(
    "/api/projects/:projectId/memory/:name",
    async (request): Promise<ApiResponse<MemoryResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertMemorySupported(provider);
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

  server.delete<{ Params: ProjectNameParams; Querystring: ProviderQuery; Body: DeleteMemoryRequest }>(
    "/api/projects/:projectId/memory/:name",
    async (request): Promise<ApiResponse<{ deleted: true }>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertMemorySupported(provider);
      await deleteMemory(project.path, request.params.name, request.body?.confirmName);

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );

  server.get<{ Params: ProjectParams; Querystring: ProviderQuery }>(
    "/api/projects/:projectId/memory-index",
    async (request): Promise<ApiResponse<MemoryIndexResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);

      if (provider !== "claude") {
        return {
          ok: true,
          data: {
            provider,
            entries: [],
            available: false,
            readOnly: true,
            notice: "当前仅 Claude 暴露自动记忆索引。Codex 暂无等价 MEMORY.md 映射。"
          }
        };
      }

      const entries = await readMemoryIndex(project.path);

      return {
        ok: true,
        data: {
          provider,
          entries,
          available: true,
          readOnly: false,
          notice: null
        }
      };
    }
  );

  server.put<{ Params: ProjectParams; Querystring: ProviderQuery; Body: { entries: MemoryIndexEntry[] } }>(
    "/api/projects/:projectId/memory-index",
    async (request): Promise<ApiResponse<MemoryIndexResponse>> => {
      const project = await requireProject(database, request.params.projectId);
      const provider = normalizeProvider(request.query?.provider);
      assertMemorySupported(provider);
      const entries = request.body?.entries ?? [];
      await writeMemoryIndex(project.path, entries);

      return {
        ok: true,
        data: {
          provider,
          entries,
          available: true,
          readOnly: false,
          notice: null
        }
      };
    }
  );
}
