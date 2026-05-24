import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  ChatSkillsResponse,
  DeleteChatSkillRequest
} from "@workhorse-station/shared";
import { listChatSkills, getChatSkillsRoot } from "./skill-loader.js";
import { rm } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "../projects/http-error.js";

type ChatSkillParams = {
  name: string;
};

export async function registerChatSkillRoutes(server: FastifyInstance) {
  server.get("/api/chat-skills", async (): Promise<ApiResponse<ChatSkillsResponse>> => {
    const skills = await listChatSkills();
    return {
      ok: true,
      data: { skills }
    };
  });

  server.delete<{ Params: ChatSkillParams; Body: DeleteChatSkillRequest }>(
    "/api/chat-skills/:name",
    async (request): Promise<ApiResponse<{ deleted: true }>> => {
      const name = request.params.name;
      const confirmName = request.body?.confirmName;

      if (typeof confirmName !== "string" || confirmName.trim() !== name) {
        throw new HttpError(400, "skill_confirmation_mismatch", "删除确认名称与 Skill 名称不一致");
      }

      const skillPath = path.join(getChatSkillsRoot(), name);

      try {
        await rm(skillPath, { recursive: true });
      } catch {
        throw new HttpError(404, "chat_skill_not_found", "Chat Skill 文件夹不存在");
      }

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );
}
