import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  CopySkillResponse,
  CreateStoreSkillRequest,
  DeleteStoreSkillRequest,
  InstallStoreSkillRequest,
  RenameStoreSkillRequest,
  SendStoreSkillToProjectRequest,
  SkillDocumentResponse,
  StoreSkillResponse,
  StoreSkillsResponse,
  UpdateSkillDocumentRequest
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "../projects/http-error.js";
import { getProject } from "../projects/project-repository.js";
import { listProjectSkillView } from "./skill-fs.js";
import {
  createStoreSkill,
  deleteStoreSkill,
  getStoreSkillStatus,
  installStoreSkill,
  listStoreSkillsWithStatus,
  readStoreSkillDocument,
  renameStoreSkill,
  sendStoreSkillToProject,
  updateStoreSkillDocument
} from "./skill-store.js";

type SkillParams = {
  name: string;
};

export async function registerSkillStoreRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get<{ Querystring: { projectId?: string } }>(
    "/api/skill-store",
    async (request): Promise<ApiResponse<StoreSkillsResponse>> => {
      let projectPath: string | undefined;

      if (request.query.projectId) {
        const project = await getProject(database.db, request.query.projectId);
        if (project) projectPath = project.path;
      }

      return {
        ok: true,
        data: { skills: await listStoreSkillsWithStatus(projectPath) }
      };
    }
  );

  server.post<{ Body: CreateStoreSkillRequest }>(
    "/api/skill-store",
    async (request, reply): Promise<ApiResponse<StoreSkillResponse>> => {
      const skill = await createStoreSkill(request.body?.name, request.body?.description);
      const status = await getStoreSkillStatus(skill.name);
      reply.status(201);

      return {
        ok: true,
        data: { skill: status }
      };
    }
  );

  server.get<{ Params: SkillParams }>(
    "/api/skill-store/:name/document",
    async (request): Promise<ApiResponse<SkillDocumentResponse>> => {
      const document = await readStoreSkillDocument(request.params.name);

      return {
        ok: true,
        data: { document }
      };
    }
  );

  server.put<{ Params: SkillParams; Body: UpdateSkillDocumentRequest }>(
    "/api/skill-store/:name/document",
    async (request): Promise<ApiResponse<SkillDocumentResponse>> => {
      const document = await updateStoreSkillDocument(request.params.name, request.body?.content);

      return {
        ok: true,
        data: { document }
      };
    }
  );

  server.patch<{ Params: SkillParams; Body: RenameStoreSkillRequest }>(
    "/api/skill-store/:name",
    async (request): Promise<ApiResponse<StoreSkillResponse>> => {
      const skill = await renameStoreSkill(request.params.name, request.body?.newName);
      const status = await getStoreSkillStatus(skill.name);

      return {
        ok: true,
        data: { skill: status }
      };
    }
  );

  server.delete<{ Params: SkillParams; Body: DeleteStoreSkillRequest }>(
    "/api/skill-store/:name",
    async (request): Promise<ApiResponse<{ deleted: true }>> => {
      await deleteStoreSkill(request.params.name, request.body?.confirmName);

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );

  server.post<{ Params: SkillParams; Body: InstallStoreSkillRequest }>(
    "/api/skill-store/:name/install",
    async (request): Promise<ApiResponse<StoreSkillResponse>> => {
      let projectPath: string | undefined;

      if (request.body?.projectId) {
        const project = await getProject(database.db, request.body.projectId);
        if (!project) {
          throw new HttpError(404, "project_not_found", "项目不存在");
        }
        projectPath = project.path;
      }

      await installStoreSkill(
        request.params.name,
        request.body?.targets ?? [],
        projectPath,
        request.body?.overwrite
      );

      const status = await getStoreSkillStatus(request.params.name, projectPath);

      return {
        ok: true,
        data: { skill: status }
      };
    }
  );

  server.post<{ Params: SkillParams; Body: SendStoreSkillToProjectRequest }>(
    "/api/skill-store/:name/to-project",
    async (request): Promise<ApiResponse<CopySkillResponse>> => {
      const project = await getProject(database.db, request.body?.targetProjectId ?? "");
      if (!project) {
        throw new HttpError(404, "project_not_found", "项目不存在");
      }

      const result = await sendStoreSkillToProject(request.params.name, project.path, request.body?.mode, request.body?.overwrite);
      const projectSkills = await listProjectSkillView(project.path);
      const skill = projectSkills.find((item) => item.name === result.name);

      if (!skill) {
        throw new HttpError(500, "skill_copy_failed", "Skill 文件夹复制后无法读取");
      }

      return {
        ok: true,
        data: {
          skill,
          overwritten: result.overwritten,
          mode: result.mode,
          sourceDeleted: result.sourceDeleted
        }
      };
    }
  );
}
