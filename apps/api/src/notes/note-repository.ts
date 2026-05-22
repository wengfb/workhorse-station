import { randomUUID } from "node:crypto";
import type { CreateNoteRequest, NoteSummary } from "@workhorse-station/shared";
import type { Database } from "sql.js";

type NoteRow = {
  id: string;
  project_id: string | null;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
};

export type NoteWriteInput = Required<Pick<CreateNoteRequest, "title">> & {
  id?: string;
  projectId: string;
  content: string;
  tags: string[];
};

export function listNotes(db: Database, projectId: string) {
  return selectRows(
    db,
    `SELECT id, project_id, title, content, tags, created_at, updated_at
     FROM notes
     WHERE project_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [projectId]
  );
}

export function getProjectNote(db: Database, projectId: string, noteId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, title, content, tags, created_at, updated_at
     FROM notes
     WHERE project_id = ? AND id = ?`,
    [projectId, noteId]
  );
}

export function createNote(db: Database, input: NoteWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO notes (id, project_id, title, content, tags)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.projectId, input.title, input.content, JSON.stringify(input.tags)]
  );

  const note = getProjectNote(db, input.projectId, id);

  if (!note) {
    throw new Error("Failed to read created note");
  }

  return note;
}

export function updateNote(db: Database, projectId: string, noteId: string, input: NoteWriteInput) {
  db.run(
    `UPDATE notes
     SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [input.title, input.content, JSON.stringify(input.tags), projectId, noteId]
  );

  return getProjectNote(db, projectId, noteId);
}

export function deleteNote(db: Database, projectId: string, noteId: string) {
  db.run("DELETE FROM notes WHERE project_id = ? AND id = ?", [projectId, noteId]);
  return db.getRowsModified() > 0;
}

function selectRows(db: Database, sql: string, params: string[]) {
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

function selectOne(db: Database, sql: string, params: string[]) {
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
