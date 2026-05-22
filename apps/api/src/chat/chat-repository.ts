import { randomUUID } from "node:crypto";
import type {
  ChatArtifactSuggestion,
  ChatAttachment,
  ChatMessageSummary,
  ChatRole,
  ChatSessionSummary
} from "@workhorse-station/shared";
import type { Database } from "sql.js";

export type ChatSessionWriteInput = {
  id?: string;
  projectId: string | null;
  worktreeId: string | null;
  title: string;
};

export type ChatMessageWriteInput = {
  id?: string;
  chatSessionId: string;
  role: ChatRole;
  content: string;
  attachments: ChatAttachment[];
  artifactSuggestions: ChatArtifactSuggestion[];
};

type ChatSessionRow = {
  id: string;
  project_id: string | null;
  worktree_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatMessageRow = {
  id: string;
  chat_session_id: string;
  role: ChatRole;
  content: string;
  attachments_json: string;
  artifact_suggestions_json: string;
  created_at: string;
};

export function listChatSessions(db: Database) {
  const sessions = selectChatSessions(
    db,
    `SELECT id, project_id, worktree_id, title, created_at, updated_at
     FROM chat_sessions
     ORDER BY updated_at DESC, created_at DESC`
  );

  return hydrateChatSessions(db, sessions);
}

export function getChatSession(db: Database, chatSessionId: string) {
  const session = selectChatSession(
    db,
    `SELECT id, project_id, worktree_id, title, created_at, updated_at
     FROM chat_sessions
     WHERE id = ?`,
    [chatSessionId]
  );

  if (!session) {
    return null;
  }

  return {
    ...session,
    messages: listChatMessages(db, session.id)
  };
}

export function createChatSession(db: Database, input: ChatSessionWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO chat_sessions (id, project_id, worktree_id, title)
     VALUES (?, ?, ?, ?)`,
    [id, input.projectId, input.worktreeId, input.title]
  );

  const chatSession = getChatSession(db, id);

  if (!chatSession) {
    throw new Error("Failed to read created chat session");
  }

  return chatSession;
}

export function updateChatSessionContext(db: Database, chatSessionId: string, input: ChatSessionWriteInput) {
  db.run(
    `UPDATE chat_sessions
     SET project_id = ?, worktree_id = ?, title = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [input.projectId, input.worktreeId, input.title, chatSessionId]
  );

  return getChatSession(db, chatSessionId);
}

export function appendChatMessage(db: Database, input: ChatMessageWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO chat_messages (id, chat_session_id, role, content, attachments_json, artifact_suggestions_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.chatSessionId, input.role, input.content, JSON.stringify(input.attachments), JSON.stringify(input.artifactSuggestions)]
  );
  db.run(
    `UPDATE chat_sessions
     SET updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [input.chatSessionId]
  );

  const message = getChatMessage(db, id);

  if (!message) {
    throw new Error("Failed to read created chat message");
  }

  return message;
}

export function deleteChatSession(db: Database, chatSessionId: string) {
  db.run("DELETE FROM chat_sessions WHERE id = ?", [chatSessionId]);
  return db.getRowsModified() > 0;
}

export function listChatMessages(db: Database, chatSessionId: string) {
  const statement = db.prepare(
    `SELECT id, chat_session_id, role, content, attachments_json, artifact_suggestions_json, created_at
     FROM chat_messages
     WHERE chat_session_id = ?
     ORDER BY created_at ASC, id ASC`,
    [chatSessionId]
  );
  const rows: ChatMessageSummary[] = [];

  try {
    while (statement.step()) {
      rows.push(mapChatMessageRow(statement.getAsObject() as ChatMessageRow));
    }
  } finally {
    statement.free();
  }

  return rows;
}

function getChatMessage(db: Database, messageId: string) {
  const statement = db.prepare(
    `SELECT id, chat_session_id, role, content, attachments_json, artifact_suggestions_json, created_at
     FROM chat_messages
     WHERE id = ?`,
    [messageId]
  );

  try {
    if (!statement.step()) {
      return null;
    }

    return mapChatMessageRow(statement.getAsObject() as ChatMessageRow);
  } finally {
    statement.free();
  }
}

function hydrateChatSessions(db: Database, sessions: Omit<ChatSessionSummary, "messages">[]) {
  return sessions.map((session) => ({
    ...session,
    messages: listChatMessages(db, session.id)
  }));
}

function selectChatSessions(db: Database, sql: string, params: Array<string | null> = []) {
  const statement = db.prepare(sql, params);
  const rows: Omit<ChatSessionSummary, "messages">[] = [];

  try {
    while (statement.step()) {
      rows.push(mapChatSessionRow(statement.getAsObject() as ChatSessionRow));
    }
  } finally {
    statement.free();
  }

  return rows;
}

function selectChatSession(db: Database, sql: string, params: Array<string | null>) {
  const statement = db.prepare(sql, params);

  try {
    if (!statement.step()) {
      return null;
    }

    return mapChatSessionRow(statement.getAsObject() as ChatSessionRow);
  } finally {
    statement.free();
  }
}

function mapChatSessionRow(row: ChatSessionRow): Omit<ChatSessionSummary, "messages"> {
  return {
    id: row.id,
    projectId: row.project_id,
    worktreeId: row.worktree_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapChatMessageRow(row: ChatMessageRow): ChatMessageSummary {
  return {
    id: row.id,
    chatSessionId: row.chat_session_id,
    role: row.role,
    content: row.content,
    attachments: parseArray<ChatAttachment>(row.attachments_json),
    artifactSuggestions: parseArray<ChatArtifactSuggestion>(row.artifact_suggestions_json),
    createdAt: row.created_at
  };
}

function parseArray<T>(raw: string) {
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
