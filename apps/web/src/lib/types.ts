import type {
  HealthResponse,
  MetaResponse,
  SkillDocumentDetail,
  ProjectSummary,
  WorktreeSummary,
  NoteSummary,
  TodoSummary,
  TodoStatus,
  PromptDraftSummary,
  SessionSource,
  SessionSummary,
  SessionListItem,
  ExecutionListItem,
  ChatSessionSummary,
  ChatMessageSummary,
  ChatAttachment,
  ChatArtifactSuggestion,
  ChatToolCall,
  ChatToolResult,
  SkillSummary,
  ProjectSkillSummary,
  StoreSkillStatus,
  SkillTransferMode as SkillTransferModeOriginal,
  WorktreeStatus,
  ChatSkill,
} from "@workhorse-station/shared";

export type SkillTransferMode = SkillTransferModeOriginal;

export type ChatFileDraft = {
  name: string;
  mimeType: string;
  size: number;
  textContent: string;
};

export type ApiState = {
  health: HealthResponse | null;
  meta: MetaResponse | null;
  loading: boolean;
  error: string | null;
};

export type SkillDocumentEditorState = {
  open: boolean;
  title: string;
  scopeLabel: string;
  load: (() => Promise<SkillDocumentDetail>) | null;
  save: ((content: string) => Promise<SkillDocumentDetail>) | null;
};

export type ProjectDraft = {
  name: string;
  path: string;
  defaultBranch: string;
  description: string;
};

export type WorktreeDraft = {
  name: string;
  branch: string;
  baseBranch: string;
};

export type NoteDraft = {
  title: string;
  content: string;
  tags: string;
};

export type TodoDraft = {
  title: string;
  description: string;
  status: TodoStatus;
  tags: string;
  sourceNoteId: string;
};

export type ProjectMode = "create" | "edit";
export type WorkspaceScope = "home" | "project";
export type HomeMode = "chat" | "overview";
export type WorkbenchTab = "notes" | "skills" | "skill-store" | "projects" | "chats" | "sessions" | "memory";
export type ProjectTab = "todos" | "notes" | "skills" | "sessions" | "worktrees" | "memory";
export type ExecutionModalMode = "session" | "workspace-terminal";
export type SelectedExecution = { kind: ExecutionListItem["kind"]; id: string };

export type WorkspaceTerminalContext = {
  projectId: string | null;
  projectName: string | null;
  worktreeId: string | null;
  worktreeName: string | null;
  requestedWorktreeName: string | null;
};

export type WorkspaceTerminalOpenOptions = {
  forceCreate?: boolean;
};

export type SkillTransferTarget =
  | { kind: "global-to-project"; skill: SkillSummary }
  | { kind: "store-to-project"; skill: StoreSkillStatus }
  | { kind: "global-to-store"; skill: SkillSummary }
  | { kind: "project-to-store"; skill: ProjectSkillSummary };

export type StreamingBlock =
  | { type: "text"; text: string }
  | { type: "tool"; toolCall: ChatToolCall; result?: ChatToolResult };

export type ChatStreamPendingMessage = {
  id: string;
  chatSessionId: string;
  role: "user" | "assistant";
  content: string;
  attachments: ChatAttachment[];
  createdAt: string;
};
