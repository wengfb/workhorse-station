import type {
  ChatArtifactSuggestion,
  ChatAttachment,
  ChatMessageSummary,
  ChatSessionSummary,
  CreateWorktreeRequest,
  NoteSummary,
  ProjectSummary,
  PromptDraftSummary,
  SessionListItem,
  SessionSource,
  TodoStatus,
  TodoSummary,
  WorktreeSummary,
} from "@workhorse-station/shared";
import type {
  ChatStreamPendingMessage,
  NoteDraft,
  ProjectDraft,
  TodoDraft,
  WorktreeDraft,
} from "./types";
import type { SessionEditorDraft } from "../session-ui";

export function emptyProjectDraft(): ProjectDraft {
  return {
    name: "",
    path: "",
    defaultBranch: "main",
    description: "",
  };
}

export function emptyWorktreeDraft(): WorktreeDraft {
  return {
    name: "",
    branch: "",
    baseBranch: "",
  };
}

export function emptySessionEditorDraft(): SessionEditorDraft {
  return {
    provider: "claude",
    sessionName: "",
    promptTitle: "",
    prompt: "",
    todoId: "",
    worktreeId: "",
    requestedWorktreeName: "",
    promptDraftId: "",
    resumeSessionId: "",
    forkSession: false,
  };
}

export function projectToDraft(project: ProjectSummary): ProjectDraft {
  return {
    name: project.name,
    path: project.path,
    defaultBranch: project.defaultBranch,
    description: project.description ?? "",
  };
}

export function projectDraftToRequest(draft: ProjectDraft) {
  return {
    name: draft.name,
    path: draft.path,
    defaultBranch: draft.defaultBranch || "main",
    description: draft.description || null,
  };
}

export function buildSessionDraft({
  source,
  todo,
  selectedWorktree,
}: {
  source: SessionSource;
  todo: TodoSummary | null;
  selectedWorktree: WorktreeSummary | null;
}): SessionEditorDraft {
  return {
    provider: "claude",
    sessionName:
      source === "todo" && todo
        ? todo.title
        : source === "todo"
          ? "任务会话"
          : "直接会话",
    promptTitle:
      source === "todo" && todo ? `Prompt 草稿：${todo.title}` : "",
    prompt:
      source === "todo" && todo?.description.trim() ? todo.description : "",
    todoId: todo?.id ?? "",
    worktreeId: selectedWorktree?.id ?? "",
    requestedWorktreeName: "",
    promptDraftId: "",
    resumeSessionId: "",
    forkSession: false,
  };
}

export function promptDraftToSessionDraft(
  promptDraft: PromptDraftSummary
): SessionEditorDraft {
  return {
    provider: "claude",
    sessionName: promptDraft.source === "todo" ? "任务会话" : "直接会话",
    promptTitle: promptDraft.title,
    prompt: promptDraft.prompt,
    todoId: promptDraft.todoId ?? "",
    worktreeId: promptDraft.worktreeId ?? "",
    requestedWorktreeName: promptDraft.requestedWorktreeName ?? "",
    promptDraftId: promptDraft.id,
    resumeSessionId: "",
    forkSession: false,
  };
}

export function sessionToDraft(
  session: SessionListItem & { prompt?: string },
  promptDrafts: PromptDraftSummary[]
): SessionEditorDraft {
  const promptDraft = session.promptDraftId
    ? (promptDrafts.find((item) => item.id === session.promptDraftId) ?? null)
    : null;

  return {
    provider: session.provider,
    sessionName: session.name,
    promptTitle: promptDraft?.title ?? "",
    prompt: session.prompt ?? "",
    todoId: session.todoId ?? "",
    worktreeId: session.worktreeId ?? "",
    requestedWorktreeName:
      session.requestedWorktreeName ?? promptDraft?.requestedWorktreeName ?? "",
    promptDraftId: session.promptDraftId ?? "",
    resumeSessionId: "",
    forkSession: false,
  };
}

export function sessionDraftToPromptDraftRequest(
  draft: SessionEditorDraft,
  source: SessionSource
) {
  return {
    provider: draft.provider,
    todoId: optionalId(draft.todoId),
    worktreeId: optionalId(draft.worktreeId),
    requestedWorktreeName: optionalText(draft.requestedWorktreeName),
    source,
    title: draft.promptTitle.trim(),
    prompt: draft.prompt,
    status: "draft" as const,
  };
}

export function sessionDraftToCreateSessionRequest(
  draft: SessionEditorDraft,
  source: SessionSource
) {
  return {
    provider: draft.provider,
    todoId: optionalId(draft.todoId),
    worktreeId: optionalId(draft.worktreeId),
    promptDraftId: optionalId(draft.promptDraftId),
    requestedWorktreeName: optionalText(draft.requestedWorktreeName),
    source,
    name: optionalString(draft.sessionName),
    prompt: draft.prompt,
    status: "draft" as const,
    resumeSessionId: optionalId(draft.resumeSessionId),
    forkSession: draft.forkSession,
  };
}

export function optionalId(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function worktreeDraftToRequest(
  draft: WorktreeDraft
): CreateWorktreeRequest {
  return {
    name: draft.name,
    branch: draft.branch.trim() || undefined,
    baseBranch: draft.baseBranch.trim() || undefined,
  };
}

export function emptyNoteDraft(): NoteDraft {
  return {
    title: "",
    content: "",
    tags: "",
  };
}

export function emptyTodoDraft(): TodoDraft {
  return {
    title: "",
    description: "",
    status: "pending",
    tags: "",
    sourceNoteId: "",
  };
}

export function noteToDraft(note: NoteSummary): NoteDraft {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags.join(", "),
  };
}

export function todoToDraft(todo: TodoSummary): TodoDraft {
  return {
    title: todo.title,
    description: todo.description,
    status: todo.status,
    tags: todo.tags.join(", "),
    sourceNoteId: todo.sourceNoteId ?? "",
  };
}

export function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function extractNoteTitle(content: string) {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ?? "";
}

export function syncNoteTitleFromContent(draft: NoteDraft) {
  const derivedTitle = extractNoteTitle(draft.content);

  return derivedTitle && draft.title.trim() === ""
    ? { ...draft, title: derivedTitle }
    : draft;
}

export function noteDraftToRequest(draft: NoteDraft) {
  return {
    title: draft.title.trim(),
    content: draft.content,
    tags: parseTagsInput(draft.tags),
  };
}

export function todoDraftToRequest(draft: TodoDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description,
    status: draft.status,
    tags: parseTagsInput(draft.tags),
    sourceNoteId: draft.sourceNoteId || null,
  };
}
