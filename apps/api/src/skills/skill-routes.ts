import type { FastifyInstance } from "fastify";
import type {
  AddGlobalSkillToStoreRequest,
  AddProjectSkillToStoreRequest,
  ApiResponse,
  CopyGlobalSkillRequest,
  CopyProjectSkillRequest,
  CopySkillResponse,
  CreateSkillRequest,
  DeleteSkillRequest,
  ProjectSkillResponse,
  ProjectSkillsResponse,
  RenameSkillRequest,
  SkillDocumentResponse,
  SkillResponse,
  SkillsResponse,
  StoreSkillResponse,
  UpdateSkillDocumentRequest
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "../projects/http-error.js";
import { getProject } from "../projects/project-repository.js";
import {
  addGlobalSkillToStore,
  addProjectSkillToStore,
  copyGlobalSkillToProject,
  copyProjectSkillToGlobal,
  createGlobalSkill,
  createProjectSkill,
  deleteGlobalSkill,
  deleteProjectSkill,
  listGlobalSkills,
  listProjectSkillView,
  readGlobalSkillDocument,
  readProjectSkillDocument,
  renameGlobalSkill,
  renameProjectSkill,
  updateGlobalSkillDocument,
  updateProjectSkillDocument
} from "./skill-fs.js";
import { getStoreSkillStatus } from "./skill-store.js";

type SkillParams = {
  name: string;
};

type ProjectSkillParams = SkillParams & {
  projectId: string;
};

type ProjectParams = {
  projectId: string;
};

export async function registerSkillRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get("/api/skills", async (): Promise<ApiResponse<SkillsResponse>> => ({
    ok: true,
    data: {
      skills: await listGlobalSkills()
    }
  }));

  server.post<{ Body: CreateSkillRequest }>("/api/skills", async (request, reply): Promise<ApiResponse<SkillResponse>> => {
    const skill = await createGlobalSkill(request.body?.name);
    reply.status(201);

    return {
      ok: true,
      data: { skill }
    };
  });

  server.get<{ Params: SkillParams }>("/api/skills/:name/document", async (request): Promise<ApiResponse<SkillDocumentResponse>> => {
    const document = await readGlobalSkillDocument(request.params.name);

    return {
      ok: true,
      data: { document }
    };
  });

  server.put<{ Params: SkillParams; Body: UpdateSkillDocumentRequest }>(
    "/api/skills/:name/document",
    async (request): Promise<ApiResponse<SkillDocumentResponse>> => {
      const document = await updateGlobalSkillDocument(request.params.name, request.body?.content);

      return {
        ok: true,
        data: { document }
      };
    }
  );

  server.patch<{ Params: SkillParams; Body: RenameSkillRequest }>("/api/skills/:name", async (request): Promise<ApiResponse<SkillResponse>> => {
    const skill = await renameGlobalSkill(request.params.name, request.body?.newName);

    return {
      ok: true,
      data: { skill }
    }
  });

  server.delete<{ Params: SkillParams; Body: DeleteSkillRequest }>("/api/skills/:name", async (request): Promise<ApiResponse<{ deleted: true }>> => {
    await deleteGlobalSkill(request.params.name, request.body?.confirmName);

    return {
      ok: true,
      data: { deleted: true }
    }
  });

  server.post<{ Params: SkillParams; Body: CopyGlobalSkillRequest }>(
    "/api/skills/:name/copy",
    async (request): Promise<ApiResponse<CopySkillResponse>> => {
      const project = await getProject(database.db, request.body?.targetProjectId ?? "");

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const result = await copyGlobalSkillToProject(request.params.name, project.path, request.body?.mode, request.body?.overwrite);

      return {
        ok: true,
        data: result
      };
    }
  );

  server.post<{ Params: SkillParams; Body: AddGlobalSkillToStoreRequest }>(
    "/api/skills/:name/add-to-store",
    async (request): Promise<ApiResponse<StoreSkillResponse>> => {
      const result = await addGlobalSkillToStore(request.params.name, request.body?.mode, request.body?.overwrite);
      const skill = await getStoreSkillStatus(result.name);

      return {
        ok: true,
        data: { skill }
      };
    }
  );

  server.get<{ Params: ProjectParams }>("/api/projects/:projectId/skills", async (request): Promise<ApiResponse<ProjectSkillsResponse>> => {
    const project = await getProject(database.db, request.params.projectId);

    if (!project) {
      throw new HttpError(404, "project_not_found", "项目不存在");
    }

    return {
      ok: true,
      data: {
        skills: await listProjectSkillView(project.path)
      }
    };
  });

  server.post<{ Params: ProjectParams; Body: CreateSkillRequest }>(
    "/api/projects/:projectId/skills",
    async (request, reply): Promise<ApiResponse<ProjectSkillResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const createdSkill = await createProjectSkill(project.path, request.body?.name);
      const skills = await listProjectSkillView(project.path);
      const skill = skills.find((item) => item.name === createdSkill.name);

      if (!skill) {
        throw new HttpError(500, "skill_create_failed", "Skill 文件夹创建后无法读取");
      }

      reply.status(201);

      return {
        ok: true,
        data: { skill }
      };
    }
  );

  server.get<{ Params: ProjectSkillParams }>(
    "/api/projects/:projectId/skills/:name/document",
    async (request): Promise<ApiResponse<SkillDocumentResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const document = await readProjectSkillDocument(project.path, request.params.name);

      return {
        ok: true,
        data: { document }
      };
    }
  );

  server.put<{ Params: ProjectSkillParams; Body: UpdateSkillDocumentRequest }>(
    "/api/projects/:projectId/skills/:name/document",
    async (request): Promise<ApiResponse<SkillDocumentResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const document = await updateProjectSkillDocument(project.path, request.params.name, request.body?.content);

      return {
        ok: true,
        data: { document }
      };
    }
  );

  server.patch<{ Params: ProjectSkillParams; Body: RenameSkillRequest }>(
    "/api/projects/:projectId/skills/:name",
    async (request): Promise<ApiResponse<ProjectSkillResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const renamedSkill = await renameProjectSkill(project.path, request.params.name, request.body?.newName);
      const skills = await listProjectSkillView(project.path);
      const skill = skills.find((item) => item.name === renamedSkill.name);

      if (!skill) {
        throw new HttpError(500, "skill_rename_failed", "Skill 文件夹重命名后无法读取");
      }

      return {
        ok: true,
        data: { skill }
      };
    }
  );

  server.delete<{ Params: ProjectSkillParams; Body: DeleteSkillRequest }>(
    "/api/projects/:projectId/skills/:name",
    async (request): Promise<ApiResponse<{ deleted: true }>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      await deleteProjectSkill(project.path, request.params.name, request.body?.confirmName);

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );

  server.post<{ Params: ProjectSkillParams; Body: AddProjectSkillToStoreRequest }>(
    "/api/projects/:projectId/skills/:name/add-to-store",
    async (request): Promise<ApiResponse<StoreSkillResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const result = await addProjectSkillToStore(project.path, request.params.name, request.body?.mode, request.body?.overwrite);
      const skill = await getStoreSkillStatus(result.name);

      return {
        ok: true,
        data: { skill }
      };
    }
  );

  server.post<{ Params: ProjectSkillParams; Body: CopyProjectSkillRequest }>(
    "/api/projects/:projectId/skills/:name/copy",
    async (request): Promise<ApiResponse<CopySkillResponse>> => {
      const project = await getProject(database.db, request.params.projectId);

      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const result = await copyProjectSkillToGlobal(project.path, request.params.name, request.body?.overwrite);

      return {
        ok: true,
        data: result
      };
    }
  );
}
