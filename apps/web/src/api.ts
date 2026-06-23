import type {
  AddGlobalSkillToStoreRequest,
  AddProjectSkillToStoreRequest,
  AgentDocResponse,
  AgentProvider,
  ApiResponse,
  ApplyChatSuggestionRequest,
  ApplyChatSuggestionResponse,
  ChatSessionResponse,
  ChatSessionsResponse,
  ChatStreamEvent,
  ConfirmToolRequest,
  CreateChatMessageRequest,
  CreateChatSessionRequest,
  CreateMemoryRequest,
  CreateNoteRequest,
  CreateProjectRequest,
  CreatePromptDraftPreviewRequest,
  CreatePromptDraftRequest,
  CreateRuleRequest,
  CopyGlobalSkillRequest,
  CopyProjectSkillRequest,
  CopySkillResponse,
  CreateSessionRequest,
  CreateSkillRequest,
  CreateTodoRequest,
  CreateWorktreeRequest,
  DeleteChatSessionResponse,
  DeleteMemoryRequest,
  DeleteNoteResponse,
  DeleteProjectResponse,
  DeleteRuleRequest,
  DeleteSessionResponse,
  DeleteWorkspaceTerminalResponse,
  ExecutionsResponse,
  DeleteTodoResponse,
  DeleteWorktreeRequest,
  DeleteWorktreeResponse,
  HealthResponse,
  ListQuery,
  MemoriesResponse,
  MemoryIndexResponse,
  MemoryResponse,
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
  RecentSessionsResponse,
  RuleResponse,
  RulesResponse,
  RunningSessionsResponse,
  SessionInputRequest,
  SessionResizeRequest,
  SessionResponse,
  SessionsResponse,
  SessionStreamEvent,
  SessionTerminalSnapshotResponse,
  SessionHistoryResponse,
  SkillDocumentResponse,
  SkillResponse,
  SkillsResponse,
  StoreSkillResponse,
  StoreSkillsResponse,
  WorkspaceTerminalResponse,
  WorkspaceTerminalSnapshotResponse,
  WorkspaceTerminalStreamEvent,
  ChatSkill,
  ChatSkillsResponse,
  CreateStoreSkillRequest,
  CreateWorkspaceTerminalRequest,
  DeleteChatSkillRequest,
  DeleteStoreSkillRequest,
  InstallStoreSkillRequest,
  RenameStoreSkillRequest,
  SendStoreSkillToProjectRequest,
  StopSessionResponse,
  TodoResponse,
  TodosResponse,
  UpdateAgentDocRequest,
  UpdateMemoryRequest,
  UpdateNoteRequest,
  UpdateProjectRequest,
  RenameSkillRequest,
  UpdatePromptDraftRequest,
  UpdateRuleRequest,
  UpdateSessionRequest,
  UpdateWorkspaceTerminalRequest,
  UpdateSkillDocumentRequest,
  UpdateTodoRequest,
  WorktreeResponse,
  WorktreesResponse,
  DeleteSkillRequest
} from "@workhorse-station/shared";
import { buildListQueryParams } from "./lib/list-query";

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

export function getChatSession(chatSessionId: string) {
  return fetchJson<ChatSessionResponse>(`/api/chat-sessions/${chatSessionId}`);
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

export function streamChatMessage(
  chatSessionId: string,
  input: CreateChatMessageRequest,
  onEvent: (event: ChatStreamEvent) => void,
  onError: (error: Error) => void,
  onClose?: () => void
): () => void {
  const controller = new AbortController();
  let completed = false;

  const processSseChunk = (chunk: string) => {
    const trimmed = chunk.trim();
    if (!trimmed) return;

    const match = trimmed.match(/^data:\s*(.+)$/s);
    if (!match) return;

    try {
      const event = JSON.parse(match[1]) as ChatStreamEvent;
      if (event.type === "chat.done" || event.type === "chat.error") {
        completed = true;
      }
      onEvent(event);
    } catch {
      // Skip malformed JSON lines
    }
  };

  fetch(`/api/chat-sessions/${chatSessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = body?.error ?? {};
        onError(new ApiError(err.code ?? "stream_error", err.message ?? "流式请求失败", response.status));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError(new Error("浏览器不支持流式读取"));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            processSseChunk(part);
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          processSseChunk(buffer);
        }

        if (!completed) {
          onError(new Error("聊天流提前结束"));
          return;
        }

        onClose?.();
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          onError(error);
        }
      }
    })
    .catch((error) => {
      if (error instanceof Error && error.name !== "AbortError") {
        onError(error);
      }
    });

  return () => controller.abort();
}

export function confirmChatTool(chatSessionId: string, toolCallId: string, approved: boolean) {
  return fetchJson<{ confirmed: boolean }>(`/api/chat-sessions/${chatSessionId}/confirm-tool`, {
    method: "POST",
    body: { toolCallId, approved } satisfies ConfirmToolRequest
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

export function truncateChatMessages(chatSessionId: string, fromMessageId: string) {
  return fetchJson<ChatSessionResponse>(`/api/chat-sessions/${chatSessionId}/messages?from=${encodeURIComponent(fromMessageId)}`, {
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

export function getGlobalSkillDocument(name: string) {
  return fetchJson<SkillDocumentResponse>(`/api/skills/${encodeURIComponent(name)}/document`);
}

export function updateGlobalSkillDocument(name: string, input: UpdateSkillDocumentRequest) {
  return fetchJson<SkillDocumentResponse>(`/api/skills/${encodeURIComponent(name)}/document`, {
    method: "PUT",
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

export function addGlobalSkillToStore(name: string, input: AddGlobalSkillToStoreRequest) {
  return fetchJson<StoreSkillResponse>(`/api/skills/${encodeURIComponent(name)}/add-to-store`, {
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

export function getProjectSkillDocument(projectId: string, name: string) {
  return fetchJson<SkillDocumentResponse>(`/api/projects/${projectId}/skills/${encodeURIComponent(name)}/document`);
}

export function updateProjectSkillDocument(projectId: string, name: string, input: UpdateSkillDocumentRequest) {
  return fetchJson<SkillDocumentResponse>(`/api/projects/${projectId}/skills/${encodeURIComponent(name)}/document`, {
    method: "PUT",
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

export function addProjectSkillToStore(projectId: string, name: string, input: AddProjectSkillToStoreRequest) {
  return fetchJson<StoreSkillResponse>(`/api/projects/${projectId}/skills/${encodeURIComponent(name)}/add-to-store`, {
    method: "POST",
    body: input
  });
}

export function getStoreSkills(projectId?: string) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return fetchJson<StoreSkillsResponse>(`/api/skill-store${query}`);
}

export function createStoreSkill(input: CreateStoreSkillRequest) {
  return fetchJson<StoreSkillResponse>("/api/skill-store", {
    method: "POST",
    body: input
  });
}

export function getStoreSkillDocument(name: string) {
  return fetchJson<SkillDocumentResponse>(`/api/skill-store/${encodeURIComponent(name)}/document`);
}

export function updateStoreSkillDocument(name: string, input: UpdateSkillDocumentRequest) {
  return fetchJson<SkillDocumentResponse>(`/api/skill-store/${encodeURIComponent(name)}/document`, {
    method: "PUT",
    body: input
  });
}

export function renameStoreSkill(name: string, input: RenameStoreSkillRequest) {
  return fetchJson<StoreSkillResponse>(`/api/skill-store/${encodeURIComponent(name)}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteStoreSkill(name: string, input: DeleteStoreSkillRequest) {
  return fetchJson<{ deleted: true }>(`/api/skill-store/${encodeURIComponent(name)}`, {
    method: "DELETE",
    body: input
  });
}

export function installStoreSkill(name: string, input: InstallStoreSkillRequest) {
  return fetchJson<StoreSkillResponse>(`/api/skill-store/${encodeURIComponent(name)}/install`, {
    method: "POST",
    body: input
  });
}

export function sendStoreSkillToProject(name: string, input: SendStoreSkillToProjectRequest) {
  return fetchJson<CopySkillResponse>(`/api/skill-store/${encodeURIComponent(name)}/to-project`, {
    method: "POST",
    body: input
  });
}

export function getChatSkills() {
  return fetchJson<ChatSkillsResponse>("/api/chat-skills");
}

export function deleteChatSkill(name: string, input: DeleteChatSkillRequest) {
  return fetchJson<{ deleted: true }>(`/api/chat-skills/${encodeURIComponent(name)}`, {
    method: "DELETE",
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

export function getGlobalNotes(opts?: ListQuery) {
  const qs = buildListQueryParams(opts).toString();
  return fetchJson<NotesResponse>(`/api/notes${qs ? `?${qs}` : ""}`);
}

export function createGlobalNote(input: CreateNoteRequest) {
  return fetchJson<NoteResponse>("/api/notes", {
    method: "POST",
    body: input
  });
}

export function updateGlobalNote(noteId: string, input: UpdateNoteRequest) {
  return fetchJson<NoteResponse>(`/api/notes/${noteId}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteGlobalNote(noteId: string) {
  return fetchJson<DeleteNoteResponse>(`/api/notes/${noteId}`, {
    method: "DELETE"
  });
}

export function getNotes(projectId: string, opts?: ListQuery) {
  const qs = buildListQueryParams(opts).toString();
  return fetchJson<NotesResponse>(`/api/projects/${projectId}/notes${qs ? `?${qs}` : ""}`);
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

export function getTodos(projectId: string, opts?: ListQuery) {
  const qs = buildListQueryParams(opts).toString();
  return fetchJson<TodosResponse>(`/api/projects/${projectId}/todos${qs ? `?${qs}` : ""}`);
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

export function getSession(projectId: string, sessionId: string) {
  return fetchJson<SessionResponse>(`/api/projects/${projectId}/sessions/${sessionId}`);
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

export function continueSession(projectId: string, sessionId: string) {
  return fetchJson<SessionResponse>(`/api/projects/${projectId}/sessions/${sessionId}/continue`, {
    method: "POST"
  });
}

export function getSessionTerminal(projectId: string, sessionId: string) {
  return fetchJson<SessionTerminalSnapshotResponse>(`/api/projects/${projectId}/sessions/${sessionId}/terminal`);
}

export function getSessionHistory(projectId: string, sessionId: string) {
  return fetchJson<SessionHistoryResponse>(`/api/projects/${projectId}/sessions/${sessionId}/history`);
}

export function createWorkspaceTerminal(input: CreateWorkspaceTerminalRequest) {
  return fetchJson<WorkspaceTerminalResponse>("/api/workspace-terminal", {
    method: "POST",
    body: input
  });
}

export function getWorkspaceTerminal(terminalId: string) {
  return fetchJson<WorkspaceTerminalSnapshotResponse>(`/api/workspace-terminal/${terminalId}`);
}

export function stopWorkspaceTerminal(terminalId: string) {
  return fetchJson<WorkspaceTerminalResponse>(`/api/workspace-terminal/${terminalId}/stop`, {
    method: "POST"
  });
}

export function updateWorkspaceTerminal(terminalId: string, input: UpdateWorkspaceTerminalRequest) {
  return fetchJson<WorkspaceTerminalResponse>(`/api/workspace-terminal/${terminalId}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteWorkspaceTerminal(terminalId: string) {
  return fetchJson<DeleteWorkspaceTerminalResponse>(`/api/workspace-terminal/${terminalId}`, {
    method: "DELETE"
  });
}

export function createWorkspaceTerminalWebSocket(terminalId: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${protocol}//${window.location.host}/api/workspace-terminal/${terminalId}/ws`);
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

export function createSessionWebSocket(projectId: string, sessionId: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${protocol}//${window.location.host}/api/projects/${projectId}/sessions/${sessionId}/ws`);
}

export function deleteSession(projectId: string, sessionId: string) {
  return fetchJson<DeleteSessionResponse>(`/api/projects/${projectId}/sessions/${sessionId}`, {
    method: "DELETE"
  });
}

export function getRunningSessions() {
  return fetchJson<RunningSessionsResponse>("/api/sessions/running");
}

export function getExecutions(limit?: number) {
  const query = limit ? `?limit=${limit}` : "";
  return fetchJson<ExecutionsResponse>(`/api/executions${query}`);
}

export function getRunningExecutions() {
  return fetchJson<ExecutionsResponse>("/api/executions/running");
}

export function getRecentSessions(limit?: number) {
  const query = limit ? `?limit=${limit}` : "";
  return fetchJson<RecentSessionsResponse>(`/api/sessions/recent${query}`);
}

export function getGlobalAgentDoc(provider: AgentProvider) {
  return fetchJson<AgentDocResponse>(`/api/agent-docs/global?provider=${encodeURIComponent(provider)}`);
}

export function updateGlobalAgentDoc(provider: AgentProvider, input: UpdateAgentDocRequest) {
  return fetchJson<AgentDocResponse>(`/api/agent-docs/global?provider=${encodeURIComponent(provider)}`, {
    method: "PUT",
    body: input
  });
}

export function getProjectAgentDoc(projectId: string, provider: AgentProvider) {
  return fetchJson<AgentDocResponse>(`/api/projects/${projectId}/agent-docs?provider=${encodeURIComponent(provider)}`);
}

export function updateProjectAgentDoc(projectId: string, provider: AgentProvider, input: UpdateAgentDocRequest) {
  return fetchJson<AgentDocResponse>(`/api/projects/${projectId}/agent-docs?provider=${encodeURIComponent(provider)}`, {
    method: "PUT",
    body: input
  });
}

export function getGlobalClaudeMd() {
  return getGlobalAgentDoc("claude");
}

export function updateGlobalClaudeMd(input: UpdateAgentDocRequest) {
  return updateGlobalAgentDoc("claude", input);
}

export function getProjectClaudeMd(projectId: string) {
  return getProjectAgentDoc(projectId, "claude");
}

export function updateProjectClaudeMd(projectId: string, input: UpdateAgentDocRequest) {
  return updateProjectAgentDoc(projectId, "claude", input);
}

export function getRules(projectId: string, provider: AgentProvider = "claude") {
  return fetchJson<RulesResponse>(`/api/projects/${projectId}/rules?provider=${encodeURIComponent(provider)}`);
}

export function getRule(projectId: string, name: string, provider: AgentProvider = "claude") {
  return fetchJson<RuleResponse>(`/api/projects/${projectId}/rules/${encodeURIComponent(name)}?provider=${encodeURIComponent(provider)}`);
}

export function createRule(projectId: string, input: CreateRuleRequest, provider: AgentProvider = "claude") {
  return fetchJson<RuleResponse>(`/api/projects/${projectId}/rules?provider=${encodeURIComponent(provider)}`, {
    method: "POST",
    body: input
  });
}

export function updateRule(projectId: string, name: string, input: UpdateRuleRequest, provider: AgentProvider = "claude") {
  return fetchJson<RuleResponse>(`/api/projects/${projectId}/rules/${encodeURIComponent(name)}?provider=${encodeURIComponent(provider)}`, {
    method: "PUT",
    body: input
  });
}

export function deleteRule(projectId: string, name: string, input: DeleteRuleRequest, provider: AgentProvider = "claude") {
  return fetchJson<{ deleted: true }>(`/api/projects/${projectId}/rules/${encodeURIComponent(name)}?provider=${encodeURIComponent(provider)}`, {
    method: "DELETE",
    body: input
  });
}

export function getMemories(projectId: string, provider: AgentProvider = "claude") {
  return fetchJson<MemoriesResponse>(`/api/projects/${projectId}/memory?provider=${encodeURIComponent(provider)}`);
}

export function getMemory(projectId: string, name: string, provider: AgentProvider = "claude") {
  return fetchJson<MemoryResponse>(`/api/projects/${projectId}/memory/${encodeURIComponent(name)}?provider=${encodeURIComponent(provider)}`);
}

export function createMemory(projectId: string, input: CreateMemoryRequest, provider: AgentProvider = "claude") {
  return fetchJson<MemoryResponse>(`/api/projects/${projectId}/memory?provider=${encodeURIComponent(provider)}`, {
    method: "POST",
    body: input
  });
}

export function updateMemory(projectId: string, name: string, input: UpdateMemoryRequest, provider: AgentProvider = "claude") {
  return fetchJson<MemoryResponse>(`/api/projects/${projectId}/memory/${encodeURIComponent(name)}?provider=${encodeURIComponent(provider)}`, {
    method: "PUT",
    body: input
  });
}

export function deleteMemory(projectId: string, name: string, input: DeleteMemoryRequest, provider: AgentProvider = "claude") {
  return fetchJson<{ deleted: true }>(`/api/projects/${projectId}/memory/${encodeURIComponent(name)}?provider=${encodeURIComponent(provider)}`, {
    method: "DELETE",
    body: input
  });
}

export function getMemoryIndex(projectId: string, provider: AgentProvider = "claude") {
  return fetchJson<MemoryIndexResponse>(`/api/projects/${projectId}/memory-index?provider=${encodeURIComponent(provider)}`);
}

export function updateMemoryIndex(projectId: string, entries: { name: string; file: string; description: string }[], provider: AgentProvider = "claude") {
  return fetchJson<MemoryIndexResponse>(`/api/projects/${projectId}/memory-index?provider=${encodeURIComponent(provider)}`, {
    method: "PUT",
    body: { entries }
  });
}

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
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
