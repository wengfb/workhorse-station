import type {
  ApiResponse,
  ApplyChatSuggestionRequest,
  ApplyChatSuggestionResponse,
  ChatSessionResponse,
  ChatSessionsResponse,
  CreateChatMessageRequest,
  CreateChatSessionRequest,
  CreateNoteRequest,
  CreateProjectRequest,
  CreatePromptDraftPreviewRequest,
  CreatePromptDraftRequest,
  CopyGlobalSkillRequest,
  CopyProjectSkillRequest,
  CopySkillResponse,
  CreateSessionRequest,
  CreateSkillRequest,
  CreateTodoRequest,
  CreateWorktreeRequest,
  DeleteChatSessionResponse,
  DeleteNoteResponse,
  DeleteProjectResponse,
  DeleteSessionResponse,
  DeleteTodoResponse,
  DeleteWorktreeRequest,
  DeleteWorktreeResponse,
  HealthResponse,
  MetaResponse,
  NoteResponse,
  NotesResponse,
  ProjectResponse,
  ProjectSkillResponse,
  ProjectSkillsResponse,
  ProjectsResponse,
  PromptDraftPreviewResponse,
  PromptDraftResponse,
  PromptDraftsResponse,
  SessionInputRequest,
  SessionResizeRequest,
  SessionResponse,
  SessionsResponse,
  SessionStreamEvent,
  SessionTerminalSnapshotResponse,
  SkillResponse,
  SkillsResponse,
  StopSessionResponse,
  TodoResponse,
  TodosResponse,
  UpdateNoteRequest,
  UpdateProjectRequest,
  RenameSkillRequest,
  UpdatePromptDraftRequest,
  UpdateSessionRequest,
  UpdateTodoRequest,
  WorktreeResponse,
  WorktreesResponse,
  DeleteSkillRequest
} from "@workhorse-station/shared";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getChatSessions() {
  return fetchJson<ChatSessionsResponse>("/api/chat-sessions");
}

export function createChatSession(input: CreateChatSessionRequest) {
  return fetchJson<ChatSessionResponse>("/api/chat-sessions", {
    method: "POST",
    body: input
  });
}

export function sendChatMessage(chatSessionId: string, input: CreateChatMessageRequest) {
  return fetchJson<ChatSessionResponse>(`/api/chat-sessions/${chatSessionId}/messages`, {
    method: "POST",
    body: input
  });
}

export function applyChatSuggestion(chatSessionId: string, chatMessageId: string, suggestionId: string, input: ApplyChatSuggestionRequest) {
  return fetchJson<ApplyChatSuggestionResponse>(`/api/chat-sessions/${chatSessionId}/messages/${chatMessageId}/suggestions/${suggestionId}/apply`, {
    method: "POST",
    body: input
  });
}

export function deleteChatSession(chatSessionId: string) {
  return fetchJson<DeleteChatSessionResponse>(`/api/chat-sessions/${chatSessionId}`, {
    method: "DELETE"
  });
}

export function getHealth() {
  return fetchJson<HealthResponse>("/health");
}

export function getMeta() {
  return fetchJson<MetaResponse>("/api/meta");
}

export function getProjects() {
  return fetchJson<ProjectsResponse>("/api/projects");
}

export function createProject(input: CreateProjectRequest) {
  return fetchJson<ProjectResponse>("/api/projects", {
    method: "POST",
    body: input
  });
}

export function updateProject(id: string, input: UpdateProjectRequest) {
  return fetchJson<ProjectResponse>(`/api/projects/${id}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteProject(id: string) {
  return fetchJson<DeleteProjectResponse>(`/api/projects/${id}`, {
    method: "DELETE"
  });
}

export function getGlobalSkills() {
  return fetchJson<SkillsResponse>("/api/skills");
}

export function createGlobalSkill(input: CreateSkillRequest) {
  return fetchJson<SkillResponse>("/api/skills", {
    method: "POST",
    body: input
  });
}

export function renameGlobalSkill(name: string, input: RenameSkillRequest) {
  return fetchJson<SkillResponse>(`/api/skills/${encodeURIComponent(name)}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteGlobalSkill(name: string, input: DeleteSkillRequest) {
  return fetchJson<{ deleted: true }>(`/api/skills/${encodeURIComponent(name)}`, {
    method: "DELETE",
    body: input
  });
}

export function copyGlobalSkillToProject(name: string, input: CopyGlobalSkillRequest) {
  return fetchJson<CopySkillResponse>(`/api/skills/${encodeURIComponent(name)}/copy`, {
    method: "POST",
    body: input
  });
}

export function getProjectSkills(projectId: string) {
  return fetchJson<ProjectSkillsResponse>(`/api/projects/${projectId}/skills`);
}

export function createProjectSkill(projectId: string, input: CreateSkillRequest) {
  return fetchJson<ProjectSkillResponse>(`/api/projects/${projectId}/skills`, {
    method: "POST",
    body: input
  });
}

export function renameProjectSkill(projectId: string, name: string, input: RenameSkillRequest) {
  return fetchJson<ProjectSkillResponse>(`/api/projects/${projectId}/skills/${encodeURIComponent(name)}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteProjectSkill(projectId: string, name: string, input: DeleteSkillRequest) {
  return fetchJson<{ deleted: true }>(`/api/projects/${projectId}/skills/${encodeURIComponent(name)}`, {
    method: "DELETE",
    body: input
  });
}

export function copyProjectSkillToGlobal(projectId: string, name: string, input: CopyProjectSkillRequest) {
  return fetchJson<CopySkillResponse>(`/api/projects/${projectId}/skills/${encodeURIComponent(name)}/copy`, {
    method: "POST",
    body: input
  });
}

export function getWorktrees(projectId: string) {
  return fetchJson<WorktreesResponse>(`/api/projects/${projectId}/worktrees`);
}

export function createWorktree(projectId: string, input: CreateWorktreeRequest) {
  return fetchJson<WorktreeResponse>(`/api/projects/${projectId}/worktrees`, {
    method: "POST",
    body: input
  });
}

export function deleteWorktree(projectId: string, worktreeId: string, input: DeleteWorktreeRequest) {
  return fetchJson<DeleteWorktreeResponse>(`/api/projects/${projectId}/worktrees/${worktreeId}`, {
    method: "DELETE",
    body: input
  });
}

export function getNotes(projectId: string) {
  return fetchJson<NotesResponse>(`/api/projects/${projectId}/notes`);
}

export function createNote(projectId: string, input: CreateNoteRequest) {
  return fetchJson<NoteResponse>(`/api/projects/${projectId}/notes`, {
    method: "POST",
    body: input
  });
}

export function updateNote(projectId: string, noteId: string, input: UpdateNoteRequest) {
  return fetchJson<NoteResponse>(`/api/projects/${projectId}/notes/${noteId}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteNote(projectId: string, noteId: string) {
  return fetchJson<DeleteNoteResponse>(`/api/projects/${projectId}/notes/${noteId}`, {
    method: "DELETE"
  });
}

export function getTodos(projectId: string) {
  return fetchJson<TodosResponse>(`/api/projects/${projectId}/todos`);
}

export function createTodo(projectId: string, input: CreateTodoRequest) {
  return fetchJson<TodoResponse>(`/api/projects/${projectId}/todos`, {
    method: "POST",
    body: input
  });
}

export function updateTodo(projectId: string, todoId: string, input: UpdateTodoRequest) {
  return fetchJson<TodoResponse>(`/api/projects/${projectId}/todos/${todoId}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteTodo(projectId: string, todoId: string) {
  return fetchJson<DeleteTodoResponse>(`/api/projects/${projectId}/todos/${todoId}`, {
    method: "DELETE"
  });
}

export function previewPromptDraft(projectId: string, input: CreatePromptDraftPreviewRequest) {
  return fetchJson<PromptDraftPreviewResponse>(`/api/projects/${projectId}/prompt-drafts/preview`, {
    method: "POST",
    body: input
  });
}

export function getPromptDrafts(projectId: string) {
  return fetchJson<PromptDraftsResponse>(`/api/projects/${projectId}/prompt-drafts`);
}

export function createPromptDraft(projectId: string, input: CreatePromptDraftRequest) {
  return fetchJson<PromptDraftResponse>(`/api/projects/${projectId}/prompt-drafts`, {
    method: "POST",
    body: input
  });
}

export function updatePromptDraft(projectId: string, promptDraftId: string, input: UpdatePromptDraftRequest) {
  return fetchJson<PromptDraftResponse>(`/api/projects/${projectId}/prompt-drafts/${promptDraftId}`, {
    method: "PATCH",
    body: input
  });
}

export function getSessions(projectId: string) {
  return fetchJson<SessionsResponse>(`/api/projects/${projectId}/sessions`);
}

export function createSession(projectId: string, input: CreateSessionRequest) {
  return fetchJson<SessionResponse>(`/api/projects/${projectId}/sessions`, {
    method: "POST",
    body: input
  });
}

export function updateSession(projectId: string, sessionId: string, input: UpdateSessionRequest) {
  return fetchJson<SessionResponse>(`/api/projects/${projectId}/sessions/${sessionId}`, {
    method: "PATCH",
    body: input
  });
}

export function stopSession(projectId: string, sessionId: string) {
  return fetchJson<StopSessionResponse>(`/api/projects/${projectId}/sessions/${sessionId}/stop`, {
    method: "POST"
  });
}

export function getSessionTerminal(projectId: string, sessionId: string) {
  return fetchJson<SessionTerminalSnapshotResponse>(`/api/projects/${projectId}/sessions/${sessionId}/terminal`);
}

export function sendSessionInput(projectId: string, sessionId: string, input: SessionInputRequest) {
  return fetchJson<SessionResponse>(`/api/projects/${projectId}/sessions/${sessionId}/input`, {
    method: "POST",
    body: input
  });
}

export function resizeSessionTerminal(projectId: string, sessionId: string, input: SessionResizeRequest) {
  return fetchJson<SessionResponse>(`/api/projects/${projectId}/sessions/${sessionId}/resize`, {
    method: "POST",
    body: input
  });
}

export function createSessionEventSource(projectId: string, sessionId: string, onEvent: (event: SessionStreamEvent) => void) {
  const source = new EventSource(`/api/projects/${projectId}/sessions/${sessionId}/events`);
  source.onmessage = (message) => {
    onEvent(JSON.parse(message.data) as SessionStreamEvent);
  };
  return source;
}

export function deleteSession(projectId: string, sessionId: string) {
  return fetchJson<DeleteSessionResponse>(`/api/projects/${projectId}/sessions/${sessionId}`, {
    method: "DELETE"
  });
}

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    if (payload.ok) {
      throw new ApiError("http_error", `${url} 返回 ${response.status}`, response.status);
    }

    throw new ApiError(payload.error.code, payload.error.message, response.status);
  }

  return payload.data;
}
