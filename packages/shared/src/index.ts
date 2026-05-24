export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type HealthResponse = {
  status: "ok";
  service: "workhorse-station-api";
  timestamp: string;
};

export type MetaResponse = {
  appName: "Workhorse Station";
  phase: "Phase 2";
  database: {
    connected: boolean;
    path: string;
    fts5: boolean;
  };
};

export type SessionResultSummary = {
  sessionId: string;
  sessionName: string;
  summary: string;
  status: SessionStatus;
  exitCode: number | null;
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  path: string;
  defaultBranch: string;
  description: string | null;
  latestSessionResult: SessionResultSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsResponse = {
  projects: ProjectSummary[];
};

export type ProjectResponse = {
  project: ProjectSummary;
};

export type CreateProjectRequest = {
  name: string;
  path: string;
  defaultBranch?: string;
  description?: string | null;
};

export type UpdateProjectRequest = Partial<CreateProjectRequest>;

export type DeleteProjectResponse = {
  deleted: true;
};

export type WorktreeStatus = "clean" | "dirty" | "missing" | "unknown";

export type WorktreeSummary = {
  id: string;
  projectId: string;
  name: string;
  path: string;
  branch: string;
  status: WorktreeStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorktreesResponse = {
  worktrees: WorktreeSummary[];
};

export type WorktreeResponse = {
  worktree: WorktreeSummary;
};

export type CreateWorktreeRequest = {
  name: string;
  branch?: string;
  baseBranch?: string;
};

export type DeleteWorktreeRequest = {
  confirmBranch: string;
};

export type DeleteWorktreeResponse = {
  deleted: true;
  deletedBranch: string;
};

export type SkillSource = "global" | "project";

export type SkillSummary = {
  name: string;
  source: SkillSource;
  path: string;
};

export type ProjectSkillSummary = {
  name: string;
  effectiveSource: SkillSource;
  effectivePath: string;
  globalPath: string | null;
  projectPath: string | null;
  hasGlobal: boolean;
  hasProject: boolean;
  hasOverride: boolean;
};

export type SkillsResponse = {
  skills: SkillSummary[];
};

export type ProjectSkillsResponse = {
  skills: ProjectSkillSummary[];
};

export type SkillResponse = {
  skill: SkillSummary;
};

export type ProjectSkillResponse = {
  skill: ProjectSkillSummary;
};

export type CreateSkillRequest = {
  name: string;
};

export type RenameSkillRequest = {
  newName: string;
};

export type DeleteSkillRequest = {
  confirmName: string;
};

export type CopyGlobalSkillRequest = {
  targetProjectId: string;
  overwrite?: boolean;
};

export type CopyProjectSkillRequest = {
  overwrite?: boolean;
};

export type CopySkillResponse = {
  skill: SkillSummary | ProjectSkillSummary;
  overwritten: boolean;
};

// Skill Store types

export type InstallTarget = "claude-code" | "chat" | "claude-code-project";

export type StoreSkillInstallStatus = {
  claudeCode: boolean;
  chat: boolean;
  claudeCodeProject: boolean;
};

export type StoreSkill = {
  name: string;
  description: string;
  path: string;
};

export type StoreSkillStatus = {
  skill: StoreSkill;
  installed: StoreSkillInstallStatus;
};

export type StoreSkillsResponse = {
  skills: StoreSkillStatus[];
};

export type StoreSkillResponse = {
  skill: StoreSkillStatus;
};

export type CreateStoreSkillRequest = {
  name: string;
  description?: string;
};

export type RenameStoreSkillRequest = {
  newName: string;
};

export type DeleteStoreSkillRequest = {
  confirmName: string;
};

export type InstallStoreSkillRequest = {
  targets: InstallTarget[];
  projectId?: string;
  overwrite?: boolean;
};

// Chat Skill types (skills loaded by AI Chat from ~/.workhorse/chat-skills/)

export type ChatSkill = {
  name: string;
  description: string;
  path: string;
};

export type ChatSkillsResponse = {
  skills: ChatSkill[];
};

export type DeleteChatSkillRequest = {
  confirmName: string;
};

export type NoteSummary = {
  id: string;
  projectId: string | null;
  title: string;
  content: string;
  tags: string[];
  sourceChatSuggestion: ChatArtifactSourceRef | null;
  createdAt: string;
  updatedAt: string;
};

export type NotesResponse = {
  notes: NoteSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type NoteResponse = {
  note: NoteSummary;
};

export type CreateNoteRequest = {
  title: string;
  content?: string;
  tags?: string[];
};

export type UpdateNoteRequest = Partial<CreateNoteRequest>;

export type DeleteNoteResponse = {
  deleted: true;
};

export type TodoStatus = "draft" | "pending" | "in_progress" | "completed";

export type TodoSummary = {
  id: string;
  projectId: string | null;
  sourceNoteId: string | null;
  title: string;
  description: string;
  status: TodoStatus;
  tags: string[];
  latestSessionResult: SessionResultSummary | null;
  sourceChatSuggestion: ChatArtifactSourceRef | null;
  createdAt: string;
  updatedAt: string;
};

export type TodosResponse = {
  todos: TodoSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type TodoResponse = {
  todo: TodoSummary;
};

export type CreateTodoRequest = {
  title: string;
  description?: string;
  status?: TodoStatus;
  tags?: string[];
  sourceNoteId?: string | null;
};

export type UpdateTodoRequest = Partial<CreateTodoRequest>;

export type DeleteTodoResponse = {
  deleted: true;
};

export type SessionSource = "direct" | "todo";
export type PromptDraftStatus = "draft" | "confirmed" | "archived";
export type SessionStatus = "draft" | "queued" | "running" | "completed" | "failed";
export type SessionRuntimeStatus = "starting" | "running" | "stopping" | "stopped" | "failed";

export type PromptDraftSummary = {
  id: string;
  projectId: string;
  todoId: string | null;
  worktreeId: string | null;
  requestedWorktreeName: string | null;
  source: SessionSource;
  title: string;
  prompt: string;
  status: PromptDraftStatus;
  sourceChatSuggestion: ChatArtifactSourceRef | null;
  createdAt: string;
  updatedAt: string;
};

export type PromptDraftsResponse = {
  promptDrafts: PromptDraftSummary[];
};

export type PromptDraftResponse = {
  promptDraft: PromptDraftSummary;
};

export type PromptDraftPreviewResponse = {
  title: string;
  prompt: string;
  source: SessionSource;
  todoId: string | null;
  worktreeId: string | null;
  requestedWorktreeName: string | null;
};

export type CreatePromptDraftPreviewRequest = {
  todoId?: string | null;
  worktreeId?: string | null;
  requestedWorktreeName?: string | null;
  source?: SessionSource;
  title?: string | null;
};

export type CreatePromptDraftRequest = {
  todoId?: string | null;
  worktreeId?: string | null;
  requestedWorktreeName?: string | null;
  source?: SessionSource;
  title: string;
  prompt: string;
  status?: PromptDraftStatus;
};

export type UpdatePromptDraftRequest = Partial<CreatePromptDraftRequest>;

export type SessionSummary = {
  id: string;
  projectId: string;
  worktreeId: string | null;
  todoId: string | null;
  promptDraftId: string | null;
  requestedWorktreeName: string | null;
  source: SessionSource;
  name: string;
  prompt: string;
  status: SessionStatus;
  runtimeStatus: SessionRuntimeStatus | null;
  summary: string | null;
  pid: number | null;
  cwd: string | null;
  resolvedWorktreePath: string | null;
  exitCode: number | null;
  lastActivityAt: string | null;
  terminalBuffer: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionsResponse = {
  sessions: SessionSummary[];
};

export type OverviewSessionSummary = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  status: SessionStatus;
  runtimeStatus: SessionRuntimeStatus | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunningSessionsResponse = {
  sessions: OverviewSessionSummary[];
};

export type RecentSessionsResponse = {
  sessions: OverviewSessionSummary[];
};

export type SessionResponse = {
  session: SessionSummary;
};

export type StopSessionResponse = {
  session: SessionSummary;
};

export type DeleteSessionResponse = {
  deleted: true;
  stoppedRuntime: boolean;
};

export type SessionTerminalSnapshotResponse = {
  sessionId: string;
  buffer: string;
  runtimeStatus: SessionRuntimeStatus | null;
  cwd: string | null;
};

export type SessionInputRequest = {
  data: string;
};

export type SessionResizeRequest = {
  cols: number;
  rows: number;
};

export type SessionStreamEventType = "session.started" | "session.runtime" | "session.output" | "session.exit" | "session.error";

export type SessionStreamEvent = {
  type: SessionStreamEventType;
  sessionId: string;
  timestamp: string;
  runtimeStatus?: SessionRuntimeStatus | null;
  pid?: number | null;
  cwd?: string | null;
  output?: string;
  exitCode?: number | null;
  message?: string;
};

export type CreateSessionRequest = {
  worktreeId?: string | null;
  todoId?: string | null;
  promptDraftId?: string | null;
  requestedWorktreeName?: string | null;
  source?: SessionSource;
  name?: string;
  prompt?: string;
  status?: SessionStatus;
  summary?: string | null;
  resumeSessionId?: string | null;
  forkSession?: boolean;
};

export type UpdateSessionRequest = {
  name?: string;
  summary?: string | null;
  applyResultToTodo?: boolean;
  applyResultToProject?: boolean;
};

export type SessionHistoryMessageBlock = {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
};

export type SessionHistoryMessage = {
  role: "user" | "assistant";
  content: SessionHistoryMessageBlock[];
  timestamp: string | null;
  isSidechain: boolean;
};

export type SessionHistoryResponse = {
  sessionId: string;
  messages: SessionHistoryMessage[];
};

export type ChatRole = "user" | "assistant";
export type ChatArtifactSuggestionType = "note" | "todo" | "prompt_draft";
export type ChatArtifactAdoptionStatus = "pending" | "saved";

export type ChatArtifactSourceRef = {
  chatSessionId: string;
  chatMessageId: string;
  suggestionId: string;
};

export type ChatArtifactSuggestionAdoption = {
  status: ChatArtifactAdoptionStatus;
  targetType: ChatArtifactSuggestionType | null;
  targetId: string | null;
  projectId: string | null;
  worktreeId: string | null;
  adoptedAt: string | null;
};

export type ChatAttachment = {
  name: string;
  mimeType: string;
  size: number;
  textContent: string;
};

export type ChatToolCallStatus = "pending_confirmation" | "approved" | "rejected" | "executed";

export type ChatToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ChatToolCallStatus;
};

export type ChatToolResult = {
  toolCallId: string;
  result: string;
  isError: boolean;
};

export type ChatArtifactSuggestion = {
  id: string;
  type: ChatArtifactSuggestionType;
  title: string;
  content: string;
  description?: string;
  tags?: string[];
  status?: TodoStatus;
  adoption?: ChatArtifactSuggestionAdoption;
};

export type ChatMessageSummary = {
  id: string;
  chatSessionId: string;
  role: ChatRole;
  content: string;
  attachments: ChatAttachment[];
  artifactSuggestions: ChatArtifactSuggestion[];
  toolCalls: ChatToolCall[];
  toolResults: ChatToolResult[];
  createdAt: string;
};

export type ChatSessionSummary = {
  id: string;
  projectId: string | null;
  worktreeId: string | null;
  title: string;
  messages: ChatMessageSummary[];
  createdAt: string;
  updatedAt: string;
};

export type ChatSessionsResponse = {
  chatSessions: ChatSessionSummary[];
};

export type ChatSessionResponse = {
  chatSession: ChatSessionSummary;
};

export type DeleteChatSessionResponse = {
  deleted: true;
};

export type CreateChatSessionRequest = {
  projectId?: string | null;
  worktreeId?: string | null;
  title?: string;
};

export type CreateChatMessageRequest = {
  content?: string;
  attachments?: ChatAttachment[];
  projectId?: string | null;
  worktreeId?: string | null;
};

export type ApplyChatSuggestionRequest = {
  projectId?: string | null;
  worktreeId?: string | null;
};

export type AppliedChatSuggestionTarget =
  | { type: "note"; note: NoteSummary }
  | { type: "todo"; todo: TodoSummary }
  | { type: "prompt_draft"; promptDraft: PromptDraftSummary };

export type ApplyChatSuggestionResponse = {
  chatSession: ChatSessionSummary;
  suggestion: ChatArtifactSuggestion;
  target: AppliedChatSuggestionTarget;
  deduped: boolean;
};

export type ChatStreamEventType =
  | "chat.text_delta"
  | "chat.tool_use_pending"
  | "chat.tool_call"
  | "chat.tool_result"
  | "chat.done"
  | "chat.error";

export type ChatStreamEvent = {
  type: ChatStreamEventType;
  chatSessionId: string;
  timestamp: string;
  text?: string;
  toolCall?: ChatToolCall;
  toolResult?: ChatToolResult;
  message?: string;
};

export type ConfirmToolRequest = {
  toolCallId: string;
  approved: boolean;
};

