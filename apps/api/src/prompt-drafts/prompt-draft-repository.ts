import { randomUUID } from "node:crypto";
import type { ChatArtifactSourceRef, CreatePromptDraftRequest, PromptDraftStatus, PromptDraftSummary, SessionSource, UpdatePromptDraftRequest } from "@workhorse-station/shared";
import type { Database } from "sql.js";

export type PromptDraftWriteInput = {
  id?: string;
  projectId: string;
  todoId: string | null;
  worktreeId: string | null;
  requestedWorktreeName: string | null;
  source: SessionSource;
  title: string;
  prompt: string;
  status: PromptDraftStatus;
  sourceChatSuggestion: ChatArtifactSourceRef | null;
};

type PromptDraftRow = {
  id: string;
  project_id: string;
  todo_id: string | null;
  worktree_id: string | null;
  requested_worktree_name: string | null;
  source: SessionSource;
  title: string;
  prompt: string;
  status: PromptDraftStatus;
  source_chat_suggestion_json: string | null;
  created_at: string;
  updated_at: string;
};

export function listPromptDrafts(db: Database, projectId: string) {
  return selectRows(
    db,
    `SELECT id, project_id, todo_id, worktree_id, requested_worktree_name, source, title, prompt, status, source_chat_suggestion_json, created_at, updated_at
     FROM prompt_drafts
     WHERE project_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [projectId]
  );
}

export function getProjectPromptDraft(db: Database, projectId: string, promptDraftId: string) {
  return selectOne(
    db,
    `SELECT id, project_id, todo_id, worktree_id, requested_worktree_name, source, title, prompt, status, source_chat_suggestion_json, created_at, updated_at
     FROM prompt_drafts
     WHERE project_id = ? AND id = ?`,
    [projectId, promptDraftId]
  );
}

export function createPromptDraft(db: Database, input: PromptDraftWriteInput) {
  const id = input.id ?? randomUUID();
  db.run(
    `INSERT INTO prompt_drafts (id, project_id, todo_id, worktree_id, requested_worktree_name, source, title, prompt, status, source_chat_suggestion_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.projectId,
      input.todoId,
      input.worktreeId,
      input.requestedWorktreeName,
      input.source,
      input.title,
      input.prompt,
      input.status,
      serializeSourceChatSuggestion(input.sourceChatSuggestion)
    ]
  );

  const promptDraft = getProjectPromptDraft(db, input.projectId, id);

  if (!promptDraft) {
    throw new Error("Failed to read created prompt draft");
  }

  return promptDraft;
}

export function updatePromptDraft(db: Database, projectId: string, promptDraftId: string, input: PromptDraftWriteInput) {
  db.run(
    `UPDATE prompt_drafts
     SET todo_id = ?, worktree_id = ?, requested_worktree_name = ?, source = ?, title = ?, prompt = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE project_id = ? AND id = ?`,
    [
      input.todoId,
      input.worktreeId,
      input.requestedWorktreeName,
      input.source,
      input.title,
      input.prompt,
      input.status,
      projectId,
      promptDraftId
    ]
  );

  return getProjectPromptDraft(db, projectId, promptDraftId);
}

function selectRows(db: Database, sql: string, params: string[]) {
  const statement = db.prepare(sql, params);
  const rows: PromptDraftSummary[] = [];

  try {
    while (statement.step()) {
      rows.push(mapPromptDraftRow(statement.getAsObject() as PromptDraftRow));
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

    return mapPromptDraftRow(statement.getAsObject() as PromptDraftRow);
  } finally {
    statement.free();
  }
}

function mapPromptDraftRow(row: PromptDraftRow): PromptDraftSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    todoId: row.todo_id,
    worktreeId: row.worktree_id,
    requestedWorktreeName: row.requested_worktree_name,
    source: row.source,
    title: row.title,
    prompt: row.prompt,
    status: row.status,
    sourceChatSuggestion: parseSourceChatSuggestion(row.source_chat_suggestion_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
