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
import { parseListQuery } from "../list-query.js";
import { HttpError } from "../projects/http-error.js";
import { getProject } from "../projects/project-repository.js";
import { countGlobalNotes, countNotes, createNote, deleteGlobalNote, deleteNote, getGlobalNote, getProjectNote, listGlobalNotes, listNotes, setFts5Available, updateGlobalNote, updateNote, type NoteWriteInput } from "./note-repository.js";

type ProjectParams = {
  projectId: string;
};

type ProjectNoteParams = ProjectParams & {
  noteId: string;
};

export async function registerNoteRoutes(server: FastifyInstance, database: DatabaseState) {
  setFts5Available(database.fts5);

  server.get<{ Querystring: { search?: string; tags?: string; page?: string; pageSize?: string } }>("/api/notes", async (request): Promise<ApiResponse<NotesResponse>> => {
    const opts = parseListQuery(request.query);
    const [notes, total] = [listGlobalNotes(database.db, opts), countGlobalNotes(database.db, { search: opts.search, tags: opts.tags })];
    return {
      ok: true,
      data: {
        notes,
        total,
        page: opts.page ?? 1,
        pageSize: opts.pageSize ?? 12
      }
    };
  });

  server.post<{ Body: CreateNoteRequest }>("/api/notes", async (request, reply): Promise<ApiResponse<NoteResponse>> => {
    const input = buildNoteInput(null, request.body);
    const note = createNote(database.db, input);
    database.persist();
    reply.status(201);

    return {
      ok: true,
      data: { note }
    };
  });

  server.patch<{ Params: { noteId: string }; Body: UpdateNoteRequest }>("/api/notes/:noteId", async (request): Promise<ApiResponse<NoteResponse>> => {
    const currentNote = getGlobalNote(database.db, request.params.noteId);

    if (!currentNote) {
      throw new HttpError(404, "note_not_found", "笔记不存在");
    }

    const input = buildNoteInput(null, {
      title: request.body?.title ?? currentNote.title,
      content: request.body?.content ?? currentNote.content,
      tags: request.body?.tags ?? currentNote.tags
    });
    const note = updateGlobalNote(database.db, request.params.noteId, input);
    database.persist();

    if (!note) {
      throw new HttpError(404, "note_not_found", "笔记不存在");
    }

    return {
      ok: true,
      data: { note }
    };
  });

  server.delete<{ Params: { noteId: string } }>("/api/notes/:noteId", async (request): Promise<ApiResponse<DeleteNoteResponse>> => {
    if (!deleteGlobalNote(database.db, request.params.noteId)) {
      throw new HttpError(404, "note_not_found", "笔记不存在");
    }

    database.persist();

    return {
      ok: true,
      data: { deleted: true }
    };
  });

  server.get<{ Params: ProjectParams; Querystring: { search?: string; tags?: string; page?: string; pageSize?: string } }>("/api/projects/:projectId/notes", async (request): Promise<ApiResponse<NotesResponse>> => {
    assertProjectExists(database, request.params.projectId);
    const opts = parseListQuery(request.query);
    const [notes, total] = [
      listNotes(database.db, request.params.projectId, opts),
      countNotes(database.db, request.params.projectId, { search: opts.search, tags: opts.tags })
    ];

    return {
      ok: true,
      data: {
        notes,
        total,
        page: opts.page ?? 1,
        pageSize: opts.pageSize ?? 12
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

function buildNoteInput(projectId: string | null, body: CreateNoteRequest | undefined): NoteWriteInput {
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
