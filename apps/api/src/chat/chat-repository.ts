import { randomUUID } from "node:crypto";
import type {
  ChatArtifactSuggestion,
  ChatAttachment,
  ChatMessageSummary,
  ChatRole,
  ChatSessionListItem,
  ChatSessionSummary,
  ChatToolCall,
  ChatToolResult
} from "@workhorse-station/shared";
import type { DatabaseExecutor, SqlParams } from "../db/mysql.js";
import { execute, queryOne, queryRows } from "../db/mysql.js";

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
  toolCalls: ChatToolCall[];
  toolResults: ChatToolResult[];
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
  tool_calls_json: string;
  tool_results_json: string;
  created_at: string;
  sequence: number | string;
};

const CHAT_SESSION_SELECT = `SELECT id, project_id, worktree_id, title, created_at, updated_at
     FROM chat_sessions`;

const CHAT_MESSAGE_SELECT = `SELECT id, chat_session_id, role, content, attachments_json, artifact_suggestions_json, tool_calls_json, tool_results_json, created_at, sequence
     FROM chat_messages`;

export async function listChatSessions(db: DatabaseExecutor): Promise<ChatSessionListItem[]> {
  const rows = await queryRows<ChatSessionRow>(
    db,
    `${CHAT_SESSION_SELECT}
     ORDER BY updated_at DESC, created_at DESC`
  );

  return rows.map(mapChatSessionRow);
}

export async function getChatSession(db: DatabaseExecutor, chatSessionId: string) {
  const session = await selectChatSession(
    db,
    `${CHAT_SESSION_SELECT}
     WHERE id = ?`,
    [chatSessionId]
  );

  if (!session) {
    return null;
  }

  return {
    ...session,
    messages: await listChatMessages(db, session.id)
  };
}

export async function createChatSession(db: DatabaseExecutor, input: ChatSessionWriteInput) {
  const id = input.id ?? randomUUID();
  await execute(
    db,
    `INSERT INTO chat_sessions (id, project_id, worktree_id, title)
     VALUES (?, ?, ?, ?)`,
    [id, input.projectId, input.worktreeId, input.title]
  );

  const chatSession = await getChatSession(db, id);

  if (!chatSession) {
    throw new Error("Failed to read created chat session");
  }

  return chatSession;
}

export async function updateChatSessionContext(db: DatabaseExecutor, chatSessionId: string, input: ChatSessionWriteInput) {
  await execute(
    db,
    `UPDATE chat_sessions
     SET project_id = ?, worktree_id = ?, title = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [input.projectId, input.worktreeId, input.title, chatSessionId]
  );

  return getChatSession(db, chatSessionId);
}

export async function appendChatMessage(db: DatabaseExecutor, input: ChatMessageWriteInput) {
  const id = input.id ?? randomUUID();
  await execute(
    db,
    `INSERT INTO chat_messages (id, chat_session_id, role, content, attachments_json, artifact_suggestions_json, tool_calls_json, tool_results_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.chatSessionId,
      input.role,
      input.content,
      JSON.stringify(input.attachments),
      JSON.stringify(input.artifactSuggestions),
      JSON.stringify(input.toolCalls),
      JSON.stringify(input.toolResults)
    ]
  );
  await execute(
    db,
    `UPDATE chat_sessions
     SET updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [input.chatSessionId]
  );

  const message = await getChatMessage(db, id);

  if (!message) {
    throw new Error("Failed to read created chat message");
  }

  return message;
}

export async function deleteChatSession(db: DatabaseExecutor, chatSessionId: string) {
  return (await execute(db, "DELETE FROM chat_sessions WHERE id = ?", [chatSessionId])) > 0;
}

export async function truncateChatMessages(db: DatabaseExecutor, chatSessionId: string, fromMessageId: string) {
  const target = await queryOne<{ sequence: number | string }>(
    db,
    "SELECT sequence FROM chat_messages WHERE id = ? AND chat_session_id = ?",
    [fromMessageId, chatSessionId]
  );

  if (!target) {
    return getChatSession(db, chatSessionId);
  }

  await execute(
    db,
    "DELETE FROM chat_messages WHERE chat_session_id = ? AND sequence >= ?",
    [chatSessionId, Number(target.sequence)]
  );
  await execute(
    db,
    "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [chatSessionId]
  );

  return getChatSession(db, chatSessionId);
}

export async function listChatMessages(db: DatabaseExecutor, chatSessionId: string) {
  const rows = await queryRows<ChatMessageRow>(
    db,
    `${CHAT_MESSAGE_SELECT}
     WHERE chat_session_id = ?
     ORDER BY sequence ASC`,
    [chatSessionId]
  );

  return rows.map(mapChatMessageRow);
}

export async function getChatSessionMessage(db: DatabaseExecutor, chatSessionId: string, messageId: string) {
  const row = await queryOne<ChatMessageRow>(
    db,
    `${CHAT_MESSAGE_SELECT}
     WHERE chat_session_id = ? AND id = ?`,
    [chatSessionId, messageId]
  );

  return row ? mapChatMessageRow(row) : null;
}

export async function updateChatMessageArtifactSuggestions(
  db: DatabaseExecutor,
  chatSessionId: string,
  messageId: string,
  artifactSuggestions: ChatArtifactSuggestion[]
) {
  await execute(
    db,
    `UPDATE chat_messages
     SET artifact_suggestions_json = ?
     WHERE chat_session_id = ? AND id = ?`,
    [JSON.stringify(artifactSuggestions), chatSessionId, messageId]
  );
  await execute(
    db,
    `UPDATE chat_sessions
     SET updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [chatSessionId]
  );

  return getChatSessionMessage(db, chatSessionId, messageId);
}

async function getChatMessage(db: DatabaseExecutor, messageId: string) {
  const row = await queryOne<ChatMessageRow>(
    db,
    `${CHAT_MESSAGE_SELECT}
     WHERE id = ?`,
    [messageId]
  );

  return row ? mapChatMessageRow(row) : null;
}

async function selectChatSession(db: DatabaseExecutor, sql: string, params: SqlParams) {
  const row = await queryOne<ChatSessionRow>(db, sql, params);
  return row ? mapChatSessionRow(row) : null;
}

function mapChatSessionRow(row: ChatSessionRow): ChatSessionListItem {
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
    artifactSuggestions: parseArray<ChatArtifactSuggestion>(row.artifact_suggestions_json).map(normalizeArtifactSuggestion),
    toolCalls: parseArray<ChatToolCall>(row.tool_calls_json),
    toolResults: parseArray<ChatToolResult>(row.tool_results_json),
    createdAt: row.created_at
  };
}

function normalizeArtifactSuggestion(suggestion: ChatArtifactSuggestion): ChatArtifactSuggestion {
  return {
    ...suggestion,
    adoption: suggestion.adoption ?? {
      status: "pending",
      targetType: null,
      targetId: null,
      projectId: null,
      worktreeId: null,
      adoptedAt: null
    }
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
