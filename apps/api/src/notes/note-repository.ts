import { randomUUID } from "node:crypto";
import type { ChatArtifactSourceRef, CreateNoteRequest, NoteSummary } from "@workhorse-station/shared";
import type { DatabaseExecutor } from "../db/mysql.js";
import { execute, queryCount, queryOne, queryRows } from "../db/mysql.js";

type NoteRow = {
  id: string;
  project_id: string | null;
  title: string;
  content: string;
  tags: string;
  source_chat_suggestion_json: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteWriteInput = Required<Pick<CreateNoteRequest, "title">> & {
  id?: string;
  projectId: string | null;
  content: string;
  tags: string[];
  sourceChatSuggestion: ChatArtifactSourceRef | null;
};

const NOTE_SELECT = `SELECT id, project_id, title, content, tags, source_chat_suggestion_json, created_at, updated_at
  FROM notes`;

export async function listGlobalNotes(db: DatabaseExecutor, opts?: { search?: string; tags?: string[]; page?: number; pageSize?: number }) {
  return queryNotes(db, null, opts);
}

export async function countGlobalNotes(db: DatabaseExecutor, opts?: { search?: string; tags?: string[] }) {
  return countNotes(db, null, opts);
}

export async function getGlobalNote(db: DatabaseExecutor, noteId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, title, content, tags, source_chat_suggestion_json, created_at, updated_at
     FROM notes
     WHERE project_id IS NULL AND id = ?`,
    [noteId]
  );
}

export async function listNotes(db: DatabaseExecutor, projectId: string, opts?: { search?: string; tags?: string[]; page?: number; pageSize?: number }) {
  return queryNotes(db, projectId, opts);
}

export async function countNotes(db: DatabaseExecutor, projectId: string | null, opts?: { search?: string; tags?: string[] }) {
  const { where, params } = buildWhere(projectId, opts);
  return queryCount(db, `SELECT COUNT(*) as count FROM notes ${where}`, params);
}

export async function getProjectNote(db: DatabaseExecutor, projectId: string, noteId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, title, content, tags, source_chat_suggestion_json, created_at, updated_at
     FROM notes
     WHERE project_id = ? AND id = ?`,
    [projectId, noteId]
  );
}

export async function createNote(db: DatabaseExecutor, input: NoteWriteInput) {
  const id = input.id ?? randomUUID();
  await execute(
    db,
    `INSERT INTO notes (id, project_id, title, content, tags, source_chat_suggestion_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.projectId, input.title, input.content, JSON.stringify(input.tags), serializeSourceChatSuggestion(input.sourceChatSuggestion)]
  );

  const note = await getNoteByScope(db, input.projectId, id);

  if (!note) {
    throw new Error("Failed to read created note");
  }

  return note;
}

export async function updateGlobalNote(db: DatabaseExecutor, noteId: string, input: NoteWriteInput) {
  await execute(
    db,
    `UPDATE notes
     SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id IS NULL AND id = ?`,
    [input.title, input.content, JSON.stringify(input.tags), noteId]
  );

  return getGlobalNote(db, noteId);
}

export async function updateNote(db: DatabaseExecutor, projectId: string, noteId: string, input: NoteWriteInput) {
  await execute(
    db,
    `UPDATE notes
     SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [input.title, input.content, JSON.stringify(input.tags), projectId, noteId]
  );

  return getProjectNote(db, projectId, noteId);
}

export async function deleteNote(db: DatabaseExecutor, projectId: string, noteId: string) {
  return (await execute(db, "DELETE FROM notes WHERE project_id = ? AND id = ?", [projectId, noteId])) > 0;
}

export async function deleteGlobalNote(db: DatabaseExecutor, noteId: string) {
  return (await execute(db, "DELETE FROM notes WHERE project_id IS NULL AND id = ?", [noteId])) > 0;
}

async function getNoteByScope(db: DatabaseExecutor, projectId: string | null, noteId: string) {
  return projectId ? getProjectNote(db, projectId, noteId) : getGlobalNote(db, noteId);
}

async function queryNotes(
  db: DatabaseExecutor,
  projectId: string | null,
  opts?: { search?: string; tags?: string[]; page?: number; pageSize?: number }
) {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 12;
  const offset = (page - 1) * pageSize;
  const { where, params } = buildWhere(projectId, opts);

  return selectRows(
    db,
    `${NOTE_SELECT}
     ${where}
     ORDER BY updated_at DESC, created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
}

function buildWhere(projectId: string | null, opts?: { search?: string; tags?: string[] }) {
  const clauses: string[] = [];
  const params: string[] = [];

  if (projectId === null) {
    clauses.push("project_id IS NULL");
  } else {
    clauses.push("project_id = ?");
    params.push(projectId);
  }

  if (opts?.search) {
    const pattern = `%${opts.search}%`;
    clauses.push("(title LIKE ? OR content LIKE ? OR tags LIKE ?)");
    params.push(pattern, pattern, pattern);
  }

  if (opts?.tags?.length) {
    for (const tag of opts.tags) {
      clauses.push("tags LIKE ?");
      params.push(`%\"${tag}\"%`);
    }
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, params };
}

async function selectRows(db: DatabaseExecutor, sql: string, params: string[]) {
  const rows = await queryRows<NoteRow>(db, sql, params);
  return rows.map(mapNoteRow);
}

async function selectOne(db: DatabaseExecutor, sql: string, params: string[]) {
  const row = await queryOne<NoteRow>(db, sql, params);
  return row ? mapNoteRow(row) : null;
}

function mapNoteRow(row: NoteRow): NoteSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: row.content,
    tags: parseTags(row.tags),
    sourceChatSuggestion: parseSourceChatSuggestion(row.source_chat_suggestion_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseTags(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function serializeSourceChatSuggestion(source: ChatArtifactSourceRef | null) {
  return source ? JSON.stringify(source) : null;
}

function parseSourceChatSuggestion(raw: string | null): ChatArtifactSourceRef | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ChatArtifactSourceRef;
    return parsed && typeof parsed.chatSessionId === "string" && typeof parsed.chatMessageId === "string" && typeof parsed.suggestionId === "string" ? parsed : null;
  } catch {
    return null;
  }
}
