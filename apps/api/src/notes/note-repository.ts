import { randomUUID } from "node:crypto";
import type { ChatArtifactSourceRef, CreateNoteRequest, NoteSummary } from "@workhorse-station/shared";
import type { Database } from "sql.js";

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

type SqlParam = string | null;

let fts5Available = false;

export function setFts5Available(enabled: boolean) {
  fts5Available = enabled;
}

export function listGlobalNotes(db: Database, opts?: { search?: string; tags?: string[]; page?: number; pageSize?: number }) {
  return queryNotes(db, null, opts);
}

export function countGlobalNotes(db: Database, opts?: { search?: string; tags?: string[] }) {
  return countNotes(db, null, opts);
}

export function getGlobalNote(db: Database, noteId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, title, content, tags, source_chat_suggestion_json, created_at, updated_at
     FROM notes
     WHERE project_id IS NULL AND id = ?`,
    [noteId]
  );
}

export function listNotes(db: Database, projectId: string, opts?: { search?: string; tags?: string[]; page?: number; pageSize?: number }) {
  return queryNotes(db, projectId, opts);
}

export function countNotes(db: Database, projectId: string | null, opts?: { search?: string; tags?: string[] }) {
  const search = opts?.search?.trim();
  const filterTags = opts?.tags?.filter((t) => t.trim()) ?? [];

  if (!search && filterTags.length === 0) {
    const where = projectId === null ? "WHERE project_id IS NULL" : "WHERE project_id = ?";
    const params: SqlParam[] = projectId === null ? [] : [projectId];
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM notes ${where}`, params);
    try {
      if (stmt.step()) {
        return (stmt.getAsObject() as { count: number }).count;
      }
      return 0;
    } finally {
      stmt.free();
    }
  }

  if (search && fts5Available) {
    return countWithFts(db, projectId, search, filterTags);
  }

  return countWithLike(db, projectId, search, filterTags);
}

export function getProjectNote(db: Database, projectId: string, noteId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, title, content, tags, source_chat_suggestion_json, created_at, updated_at
     FROM notes
     WHERE project_id = ? AND id = ?`,
    [projectId, noteId]
  );
}

export function createNote(db: Database, input: NoteWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO notes (id, project_id, title, content, tags, source_chat_suggestion_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.projectId, input.title, input.content, JSON.stringify(input.tags), serializeSourceChatSuggestion(input.sourceChatSuggestion)]
  );

  if (fts5Available) {
    const rowid = getNoteRowid(db, id);
    if (rowid !== null) {
      db.run(
        "INSERT INTO notes_fts(rowid, title, content, tags) VALUES (?, ?, ?, ?)",
        [rowid, input.title, input.content, JSON.stringify(input.tags)]
      );
    }
  }

  const note = getNoteByScope(db, input.projectId, id);

  if (!note) {
    throw new Error("Failed to read created note");
  }

  return note;
}

export function updateGlobalNote(db: Database, noteId: string, input: NoteWriteInput) {
  db.run(
    `UPDATE notes
     SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id IS NULL AND id = ?`,
    [input.title, input.content, JSON.stringify(input.tags), noteId]
  );

  if (fts5Available) {
    const rowid = getNoteRowid(db, noteId);
    if (rowid !== null) {
      db.run(
        "UPDATE notes_fts SET title = ?, content = ?, tags = ? WHERE rowid = ?",
        [input.title, input.content, JSON.stringify(input.tags), rowid]
      );
    }
  }

  return getGlobalNote(db, noteId);
}

export function updateNote(db: Database, projectId: string, noteId: string, input: NoteWriteInput) {
  db.run(
    `UPDATE notes
     SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [input.title, input.content, JSON.stringify(input.tags), projectId, noteId]
  );

  if (fts5Available) {
    const rowid = getNoteRowid(db, noteId);
    if (rowid !== null) {
      db.run(
        "UPDATE notes_fts SET title = ?, content = ?, tags = ? WHERE rowid = ?",
        [input.title, input.content, JSON.stringify(input.tags), rowid]
      );
    }
  }

  return getProjectNote(db, projectId, noteId);
}

export function deleteNote(db: Database, projectId: string, noteId: string) {
  if (fts5Available) {
    const rowid = getNoteRowid(db, noteId);
    if (rowid !== null) {
      db.run("DELETE FROM notes_fts WHERE rowid = ?", [rowid]);
    }
  }
  db.run("DELETE FROM notes WHERE project_id = ? AND id = ?", [projectId, noteId]);
  return db.getRowsModified() > 0;
}

export function deleteGlobalNote(db: Database, noteId: string) {
  if (fts5Available) {
    const rowid = getNoteRowid(db, noteId);
    if (rowid !== null) {
      db.run("DELETE FROM notes_fts WHERE rowid = ?", [rowid]);
    }
  }
  db.run("DELETE FROM notes WHERE project_id IS NULL AND id = ?", [noteId]);
  return db.getRowsModified() > 0;
}

function getNoteByScope(db: Database, projectId: string | null, noteId: string) {
  return projectId ? getProjectNote(db, projectId, noteId) : getGlobalNote(db, noteId);
}

function selectRows(db: Database, sql: string, params: SqlParam[]) {
  const statement = db.prepare(sql, params);
  const rows: NoteSummary[] = [];

  try {
    while (statement.step()) {
      rows.push(mapNoteRow(statement.getAsObject() as NoteRow));
    }
  } finally {
    statement.free();
  }

  return rows;
}

function selectOne(db: Database, sql: string, params: SqlParam[]) {
  const statement = db.prepare(sql, params);

  try {
    if (!statement.step()) {
      return null;
    }

    return mapNoteRow(statement.getAsObject() as NoteRow);
  } finally {
    statement.free();
  }
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

function getNoteRowid(db: Database, noteId: string): number | null {
  const stmt = db.prepare("SELECT rowid FROM notes WHERE id = ?", [noteId]);
  try {
    if (stmt.step()) {
      return (stmt.getAsObject() as { rowid: number }).rowid;
    }
    return null;
  } finally {
    stmt.free();
  }
}

function buildFtsQuery(raw: string): string {
  const terms = raw
    .replace(/[^\w一-鿿\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return raw;
  return terms.map((t) => `"${t}"*`).join(" AND ");
}

const NOTE_SELECT = `SELECT id, project_id, title, content, tags, source_chat_suggestion_json, created_at, updated_at
  FROM notes`;

function queryNotes(
  db: Database,
  projectId: string | null,
  opts?: { search?: string; tags?: string[]; page?: number; pageSize?: number }
): NoteSummary[] {
  const search = opts?.search?.trim();
  const filterTags = opts?.tags?.filter((t) => t.trim()) ?? [];
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 12;
  const offset = (page - 1) * pageSize;

  if (!search && filterTags.length === 0) {
    const where = projectId === null ? "WHERE project_id IS NULL" : "WHERE project_id = ?";
    const params: SqlParam[] = projectId === null ? [] : [projectId];
    return selectRows(db, `${NOTE_SELECT} ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, params);
  }

  if (search && fts5Available) {
    return queryWithFts(db, projectId, search, filterTags, pageSize, offset);
  }

  return queryWithLike(db, projectId, search, filterTags, pageSize, offset);
}

function queryWithFts(
  db: Database,
  projectId: string | null,
  search: string,
  filterTags: string[],
  limit?: number,
  offset?: number
): NoteSummary[] {
  const ftsQuery = buildFtsQuery(search);
  const ftsStmt = db.prepare("SELECT rowid FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank", [ftsQuery]);
  const matchingRowids: number[] = [];

  try {
    while (ftsStmt.step()) {
      matchingRowids.push((ftsStmt.getAsObject() as { rowid: number }).rowid);
    }
  } finally {
    ftsStmt.free();
  }

  if (matchingRowids.length === 0) return [];

  const conditions: string[] = [`n.rowid IN (${matchingRowids.map(() => "?").join(",")})`];
  const params: SqlParam[] = matchingRowids.map((r) => String(r));

  if (projectId !== null) {
    conditions.push("n.project_id = ?");
    params.push(projectId);
  } else {
    conditions.push("n.project_id IS NULL");
  }

  for (const tag of filterTags) {
    conditions.push("n.tags LIKE ?");
    params.push(`%"${tag}"%`);
  }

  let sql = `SELECT n.id, n.project_id, n.title, n.content, n.tags, n.source_chat_suggestion_json, n.created_at, n.updated_at
    FROM notes n
    WHERE ${conditions.join(" AND ")}
    ORDER BY n.updated_at DESC, n.created_at DESC`;

  if (limit !== undefined) {
    sql += ` LIMIT ${limit}`;
    if (offset !== undefined) sql += ` OFFSET ${offset}`;
  }

  return selectRows(db, sql, params);
}

function queryWithLike(
  db: Database,
  projectId: string | null,
  search: string | undefined,
  filterTags: string[],
  limit?: number,
  offset?: number
): NoteSummary[] {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (projectId !== null) {
    conditions.push("project_id = ?");
    params.push(projectId);
  } else {
    conditions.push("project_id IS NULL");
  }

  if (search) {
    const like = `%${search}%`;
    conditions.push("(title LIKE ? OR content LIKE ? OR tags LIKE ?)");
    params.push(like, like, like);
  }

  for (const tag of filterTags) {
    conditions.push("tags LIKE ?");
    params.push(`%"${tag}"%`);
  }

  let sql = `${NOTE_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY updated_at DESC, created_at DESC`;

  if (limit !== undefined) {
    sql += ` LIMIT ${limit}`;
    if (offset !== undefined) sql += ` OFFSET ${offset}`;
  }

  return selectRows(db, sql, params);
}

function countWithFts(
  db: Database,
  projectId: string | null,
  search: string,
  filterTags: string[]
): number {
  const ftsQuery = buildFtsQuery(search);
  const ftsStmt = db.prepare("SELECT rowid FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank", [ftsQuery]);
  const matchingRowids: number[] = [];

  try {
    while (ftsStmt.step()) {
      matchingRowids.push((ftsStmt.getAsObject() as { rowid: number }).rowid);
    }
  } finally {
    ftsStmt.free();
  }

  if (matchingRowids.length === 0) return 0;

  const conditions: string[] = [`n.rowid IN (${matchingRowids.map(() => "?").join(",")})`];
  const params: SqlParam[] = matchingRowids.map((r) => String(r));

  if (projectId !== null) {
    conditions.push("n.project_id = ?");
    params.push(projectId);
  } else {
    conditions.push("n.project_id IS NULL");
  }

  for (const tag of filterTags) {
    conditions.push("n.tags LIKE ?");
    params.push(`%"${tag}"%`);
  }

  const sql = `SELECT COUNT(*) as count FROM notes n WHERE ${conditions.join(" AND ")}`;
  const stmt = db.prepare(sql, params);
  try {
    if (stmt.step()) {
      return (stmt.getAsObject() as { count: number }).count;
    }
    return 0;
  } finally {
    stmt.free();
  }
}

function countWithLike(
  db: Database,
  projectId: string | null,
  search: string | undefined,
  filterTags: string[]
): number {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (projectId !== null) {
    conditions.push("project_id = ?");
    params.push(projectId);
  } else {
    conditions.push("project_id IS NULL");
  }

  if (search) {
    const like = `%${search}%`;
    conditions.push("(title LIKE ? OR content LIKE ? OR tags LIKE ?)");
    params.push(like, like, like);
  }

  for (const tag of filterTags) {
    conditions.push("tags LIKE ?");
    params.push(`%"${tag}"%`);
  }

  const sql = `SELECT COUNT(*) as count FROM notes WHERE ${conditions.join(" AND ")}`;
  const stmt = db.prepare(sql, params);
  try {
    if (stmt.step()) {
      return (stmt.getAsObject() as { count: number }).count;
    }
    return 0;
  } finally {
    stmt.free();
  }
}
