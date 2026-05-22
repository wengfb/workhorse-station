import type { FastifyInstance } from "fastify";
import type {
  ApiResponse,
  CreateNoteRequest,
  DeleteNoteResponse,
  NoteResponse,
  NotesResponse,
  UpdateNoteRequest
} from "@workhorse-station/shared";
import type { DatabaseState } from "../db/init.js";
import { HttpError } from "../projects/http-error.js";
import { getProject } from "../projects/project-repository.js";
import { createNote, deleteNote, getProjectNote, listNotes, updateNote, type NoteWriteInput } from "./note-repository.js";

type ProjectParams = {
  projectId: string;
};

type ProjectNoteParams = ProjectParams & {
  noteId: string;
};

export async function registerNoteRoutes(server: FastifyInstance, database: DatabaseState) {
  server.get<{ Params: ProjectParams }>("/api/projects/:projectId/notes", async (request): Promise<ApiResponse<NotesResponse>> => {
    assertProjectExists(database, request.params.projectId);

    return {
      ok: true,
      data: {
        notes: listNotes(database.db, request.params.projectId)
      }
    };
  });

  server.post<{ Params: ProjectParams; Body: CreateNoteRequest }>(
    "/api/projects/:projectId/notes",
    async (request, reply): Promise<ApiResponse<NoteResponse>> => {
      assertProjectExists(database, request.params.projectId);
      const input = buildNoteInput(request.params.projectId, request.body);
      const note = createNote(database.db, input);
      database.persist();
      reply.status(201);

      return {
        ok: true,
        data: { note }
      };
    }
  );

  server.patch<{ Params: ProjectNoteParams; Body: UpdateNoteRequest }>(
    "/api/projects/:projectId/notes/:noteId",
    async (request): Promise<ApiResponse<NoteResponse>> => {
      assertProjectExists(database, request.params.projectId);
      const currentNote = getProjectNote(database.db, request.params.projectId, request.params.noteId);

      if (!currentNote) {
        throw new HttpError(404, "note_not_found", "笔记不存在");
      }

      const input = buildNoteInput(request.params.projectId, {
        title: request.body?.title ?? currentNote.title,
        content: request.body?.content ?? currentNote.content,
        tags: request.body?.tags ?? currentNote.tags
      });
      const note = updateNote(database.db, request.params.projectId, request.params.noteId, input);
      database.persist();

      if (!note) {
        throw new HttpError(404, "note_not_found", "笔记不存在");
      }

      return {
        ok: true,
        data: { note }
      };
    }
  );

  server.delete<{ Params: ProjectNoteParams }>(
    "/api/projects/:projectId/notes/:noteId",
    async (request): Promise<ApiResponse<DeleteNoteResponse>> => {
      assertProjectExists(database, request.params.projectId);

      if (!deleteNote(database.db, request.params.projectId, request.params.noteId)) {
        throw new HttpError(404, "note_not_found", "笔记不存在");
      }

      database.persist();

      return {
        ok: true,
        data: { deleted: true }
      };
    }
  );
}

function assertProjectExists(database: DatabaseState, projectId: string) {
  if (!getProject(database.db, projectId)) {
    throw new HttpError(404, "project_not_found", "项目不存在");
  }
}

function buildNoteInput(projectId: string, body: CreateNoteRequest | undefined): NoteWriteInput {
  if (!isObject(body)) {
    throw new HttpError(400, "validation_error", "请求体必须是 JSON 对象");
  }

  return {
    projectId,
    title: normalizeTitle(body.title),
    content: normalizeContent(body.content),
    tags: normalizeTags(body.tags),
    sourceChatSuggestion: null
  };
}

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "笔记标题不能为空");
  }

  const title = value.trim();

  if (!title) {
    throw new HttpError(400, "validation_error", "笔记标题不能为空");
  }

  if (title.length > 120) {
    throw new HttpError(400, "validation_error", "笔记标题不能超过 120 个字符");
  }

  return title;
}

function normalizeContent(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "validation_error", "笔记内容必须是文本");
  }

  if (value.length > 20000) {
    throw new HttpError(400, "validation_error", "笔记内容不能超过 20000 个字符");
  }

  return value;
}

function normalizeTags(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    throw new HttpError(400, "validation_error", "笔记标签必须是字符串数组");
  }

  const tags = value.map((tag) => tag.trim()).filter(Boolean);

  if (tags.some((tag) => tag.length > 30)) {
    throw new HttpError(400, "validation_error", "单个标签不能超过 30 个字符");
  }

  return tags;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
