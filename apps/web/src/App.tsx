import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type {
  ExecutionListItem,
  ChatArtifactSuggestion,
  ChatAttachment,
  ChatSkill,
  ChatMessageSummary,
  ChatSessionSummary,
  ChatStreamEvent,
  ChatToolCall,
  ChatToolResult,
  CreateMemoryRequest,
  CreateRuleRequest,
  CreateWorktreeRequest,
  DeleteMemoryRequest,
  DeleteRuleRequest,
  HealthResponse,
  MemoriesResponse,
  MemoryDetail,
  MemoryResponse,
  MemorySummary,
  MemoryType,
  ProjectSkillSummary,
  SkillDocumentDetail,
  MetaResponse,
  NoteSummary,
  ProjectSummary,
  PromptDraftSummary,
  RuleDetail,
  RuleSummary,
  RulesResponse,
  SessionSource,
  SessionStreamEvent,
  SessionSummary,
  SkillSummary,
  SkillTransferMode,
  StoreSkillStatus,
  TodoStatus,
  TodoSummary,
  UpdateMemoryRequest,
  WorkspaceTerminalStreamEvent,
  WorkspaceTerminalSummary,
  WorktreeStatus,
  WorktreeSummary
} from "@workhorse-station/shared";
import { MarkdownContent } from "./markdown-content";
import { Select } from "./components/ui/Select";
import { useConfirmDialog } from "./components/DialogContext";
import { useGlobalNotesList } from "./hooks/use-global-notes-list";
import { useProjectNotesList } from "./hooks/use-project-notes-list";
import { useProjectTodosList } from "./hooks/use-project-todos-list";
import {
  addGlobalSkillToStore,
  addProjectSkillToStore,
  ApiError,
  copyGlobalSkillToProject,
  copyProjectSkillToGlobal,
  deleteChatSkill,
  getChatSkills,
  createGlobalSkill,
  createGlobalNote,
  createProjectSkill,
  createNote,
  createProject,
  createPromptDraft,
  createSession,
  createStoreSkill,
  createTodo,
  createWorktree,
  createChatSession,
  deleteChatSession,
  deleteGlobalSkill,
  deleteGlobalNote,
  deleteProjectSkill,
  deleteNote,
  deleteProject,
  deleteSession,
  deleteWorkspaceTerminal,
  deleteStoreSkill,
  deleteTodo,
  deleteWorktree,
  getChatSessions,
  getHealth,
  getMeta,
  getGlobalSkills,
  getProjectSkills,
  getProjects,
  getPromptDrafts,
  getExecutions,
  getRunningExecutions,
  getRunningSessions,
  getSessions,
  getStoreSkills,
  getWorktrees,
  previewPromptDraft,
  installStoreSkill,
  getGlobalSkillDocument,
  updateGlobalSkillDocument,
  renameGlobalSkill,
  renameProjectSkill,
  renameStoreSkill,
  sendChatMessage,
  sendStoreSkillToProject,
  getProjectSkillDocument,
  updateProjectSkillDocument,
  getStoreSkillDocument,
  updateStoreSkillDocument,
  streamChatMessage,
  truncateChatMessages,
  confirmChatTool,
  stopSession,
  continueSession,
  createWorkspaceTerminal,
  getWorkspaceTerminal,
  stopWorkspaceTerminal,
  updateGlobalNote,
  updateNote,
  updateProject,
  updatePromptDraft,
  updateSession,
  updateTodo,
  getGlobalClaudeMd,
  updateGlobalClaudeMd,
  getProjectClaudeMd,
  updateProjectClaudeMd,
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  getMemories,
  getMemory,
  createMemory,
  updateMemory,
  deleteMemory
} from "./api";
import { SessionModal as SessionModalPanel, CreateSessionModal, SessionsWorkspace as SessionsWorkspacePanel, type SessionEditorDraft } from "./session-ui";

type ApiState = {
  health: HealthResponse | null;
  meta: MetaResponse | null;
  loading: boolean;
  error: string | null;
};

type SkillDocumentEditorState = {
  open: boolean;
  title: string;
  scopeLabel: string;
  load: (() => Promise<SkillDocumentDetail>) | null;
  save: ((content: string) => Promise<SkillDocumentDetail>) | null;
};

type ProjectDraft = {
  name: string;
  path: string;
  defaultBranch: string;
  description: string;
};

type WorktreeDraft = {
  name: string;
  branch: string;
  baseBranch: string;
};

type NoteDraft = {
  title: string;
  content: string;
  tags: string;
};

type TodoDraft = {
  title: string;
  description: string;
  status: TodoStatus;
  tags: string;
  sourceNoteId: string;
};

type ChatFileDraft = {
  name: string;
  mimeType: string;
  size: number;
  textContent: string;
};

type ProjectMode = "create" | "edit";
type WorkspaceScope = "home" | "project";
type HomeMode = "chat" | "overview";
type WorkbenchTab = "notes" | "skills" | "skill-store" | "projects" | "chats" | "sessions" | "memory";
type ProjectTab = "todos" | "notes" | "skills" | "sessions" | "worktrees" | "memory";
type ExecutionModalMode = "session" | "workspace-terminal";
type SelectedExecution = { kind: ExecutionListItem["kind"]; id: string };

type WorkspaceTerminalContext = {
  projectId: string | null;
  projectName: string | null;
  worktreeId: string | null;
  worktreeName: string | null;
  requestedWorktreeName: string | null;
};

type WorkspaceTerminalOpenOptions = {
  forceCreate?: boolean;
};

type SkillTransferTarget =
  | { kind: "global-to-project"; skill: SkillSummary }
  | { kind: "store-to-project"; skill: StoreSkillStatus }
  | { kind: "global-to-store"; skill: SkillSummary }
  | { kind: "project-to-store"; skill: ProjectSkillSummary };

type StreamingBlock =
  | { type: "text"; text: string }
  | { type: "tool"; toolCall: ChatToolCall; result?: ChatToolResult };

const topModes: Array<{ id: HomeMode; label: string; description: string }> = [
  { id: "chat", label: "聊天", description: "左侧聊天会话列表，右侧简洁聊天区" },
  { id: "overview", label: "工作台", description: "管理全局笔记、Skill、项目、聊天和运行中会话" }
];

const homeModes = topModes;

const projectTabs: Array<{ id: ProjectTab; label: string }> = [
  { id: "todos", label: "任务" },
  { id: "notes", label: "笔记" },
  { id: "skills", label: "Skill" },
  { id: "sessions", label: "会话" },
  { id: "worktrees", label: "Worktree" },
  { id: "memory", label: "记忆" }
];

const todoStatusOptions: Array<{ value: TodoStatus; label: string }> = [
  { value: "draft", label: "草稿" },
  { value: "pending", label: "待处理" },
  { value: "in_progress", label: "进行中" },
  { value: "completed", label: "已完成" }
];

const textFileExtensions = new Set(["txt", "md", "markdown", "json", "ts", "tsx", "js", "jsx", "mjs", "cjs", "css", "html", "xml", "yml", "yaml", "sql", "java", "go", "py", "rb", "sh"]);
const maxChatFileSize = 200_000;

export function App() {
  const [workspaceScope, setWorkspaceScope] = useState<WorkspaceScope>("home");
  const [activeHomeMode, setActiveHomeMode] = useState<HomeMode>("chat");
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatFile, setChatFile] = useState<ChatFileDraft | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [streamingBlocks, setStreamingBlocks] = useState<StreamingBlock[]>([]);
  const streamAbortRef = useRef<(() => void) | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>("todos");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [worktreeDialogOpen, setWorktreeDialogOpen] = useState(false);
  const [sessionCreateModalOpen, setSessionCreateModalOpen] = useState(false);
  const [executionModalMode, setExecutionModalMode] = useState<ExecutionModalMode | null>(null);
  const [workspaceTerminal, setWorkspaceTerminal] = useState<WorkspaceTerminalSummary | null>(null);
  const [workspaceTerminalContext, setWorkspaceTerminalContext] = useState<WorkspaceTerminalContext | null>(null);
  const [workspaceTerminalError, setWorkspaceTerminalError] = useState<string | null>(null);
  const [openingWorkspaceTerminal, setOpeningWorkspaceTerminal] = useState(false);
  const [stoppingWorkspaceTerminal, setStoppingWorkspaceTerminal] = useState(false);
  const [deletingWorkspaceTerminalId, setDeletingWorkspaceTerminalId] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<SelectedExecution | null>(null);
  const [executionItems, setExecutionItems] = useState<ExecutionListItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedPromptDraftId, setSelectedPromptDraftId] = useState<string | null>(null);
  const [sessionLaunchSource, setSessionLaunchSource] = useState<SessionSource>("direct");
  const [sessionDraft, setSessionDraft] = useState<SessionEditorDraft>(emptySessionEditorDraft());
  const [apiState, setApiState] = useState<ApiState>({
    health: null,
    meta: null,
    loading: true,
    error: null
  });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectMode, setProjectMode] = useState<ProjectMode>("create");
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft());
  const [projectError, setProjectError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [worktrees, setWorktrees] = useState<WorktreeSummary[]>([]);
  const [worktreesLoading, setWorktreesLoading] = useState(false);
  const [selectedWorktreeId, setSelectedWorktreeId] = useState<string | null>(null);
  const [worktreeDraft, setWorktreeDraft] = useState<WorktreeDraft>(emptyWorktreeDraft());
  const [worktreeError, setWorktreeError] = useState<string | null>(null);
  const [savingWorktree, setSavingWorktree] = useState(false);
  const [deletingWorktreeId, setDeletingWorktreeId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(emptyNoteDraft());
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [noteSettingsOpen, setNoteSettingsOpen] = useState(false);
  const [noteTitleLocked, setNoteTitleLocked] = useState(false);
  const noteAutosaveSkipRef = useRef(0);

  const [todoDraft, setTodoDraft] = useState<TodoDraft>(emptyTodoDraft());
  const [savingTodo, setSavingTodo] = useState(false);
  const [deletingTodoId, setDeletingTodoId] = useState<string | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<PromptDraftSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [runningSessions, setRunningSessions] = useState<ExecutionListItem[]>([]);
  const [previewingPromptDraft, setPreviewingPromptDraft] = useState(false);
  const [savingPromptDraft, setSavingPromptDraft] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [updatingSessionId, setUpdatingSessionId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [continuingSessionId, setContinuingSessionId] = useState<string | null>(null);
  const [globalNoteDraft, setGlobalNoteDraft] = useState<NoteDraft>(emptyNoteDraft());
  const [savingGlobalNote, setSavingGlobalNote] = useState(false);
  const [deletingGlobalNoteId, setDeletingGlobalNoteId] = useState<string | null>(null);
  const [globalNoteSettingsOpen, setGlobalNoteSettingsOpen] = useState(false);
  const [globalNoteTitleLocked, setGlobalNoteTitleLocked] = useState(false);
  const globalNoteAutosaveSkipRef = useRef(0);
  const [globalSkills, setGlobalSkills] = useState<SkillSummary[]>([]);
  const [globalSkillsLoading, setGlobalSkillsLoading] = useState(true);
  const [globalSkillsError, setGlobalSkillsError] = useState<string | null>(null);
  const [projectSkills, setProjectSkills] = useState<ProjectSkillSummary[]>([]);
  const [projectSkillsLoading, setProjectSkillsLoading] = useState(false);
  const [projectSkillsError, setProjectSkillsError] = useState<string | null>(null);
  const [selectedProjectSkillName, setSelectedProjectSkillName] = useState<string | null>(null);
  const [skillOperationName, setSkillOperationName] = useState<string | null>(null);
  const [storeSkills, setStoreSkills] = useState<StoreSkillStatus[]>([]);
  const [storeSkillsLoading, setStoreSkillsLoading] = useState(true);
  const [storeSkillsError, setStoreSkillsError] = useState<string | null>(null);
  const [storeSkillOperationName, setStoreSkillOperationName] = useState<string | null>(null);
  const [skillTransferTarget, setSkillTransferTarget] = useState<SkillTransferTarget | null>(null);
  const [skillTransferProjectId, setSkillTransferProjectId] = useState<string>("");
  const [skillTransferMode, setSkillTransferMode] = useState<SkillTransferMode>("copy");
  const [skillTransferError, setSkillTransferError] = useState<string | null>(null);
  const [chatSkills, setChatSkills] = useState<ChatSkill[]>([]);
  const [chatSkillsLoading, setChatSkillsLoading] = useState(true);
  const [chatSkillsError, setChatSkillsError] = useState<string | null>(null);
  const [deletingChatSkillName, setDeletingChatSkillName] = useState<string | null>(null);
  const [skillDocumentEditor, setSkillDocumentEditor] = useState<SkillDocumentEditorState>({
    open: false,
    title: "",
    scopeLabel: "",
    load: null,
    save: null
  });
  const [skillDocumentLoading, setSkillDocumentLoading] = useState(false);
  const [skillDocumentSaving, setSkillDocumentSaving] = useState(false);
  const [skillDocumentError, setSkillDocumentError] = useState<string | null>(null);
  const [skillDocumentContent, setSkillDocumentContent] = useState("");
  const { confirm, prompt } = useConfirmDialog();
  const globalNotesList = useGlobalNotesList({ formatError });
  const projectNotesList = useProjectNotesList({ projectId: selectedProjectId, formatError });
  const projectTodosList = useProjectTodosList({ projectId: selectedProjectId, formatError });

  useEffect(() => {
    let cancelled = false;

    async function loadAppState() {
      try {
        const [health, meta, projectsData, chatData, globalSkillsData, storeSkillsData, chatSkillsData] = await Promise.all([getHealth(), getMeta(), getProjects(), getChatSessions(), getGlobalSkills(), getStoreSkills(), getChatSkills()]);

        if (cancelled) {
          return;
        }

        const firstProject = projectsData.projects[0] ?? null;
        const firstChat = chatData.chatSessions[0] ?? null;
        setApiState({ health, meta, loading: false, error: null });
        setProjects(projectsData.projects);
        setProjectsLoading(false);
        setChatSessions(chatData.chatSessions);
        setGlobalSkills(globalSkillsData.skills);
        setGlobalSkillsLoading(false);
        setGlobalSkillsError(null);
        setStoreSkills(storeSkillsData.skills);
        setStoreSkillsLoading(false);
        setStoreSkillsError(null);
        setChatSkills(chatSkillsData.skills);
        setChatSkillsLoading(false);
        setChatSkillsError(null);
        setSelectedChatId(firstChat?.id ?? null);
        setChatLoading(false);
        setChatError(null);

        if (firstProject) {
          setSelectedProjectId(firstProject.id);
          setProjectMode("edit");
          setProjectDraft(projectToDraft(firstProject));
        }

        try {
          await reloadExecutions();
        } catch {
          if (!cancelled) {
            setRunningSessions([]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setApiState((current) => ({
            ...current,
            loading: false,
            error: formatError(error, "API 连接失败")
          }));
          setProjectsLoading(false);
          setChatLoading(false);
          setChatError(formatError(error, "聊天会话加载失败"));
          setGlobalSkillsLoading(false);
          setGlobalSkillsError(formatError(error, "全局 Skill 加载失败"));
          setStoreSkillsLoading(false);
          setStoreSkillsError(formatError(error, "技能仓库加载失败"));
          setChatSkillsLoading(false);
          setChatSkillsError(formatError(error, "Chat Skill 加载失败"));
        }
      }
    }

    void loadAppState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!selectedProjectId) {
      setWorktrees([]);
      setSelectedWorktreeId(null);
      setWorktreesLoading(false);
      setWorktreeError(null);
      setPromptDrafts([]);
      setSessions([]);
      setSelectedSessionId(null);
      setSelectedPromptDraftId(null);
      setSessionsLoading(false);
      setSessionsError(null);
      setProjectSkills([]);
      setSelectedProjectSkillName(null);
      setProjectSkillsLoading(false);
      setProjectSkillsError(null);
      setSessionCreateModalOpen(false);
      setExecutionModalMode(null);
      setSessionDraft(emptySessionEditorDraft());
      return;
    }

    async function loadProjectResources(projectId: string) {
      setWorktreesLoading(true);
      setWorktreeError(null);
      setSessionsLoading(true);
      setSessionsError(null);
      setProjectSkillsLoading(true);
      setProjectSkillsError(null);

      const [worktreesResult, promptDraftsResult, sessionsResult, projectSkillsResult] = await Promise.allSettled([
        getWorktrees(projectId),
        getPromptDrafts(projectId),
        getSessions(projectId),
        getProjectSkills(projectId)
      ]);

      if (cancelled) {
        return;
      }

      if (worktreesResult.status === "fulfilled") {
        const nextWorktree = worktreesResult.value.worktrees.find((worktree) => worktree.id === selectedWorktreeId) ?? null;
        setWorktrees(worktreesResult.value.worktrees);
        setSelectedWorktreeId(nextWorktree?.id ?? null);
        setWorktreeError(null);
      } else {
        setWorktrees([]);
        setSelectedWorktreeId(null);
        setWorktreeError(formatError(worktreesResult.reason, "Worktree 列表加载失败"));
      }

      if (promptDraftsResult.status === "fulfilled") {
        setPromptDrafts(promptDraftsResult.value.promptDrafts);
      } else {
        setPromptDrafts([]);
        setSessionsError(formatError(promptDraftsResult.reason, "Prompt 草稿加载失败"));
      }

      if (sessionsResult.status === "fulfilled") {
        const nextSession = sessionsResult.value.sessions.find((session) => session.id === selectedSessionId) ?? sessionsResult.value.sessions[0] ?? null;
        setSessions(sessionsResult.value.sessions);
        setSelectedSessionId(nextSession?.id ?? null);
      } else {
        setSessions([]);
        setSelectedSessionId(null);
        setSessionsError(formatError(sessionsResult.reason, "会话列表加载失败"));
      }

      if (projectSkillsResult.status === "fulfilled") {
        const nextSkill =
          projectSkillsResult.value.skills.find((skill) => skill.name === selectedProjectSkillName) ?? projectSkillsResult.value.skills[0] ?? null;
        setProjectSkills(projectSkillsResult.value.skills);
        setSelectedProjectSkillName(nextSkill?.name ?? null);
        setProjectSkillsError(null);
      } else {
        setProjectSkills([]);
        setSelectedProjectSkillName(null);
        setProjectSkillsError(formatError(projectSkillsResult.reason, "项目 Skill 加载失败"));
      }

      setWorktreesLoading(false);
      setSessionsLoading(false);
      setProjectSkillsLoading(false);
    }

    void loadProjectResources(selectedProjectId);

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedWorktree = worktrees.find((worktree) => worktree.id === selectedWorktreeId) ?? null;
  const globalNotes = globalNotesList.items;
  const selectedGlobalNoteId = globalNotesList.selectedId;
  const setSelectedGlobalNoteId = globalNotesList.setSelectedId;
  const globalNotesLoading = globalNotesList.loading;
  const globalNotesError = globalNotesList.error;
  const setGlobalNotesError = globalNotesList.setError;
  const globalNotesTotal = globalNotesList.total;
  const globalNotesPage = globalNotesList.page;
  const setGlobalNotesPage = globalNotesList.setPage;
  const globalNoteSearchQuery = globalNotesList.searchQuery;
  const setGlobalNoteSearchQuery = globalNotesList.setSearchQuery;
  const globalNoteFilterTags = globalNotesList.filterTags;
  const setGlobalNoteFilterTags = globalNotesList.setFilterTags;
  const availableGlobalNoteTags = globalNotesList.availableTags;
  const selectedGlobalNote = globalNotes.find((note) => note.id === selectedGlobalNoteId) ?? null;
  const notes = projectNotesList.items;
  const selectedNoteId = projectNotesList.selectedId;
  const setSelectedNoteId = projectNotesList.setSelectedId;
  const notesLoading = projectNotesList.loading;
  const notesError = projectNotesList.error;
  const setNotesError = projectNotesList.setError;
  const notesTotal = projectNotesList.total;
  const notesPage = projectNotesList.page;
  const setNotesPage = projectNotesList.setPage;
  const noteSearchQuery = projectNotesList.searchQuery;
  const setNoteSearchQuery = projectNotesList.setSearchQuery;
  const noteFilterTags = projectNotesList.filterTags;
  const setNoteFilterTags = projectNotesList.setFilterTags;
  const availableNoteTags = projectNotesList.availableTags;
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const todos = projectTodosList.items;
  const selectedTodoId = projectTodosList.selectedId;
  const setSelectedTodoId = projectTodosList.setSelectedId;
  const todosLoading = projectTodosList.loading;
  const todosError = projectTodosList.error;
  const setTodosError = projectTodosList.setError;
  const todosTotal = projectTodosList.total;
  const todosPage = projectTodosList.page;
  const setTodosPage = projectTodosList.setPage;
  const todoSearchQuery = projectTodosList.searchQuery;
  const setTodoSearchQuery = projectTodosList.setSearchQuery;
  const todoFilterTags = projectTodosList.filterTags;
  const setTodoFilterTags = projectTodosList.setFilterTags;
  const todoStatuses = projectTodosList.statuses;
  const setTodoStatuses = projectTodosList.setStatuses;
  const availableTodoTags = projectTodosList.availableTags;
  const selectedTodo = todos.find((todo) => todo.id === selectedTodoId) ?? null;
  const selectedSession = selectedSessionId ? sessions.find((session) => session.id === selectedSessionId) ?? null : null;
  const selectedPromptDraft = selectedPromptDraftId ? promptDrafts.find((promptDraft) => promptDraft.id === selectedPromptDraftId) ?? null : null;
  const apiConnected = apiState.health?.status === "ok";

  useEffect(() => {
    if (selectedGlobalNote) {
      globalNoteAutosaveSkipRef.current += 1;
      setGlobalNoteTitleLocked(true);
      setGlobalNoteDraft(noteToDraft(selectedGlobalNote));
      return;
    }

    globalNoteAutosaveSkipRef.current += 1;
    setGlobalNoteTitleLocked(false);
    setGlobalNoteDraft(emptyNoteDraft());
  }, [selectedGlobalNoteId]);

  useEffect(() => {
    if (globalNoteAutosaveSkipRef.current > 0) {
      globalNoteAutosaveSkipRef.current -= 1;
      return;
    }

    if (!selectedGlobalNote && !globalNoteDraft.title.trim() && !globalNoteDraft.content.trim() && !globalNoteDraft.tags.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistGlobalNoteDraft();
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [globalNoteDraft.content, globalNoteDraft.tags, globalNoteDraft.title]);

  useEffect(() => {
    if (selectedNote) {
      noteAutosaveSkipRef.current += 1;
      setNoteTitleLocked(true);
      setNoteDraft(noteToDraft(selectedNote));
      return;
    }

    noteAutosaveSkipRef.current += 1;
    setNoteTitleLocked(false);
    setNoteDraft(emptyNoteDraft());
  }, [selectedNoteId, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    if (noteAutosaveSkipRef.current > 0) {
      noteAutosaveSkipRef.current -= 1;
      return;
    }

    if (!selectedNote && !noteDraft.title.trim() && !noteDraft.content.trim() && !noteDraft.tags.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistNoteDraft();
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [noteDraft.content, noteDraft.tags, noteDraft.title]);

  useEffect(() => {
    if (selectedTodo) {
      setTodoDraft(todoToDraft(selectedTodo));
      return;
    }

    setTodoDraft(emptyTodoDraft());
  }, [selectedTodoId, selectedProjectId]);

  useEffect(() => {
    if (selectedExecution?.kind !== "session") {
      return;
    }

    if (!sessions.some((session) => session.id === selectedExecution.id)) {
      return;
    }

    if (selectedSessionId !== selectedExecution.id) {
      setSelectedSessionId(selectedExecution.id);
    }
  }, [selectedExecution, sessions, selectedSessionId]);

  useEffect(() => {
    if (selectedSession) {
      setSessionDraft(sessionToDraft(selectedSession, promptDrafts));
      setSelectedPromptDraftId(selectedSession.promptDraftId ?? null);
      setSessionLaunchSource(selectedSession.source);
      return;
    }

    if (selectedPromptDraft) {
      setSessionDraft(promptDraftToSessionDraft(selectedPromptDraft));
      setSessionLaunchSource(selectedPromptDraft.source);
      return;
    }
  }, [selectedSessionId, selectedPromptDraftId, selectedProjectId, sessions, promptDrafts]);

  const databaseInfo = apiState.meta?.database ?? null;
  const runningSessionCount = sessions.filter((session) => session.status === "running" || session.status === "queued").length;
  const recentProjects = projects.slice(0, 5);
  const homeMode = homeModes.find((mode) => mode.id === activeHomeMode) ?? homeModes[0];
  const selectedChat = chatSessions.find((session) => session.id === selectedChatId) ?? chatSessions[0] ?? null;
  const featureCards = [
    { title: "项目", value: String(projects.length), detail: "已接入项目 CRUD 和目录绑定" },
    { title: "Worktree", value: String(worktrees.length), detail: selectedProject ? "当前项目 worktree" : "选择项目后查看" },
    { title: "运行中会话", value: String(runningSessionCount), detail: "真实 Claude Code 会话与终端已接入" },
    { title: "MySQL", value: databaseInfo?.connected ? "已连接" : "等待中", detail: databaseInfo ? `${databaseInfo.engine} @ ${databaseInfo.host}/${databaseInfo.database}` : "等待后端" }
  ];

  async function reloadChatSessions(preferredChatId?: string | null) {
    setChatLoading(true);

    try {
      const data = await getChatSessions();
      const nextChat =
        (preferredChatId ? data.chatSessions.find((session) => session.id === preferredChatId) : null) ??
        data.chatSessions.find((session) => session.id === selectedChatId) ??
        data.chatSessions[0] ??
        null;

      setChatSessions(data.chatSessions);
      setSelectedChatId(nextChat?.id ?? null);
      setChatError(null);
    } catch (error) {
      setChatError(formatError(error, "聊天会话加载失败"));
    } finally {
      setChatLoading(false);
    }
  }

  async function reloadProjects(preferredProjectId?: string | null) {
    setProjectsLoading(true);

    try {
      const projectsData = await getProjects();
      const nextProject =
        (preferredProjectId ? projectsData.projects.find((project) => project.id === preferredProjectId) : null) ??
        projectsData.projects.find((project) => project.id === selectedProjectId) ??
        projectsData.projects[0] ??
        null;

      setProjects(projectsData.projects);
      setProjectError(null);

      if (nextProject) {
        if (nextProject.id !== selectedProjectId) {
          setWorktrees([]);
          setSelectedWorktreeId(null);
        }

        setSelectedProjectId(nextProject.id);
        setProjectMode("edit");
        setProjectDraft(projectToDraft(nextProject));
      } else {
        setSelectedProjectId(null);
        setProjectMode("create");
        setProjectDraft(emptyProjectDraft());
        setWorktrees([]);
        setSelectedWorktreeId(null);
      }
    } catch (error) {
      setProjectError(formatError(error, "项目列表加载失败"));
    } finally {
      setProjectsLoading(false);
    }
  }

  async function reloadWorktrees(projectId: string, preferredWorktreeId?: string | null) {
    setWorktreesLoading(true);

    try {
      const data = await getWorktrees(projectId);
      const nextWorktree =
        (preferredWorktreeId ? data.worktrees.find((worktree) => worktree.id === preferredWorktreeId) : null) ??
        data.worktrees.find((worktree) => worktree.id === selectedWorktreeId) ??
        null;

      setWorktrees(data.worktrees);
      setSelectedWorktreeId(nextWorktree?.id ?? null);
      setWorktreeError(null);
    } catch (error) {
      setWorktreeError(formatError(error, "Worktree 列表加载失败"));
    } finally {
      setWorktreesLoading(false);
    }
  }

  async function reloadGlobalSkills() {
    setGlobalSkillsLoading(true);

    try {
      const data = await getGlobalSkills();
      setGlobalSkills(data.skills);
      setGlobalSkillsError(null);
    } catch (error) {
      setGlobalSkillsError(formatError(error, "全局 Skill 加载失败"));
    } finally {
      setGlobalSkillsLoading(false);
    }
  }

  async function reloadStoreSkills() {
    setStoreSkillsLoading(true);

    try {
      const data = await getStoreSkills(selectedProjectId ?? undefined);
      setStoreSkills(data.skills);
      setStoreSkillsError(null);
    } catch (error) {
      setStoreSkillsError(formatError(error, "技能仓库加载失败"));
    } finally {
      setStoreSkillsLoading(false);
    }
  }

  async function reloadChatSkills() {
    setChatSkillsLoading(true);

    try {
      const data = await getChatSkills();
      setChatSkills(data.skills);
      setChatSkillsError(null);
    } catch (error) {
      setChatSkillsError(formatError(error, "Chat Skill 加载失败"));
    } finally {
      setChatSkillsLoading(false);
    }
  }

  function openSkillTransfer(target: SkillTransferTarget) {
    setSkillTransferTarget(target);
    setSkillTransferMode("copy");
    setSkillTransferError(null);
    setSkillTransferProjectId(selectedProject?.id ?? "");
  }

  function closeSkillTransfer() {
    setSkillTransferTarget(null);
    setSkillTransferError(null);
    setSkillTransferMode("copy");
    setSkillTransferProjectId("");
  }

  async function runSkillTransferWithOverwriteRetry(
    skillName: string,
    confirmMessage: string,
    action: (overwrite: boolean) => Promise<void>
  ) {
    try {
      await action(false);
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "skill_path_exists") {
        throw error;
      }

      const overwrite = await confirm(confirmMessage, { danger: true });
      if (!overwrite) {
        return false;
      }

      await action(true);
    }

    return true;
  }

  async function submitSkillTransfer() {
    if (!skillTransferTarget) {
      return;
    }

    const isProjectTarget = skillTransferTarget.kind === "global-to-project" || skillTransferTarget.kind === "store-to-project";
    const targetProject = isProjectTarget ? projects.find((project) => project.id === skillTransferProjectId) ?? null : null;

    if (isProjectTarget && !targetProject) {
      setSkillTransferError("请选择目标项目");
      return;
    }

    try {
      setSkillTransferError(null);

      if (skillTransferTarget.kind === "global-to-project") {
        setSkillOperationName(skillTransferTarget.skill.name);
        setGlobalSkillsError(null);
        setProjectSkillsError(null);
        const completed = await runSkillTransferWithOverwriteRetry(
          skillTransferTarget.skill.name,
          `项目中已存在同名 Skill「${skillTransferTarget.skill.name}」，是否覆盖项目文件夹？`,
          async (overwrite) => {
            await copyGlobalSkillToProject(skillTransferTarget.skill.name, {
              targetProjectId: targetProject!.id,
              mode: skillTransferMode,
              overwrite
            });
          }
        );
        if (!completed) return;
        await Promise.all([
          reloadGlobalSkills(),
          targetProject!.id === selectedProject?.id ? reloadProjectSkills(targetProject!.id, skillTransferTarget.skill.name) : Promise.resolve()
        ]);
      } else if (skillTransferTarget.kind === "store-to-project") {
        setStoreSkillOperationName(skillTransferTarget.skill.skill.name);
        setStoreSkillsError(null);
        const completed = await runSkillTransferWithOverwriteRetry(
          skillTransferTarget.skill.skill.name,
          `项目中已存在同名 Skill「${skillTransferTarget.skill.skill.name}」，是否覆盖项目文件夹？`,
          async (overwrite) => {
            await sendStoreSkillToProject(skillTransferTarget.skill.skill.name, {
              targetProjectId: targetProject!.id,
              mode: skillTransferMode,
              overwrite
            });
          }
        );
        if (!completed) return;
        await Promise.all([
          reloadStoreSkills(),
          targetProject!.id === selectedProject?.id ? reloadProjectSkills(targetProject!.id, skillTransferTarget.skill.skill.name) : Promise.resolve()
        ]);
      } else if (skillTransferTarget.kind === "global-to-store") {
        const overwrite = storeSkills.some((item) => item.skill.name === skillTransferTarget.skill.name)
          ? await confirm(`技能仓库中已存在同名 Skill「${skillTransferTarget.skill.name}」，是否覆盖仓库文件夹？`, { danger: true })
          : false;
        if (storeSkills.some((item) => item.skill.name === skillTransferTarget.skill.name) && !overwrite) return;
        setSkillOperationName(skillTransferTarget.skill.name);
        setGlobalSkillsError(null);
        setStoreSkillsError(null);
        await addGlobalSkillToStore(skillTransferTarget.skill.name, { mode: skillTransferMode, overwrite });
        await Promise.all([reloadGlobalSkills(), reloadStoreSkills()]);
      } else {
        const overwrite = storeSkills.some((item) => item.skill.name === skillTransferTarget.skill.name)
          ? await confirm(`技能仓库中已存在同名 Skill「${skillTransferTarget.skill.name}」，是否覆盖仓库文件夹？`, { danger: true })
          : false;
        if (storeSkills.some((item) => item.skill.name === skillTransferTarget.skill.name) && !overwrite) return;
        if (!selectedProject) {
          setSkillTransferError("当前未选择项目");
          return;
        }
        setSkillOperationName(skillTransferTarget.skill.name);
        setProjectSkillsError(null);
        setStoreSkillsError(null);
        await addProjectSkillToStore(selectedProject.id, skillTransferTarget.skill.name, { mode: skillTransferMode, overwrite });
        await Promise.all([reloadProjectSkills(selectedProject.id, skillTransferTarget.skill.name), reloadStoreSkills()]);
      }

      closeSkillTransfer();
    } catch (error) {
      setSkillTransferError(formatError(error, "Skill 流转失败"));
    } finally {
      setSkillOperationName(null);
      setStoreSkillOperationName(null);
    }
  }

  async function handleDeleteChatSkill(skill: ChatSkill) {
    const confirmedName = await prompt(`请输入 Skill 名称「${skill.name}」以确认删除`);

    if (!confirmedName || confirmedName.trim() !== skill.name) {
      return;
    }

    setDeletingChatSkillName(skill.name);
    setChatSkillsError(null);

    try {
      await deleteChatSkill(skill.name, { confirmName: skill.name });
      await reloadChatSkills();
      await reloadStoreSkills();
    } catch (error) {
      setChatSkillsError(formatError(error, "Chat Skill 删除失败"));
    } finally {
      setDeletingChatSkillName(null);
    }
  }

  async function reloadProjectSkills(projectId: string, preferredName?: string | null) {
    setProjectSkillsLoading(true);

    try {
      const data = await getProjectSkills(projectId);
      const nextSkill =
        (preferredName ? data.skills.find((skill) => skill.name === preferredName) : null) ??
        data.skills.find((skill) => skill.name === selectedProjectSkillName) ??
        data.skills[0] ??
        null;

      setProjectSkills(data.skills);
      setSelectedProjectSkillName(nextSkill?.name ?? null);
      setProjectSkillsError(null);
    } catch (error) {
      setProjectSkillsError(formatError(error, "项目 Skill 加载失败"));
    } finally {
      setProjectSkillsLoading(false);
    }
  }

  async function reloadPromptDrafts(projectId: string, preferredPromptDraftId?: string | null) {
    setSessionsLoading(true);

    try {
      const data = await getPromptDrafts(projectId);
      const nextPromptDraft =
        (preferredPromptDraftId ? data.promptDrafts.find((promptDraft) => promptDraft.id === preferredPromptDraftId) : null) ??
        data.promptDrafts.find((promptDraft) => promptDraft.id === selectedPromptDraftId) ??
        data.promptDrafts[0] ??
        null;

      setPromptDrafts(data.promptDrafts);
      setSelectedPromptDraftId(nextPromptDraft?.id ?? null);
      setSessionsError(null);
    } catch (error) {
      setSessionsError(formatError(error, "Prompt 草稿加载失败"));
    } finally {
      setSessionsLoading(false);
    }
  }

  async function reloadExecutions(preferred?: SelectedExecution | null) {
    try {
      const [allData, runningData] = await Promise.all([getExecutions(), getRunningExecutions()]);
      const nextExecution =
        (preferred ? allData.executions.find((item) => item.kind === preferred.kind && item.id === preferred.id) : null) ??
        (selectedExecution ? allData.executions.find((item) => item.kind === selectedExecution.kind && item.id === selectedExecution.id) : null) ??
        allData.executions[0] ??
        null;

      setExecutionItems(allData.executions);
      setSelectedExecution(nextExecution ? { kind: nextExecution.kind, id: nextExecution.id } : null);
      setRunningSessions(runningData.executions);
      setSessionsError(null);
      return runningData.executions;
    } catch (error) {
      setSessionsError(formatError(error, "执行列表加载失败"));
      setRunningSessions([]);
      return [];
    }
  }

  async function reloadSessions(projectId: string, preferredSessionId?: string | null) {
    setSessionsLoading(true);

    try {
      const data = await getSessions(projectId);
      const nextSession =
        (preferredSessionId ? data.sessions.find((session) => session.id === preferredSessionId) : null) ?? data.sessions.find((session) => session.id === selectedSessionId) ?? data.sessions[0] ?? null;

      setSessions(data.sessions);
      setSelectedSessionId(nextSession?.id ?? null);
      setSessionsError(null);
    } catch (error) {
      setSessionsError(formatError(error, "会话列表加载失败"));
    } finally {
      setSessionsLoading(false);
    }
  }

  function startCreateProject() {
    setProjectMode("create");
    setProjectDraft(emptyProjectDraft());
    setProjectError(null);
    setProjectDialogOpen(true);
  }

  function startEditProject() {
    if (!selectedProject) {
      return;
    }

    setProjectMode("edit");
    setProjectDraft(projectToDraft(selectedProject));
    setProjectError(null);
    setProjectDialogOpen(true);
  }

  function setCurrentProject(project: ProjectSummary) {
    setSelectedProjectId(project.id);
    setSelectedWorktreeId(null);
    setWorktrees([]);
    setProjectMode("edit");
    setProjectDraft(projectToDraft(project));
    setProjectError(null);
    setWorktreeError(null);
  }

  function selectProject(project: ProjectSummary) {
    setCurrentProject(project);
    setWorkspaceScope("project");
    setActiveProjectTab("todos");
    setProjectMenuOpen(false);
  }

  function updateProjectDraft(field: keyof ProjectDraft, value: string) {
    setProjectDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateWorktreeDraft(field: keyof WorktreeDraft, value: string) {
    setWorktreeDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateGlobalNoteDraft(field: keyof NoteDraft, value: string) {
    setGlobalNoteDraft((current) => {
      if (field === "title") {
        setGlobalNoteTitleLocked(value.trim().length > 0);
        return {
          ...current,
          title: value
        };
      }

      if (field === "content") {
        const nextDraft = {
          ...current,
          content: value
        };

        return globalNoteTitleLocked ? nextDraft : syncNoteTitleFromContent(nextDraft);
      }

      return {
        ...current,
        [field]: value
      };
    });
  }

  function updateNoteDraft(field: keyof NoteDraft, value: string) {
    setNoteDraft((current) => {
      if (field === "title") {
        setNoteTitleLocked(value.trim().length > 0);
        return {
          ...current,
          title: value
        };
      }

      if (field === "content") {
        const nextDraft = {
          ...current,
          content: value
        };

        return noteTitleLocked ? nextDraft : syncNoteTitleFromContent(nextDraft);
      }

      return {
        ...current,
        [field]: value
      };
    });
  }

  function updateTodoDraft(field: keyof TodoDraft, value: string) {
    setTodoDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateSessionDraft(field: keyof SessionEditorDraft, value: string | boolean) {
    setSessionDraft((current) => {
      if (field === "worktreeId" && typeof value === "string") {
        return {
          ...current,
          worktreeId: value,
          requestedWorktreeName: value ? "" : current.requestedWorktreeName
        };
      }

      if (field === "requestedWorktreeName" && typeof value === "string") {
        return {
          ...current,
          requestedWorktreeName: value,
          worktreeId: value.trim() ? "" : current.worktreeId
        };
      }

      return {
        ...current,
        [field]: value
      };
    });
  }

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProject(true);
    setProjectError(null);

    try {
      if (projectMode === "create") {
        const data = await createProject(projectDraftToRequest(projectDraft));
        await reloadProjects(data.project.id);
      } else if (selectedProject) {
        const data = await updateProject(selectedProject.id, projectDraftToRequest(projectDraft));
        await reloadProjects(data.project.id);
      }

      setProjectDialogOpen(false);
      setWorkspaceScope("project");
      setActiveProjectTab("todos");
    } catch (error) {
      setProjectError(formatError(error, "项目保存失败"));
    } finally {
      setSavingProject(false);
    }
  }


  async function handleEditGlobalSkillDocument(skill: SkillSummary) {
    setSkillOperationName(skill.name);
    setGlobalSkillsError(null);
    try {
      await openSkillDocumentEditor({
        title: `编辑 Skill 文档：${skill.name}`,
        scopeLabel: "全局 Skill",
        load: () => getGlobalSkillDocument(skill.name).then((data) => data.document),
        save: (content) => updateGlobalSkillDocument(skill.name, { content }).then((data) => data.document),
        errorSetter: setGlobalSkillsError
      });
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleEditStoreSkillDocument(skill: StoreSkillStatus) {
    setStoreSkillOperationName(skill.skill.name);
    setStoreSkillsError(null);
    try {
      await openSkillDocumentEditor({
        title: `编辑 Skill 文档：${skill.skill.name}`,
        scopeLabel: "技能仓库",
        load: () => getStoreSkillDocument(skill.skill.name).then((data) => data.document),
        save: (content) => updateStoreSkillDocument(skill.skill.name, { content }).then((data) => data.document),
        errorSetter: setStoreSkillsError
      });
      await reloadStoreSkills();
    } finally {
      setStoreSkillOperationName(null);
    }
  }

  async function handleEditProjectSkillDocument(skill: ProjectSkillSummary) {
    if (!selectedProject) {
      return;
    }

    setSkillOperationName(skill.name);
    setProjectSkillsError(null);
    try {
      await openSkillDocumentEditor({
        title: `编辑 Skill 文档：${skill.name}`,
        scopeLabel: skill.hasProject ? "项目 Skill" : "全局 Skill（只读来源已映射为可编辑文档）",
        load: () => getProjectSkillDocument(selectedProject.id, skill.name).then((data) => data.document),
        save: (content) => updateProjectSkillDocument(selectedProject.id, skill.name, { content }).then((data) => data.document),
        errorSetter: setProjectSkillsError
      });
      await reloadProjectSkills(selectedProject.id, skill.name);
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleCreateGlobalSkill() {
    const name = await prompt("请输入全局 Skill 文件夹名");

    if (!name) {
      return;
    }

    const trimmedName = name.trim();
    setSkillOperationName(trimmedName);
    setGlobalSkillsError(null);

    try {
      await createGlobalSkill({ name: trimmedName });
      await reloadGlobalSkills();
    } catch (error) {
      setGlobalSkillsError(formatError(error, "全局 Skill 创建失败"));
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleRenameGlobalSkill(skill: SkillSummary) {
    const newName = await prompt("请输入新的全局 Skill 文件夹名", { defaultValue: skill.name });

    if (!newName || newName.trim() === skill.name) {
      return;
    }

    const trimmedName = newName.trim();
    setSkillOperationName(skill.name);
    setGlobalSkillsError(null);

    try {
      await renameGlobalSkill(skill.name, { newName: trimmedName });
      await Promise.all([reloadGlobalSkills(), selectedProject ? reloadProjectSkills(selectedProject.id, trimmedName) : Promise.resolve()]);
    } catch (error) {
      setGlobalSkillsError(formatError(error, "全局 Skill 重命名失败"));
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleDeleteGlobalSkill(skill: SkillSummary) {
    const confirmed = await confirm(`确认删除全局 Skill 文件夹「${skill.name}」？\n\n将删除目录：${skill.path}`, { danger: true });

    if (!confirmed) {
      return;
    }

    setSkillOperationName(skill.name);
    setGlobalSkillsError(null);

    try {
      await deleteGlobalSkill(skill.name, { confirmName: skill.name });
      await Promise.all([reloadGlobalSkills(), selectedProject ? reloadProjectSkills(selectedProject.id, null) : Promise.resolve()]);
    } catch (error) {
      setGlobalSkillsError(formatError(error, "全局 Skill 删除失败"));
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleCopyGlobalSkillToProject(skill: SkillSummary) {
    openSkillTransfer({ kind: "global-to-project", skill });
  }

  async function handleAddGlobalSkillToStore(skill: SkillSummary) {
    openSkillTransfer({ kind: "global-to-store", skill });
  }

  async function handleCreateStoreSkill(name: string, description: string) {
    const trimmedName = name.trim();
    setStoreSkillOperationName(trimmedName);
    setStoreSkillsError(null);

    try {
      await createStoreSkill({ name: trimmedName, description: description.trim() });
      await reloadStoreSkills();
    } catch (error) {
      setStoreSkillsError(formatError(error, "Skill 创建失败"));
    } finally {
      setStoreSkillOperationName(null);
    }
  }

  async function handleRenameStoreSkill(skill: StoreSkillStatus) {
    const newName = await prompt("请输入新的 Skill 名称", { defaultValue: skill.skill.name });

    if (!newName || newName.trim() === skill.skill.name) {
      return;
    }

    setStoreSkillOperationName(skill.skill.name);
    setStoreSkillsError(null);

    try {
      await renameStoreSkill(skill.skill.name, { newName: newName.trim() });
      await reloadStoreSkills();
    } catch (error) {
      setStoreSkillsError(formatError(error, "Skill 重命名失败"));
    } finally {
      setStoreSkillOperationName(null);
    }
  }

  async function handleDeleteStoreSkill(skill: StoreSkillStatus) {
    const confirmedName = await prompt(`请输入 Skill 名称「${skill.skill.name}」以确认删除`);

    if (!confirmedName || confirmedName.trim() !== skill.skill.name) {
      return;
    }

    setStoreSkillOperationName(skill.skill.name);
    setStoreSkillsError(null);

    try {
      await deleteStoreSkill(skill.skill.name, { confirmName: skill.skill.name });
      await reloadStoreSkills();
    } catch (error) {
      setStoreSkillsError(formatError(error, "Skill 删除失败"));
    } finally {
      setStoreSkillOperationName(null);
    }
  }

  async function handleInstallStoreSkill(skill: StoreSkillStatus, target: "claude-code" | "chat") {
    const targetLabel = target === "claude-code" ? "全局 Claude Code" : "AI Chat";

    const ok = await confirm(`确认将「${skill.skill.name}」安装到 ${targetLabel}？`);

    if (!ok) {
      return;
    }

    setStoreSkillOperationName(skill.skill.name);
    setStoreSkillsError(null);

    try {
      await installStoreSkill(skill.skill.name, {
        targets: [target],
        overwrite: true
      });
      await reloadStoreSkills();
      if (target === "chat") {
        await reloadChatSkills();
      }
    } catch (error) {
      setStoreSkillsError(formatError(error, "Skill 安装失败"));
    } finally {
      setStoreSkillOperationName(null);
    }
  }

  async function handleSendStoreSkillToProject(skill: StoreSkillStatus) {
    openSkillTransfer({ kind: "store-to-project", skill });
  }

  async function handleCreateProjectSkill() {
    if (!selectedProject) {
      return;
    }

    const name = await prompt("请输入项目 Skill 文件夹名");

    if (!name) {
      return;
    }

    const trimmedName = name.trim();
    setSkillOperationName(trimmedName);
    setProjectSkillsError(null);

    try {
      await createProjectSkill(selectedProject.id, { name: trimmedName });
      await reloadProjectSkills(selectedProject.id, trimmedName);
    } catch (error) {
      setProjectSkillsError(formatError(error, "项目 Skill 创建失败"));
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleRenameProjectSkill(skill: ProjectSkillSummary) {
    if (!selectedProject || !skill.hasProject) {
      return;
    }

    const newName = await prompt("请输入新的项目 Skill 文件夹名", { defaultValue: skill.name });

    if (!newName || newName.trim() === skill.name) {
      return;
    }

    const trimmedName = newName.trim();
    setSkillOperationName(skill.name);
    setProjectSkillsError(null);

    try {
      await renameProjectSkill(selectedProject.id, skill.name, { newName: trimmedName });
      await reloadProjectSkills(selectedProject.id, trimmedName);
    } catch (error) {
      setProjectSkillsError(formatError(error, "项目 Skill 重命名失败"));
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleDeleteProjectSkill(skill: ProjectSkillSummary) {
    if (!selectedProject || !skill.hasProject) {
      return;
    }

    const confirmed = await confirm(`确认删除项目 Skill 文件夹「${skill.name}」？\n\n将删除目录：${skill.projectPath ?? skill.effectivePath}`, { danger: true });

    if (!confirmed) {
      return;
    }

    setSkillOperationName(skill.name);
    setProjectSkillsError(null);

    try {
      await deleteProjectSkill(selectedProject.id, skill.name, { confirmName: skill.name });
      await reloadProjectSkills(selectedProject.id, null);
    } catch (error) {
      setProjectSkillsError(formatError(error, "项目 Skill 删除失败"));
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleAddProjectSkillToStore(skill: ProjectSkillSummary) {
    openSkillTransfer({ kind: "project-to-store", skill });
  }

  async function handleCopyProjectSkillToGlobal(skill: ProjectSkillSummary) {
    if (!selectedProject || !skill.hasProject) {
      return;
    }

    const overwrite = skill.hasGlobal ? await confirm(`全局中已存在同名 Skill「${skill.name}」，是否覆盖全局文件夹？`, { danger: true }) : false;

    if (skill.hasGlobal && !overwrite) {
      return;
    }

    setSkillOperationName(skill.name);
    setGlobalSkillsError(null);
    setProjectSkillsError(null);

    try {
      await copyProjectSkillToGlobal(selectedProject.id, skill.name, { overwrite });
      await Promise.all([reloadGlobalSkills(), reloadProjectSkills(selectedProject.id, skill.name)]);
    } catch (error) {
      setProjectSkillsError(formatError(error, "复制项目 Skill 到全局失败"));
    } finally {
      setSkillOperationName(null);
    }
  }


  async function openSkillDocumentEditor(options: {
    title: string;
    scopeLabel: string;
    load: () => Promise<SkillDocumentDetail>;
    save: (content: string) => Promise<SkillDocumentDetail>;
    errorSetter: (message: string | null) => void;
  }) {
    setSkillDocumentEditor({
      open: true,
      title: options.title,
      scopeLabel: options.scopeLabel,
      load: options.load,
      save: options.save
    });
    setSkillDocumentError(null);
    setSkillDocumentContent("");
    setSkillDocumentLoading(true);
    try {
      const data = await options.load();
      setSkillDocumentContent(data.content);
    } catch (error) {
      const message = formatError(error, "Skill 文档加载失败");
      setSkillDocumentError(message);
      options.errorSetter(message);
    } finally {
      setSkillDocumentLoading(false);
    }
  }

  async function handleSaveSkillDocument() {
    if (!skillDocumentEditor.save) {
      return;
    }

    setSkillDocumentSaving(true);
    setSkillDocumentError(null);
    try {
      const data = await skillDocumentEditor.save(skillDocumentContent);
      setSkillDocumentContent(data.content);
      setSkillDocumentEditor((current) => ({ ...current, open: false }));
    } catch (error) {
      setSkillDocumentError(formatError(error, "Skill 文档保存失败"));
    } finally {
      setSkillDocumentSaving(false);
    }
  }

  function closeSkillDocumentEditor() {
    setSkillDocumentEditor({ open: false, title: "", scopeLabel: "", load: null, save: null });
    setSkillDocumentError(null);
    setSkillDocumentLoading(false);
    setSkillDocumentSaving(false);
  }

  async function handleProjectDelete() {
    if (!selectedProject) {
      return;
    }

    const confirmed = await confirm("删除项目只会移除 Workhorse Station 中的记录，不会删除本地代码目录。若项目仍有 worktree，需要先删除 worktree。确认删除？", { danger: true });

    if (!confirmed) {
      return;
    }

    setDeletingProject(true);
    setProjectError(null);

    try {
      await deleteProject(selectedProject.id);
      await reloadProjects(null);
    } catch (error) {
      setProjectError(formatError(error, "项目删除失败"));
    } finally {
      setDeletingProject(false);
    }
  }

  async function handleWorktreeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    setSavingWorktree(true);
    setWorktreeError(null);

    try {
      const data = await createWorktree(selectedProject.id, worktreeDraftToRequest(worktreeDraft));
      setWorktreeDraft(emptyWorktreeDraft());
      setWorktreeDialogOpen(false);
      await reloadWorktrees(selectedProject.id, data.worktree.id);
    } catch (error) {
      setWorktreeError(formatError(error, "Worktree 创建失败"));
    } finally {
      setSavingWorktree(false);
    }
  }

  async function handleWorktreeDelete(worktree: WorktreeSummary) {
    if (!selectedProject) {
      return;
    }

    const confirmed = await confirm(
      `确认删除 worktree「${worktree.name}」？\n\n将删除目录：${worktree.path}\n将删除本地分支：${worktree.branch}\n\n如果存在未提交改动或未合并提交，后端会阻止删除。`,
      { danger: true }
    );

    if (!confirmed) {
      return;
    }

    setDeletingWorktreeId(worktree.id);
    setWorktreeError(null);

    try {
      await deleteWorktree(selectedProject.id, worktree.id, { confirmBranch: worktree.branch });
      await reloadWorktrees(selectedProject.id, null);
    } catch (error) {
      setWorktreeError(formatError(error, "Worktree 删除失败"));
    } finally {
      setDeletingWorktreeId(null);
    }
  }

  async function persistGlobalNoteDraft() {
    const request = noteDraftToRequest(globalNoteDraft);
    if (!request.title && !request.content && !request.tags.length) {
      return;
    }

    setSavingGlobalNote(true);
    setGlobalNotesError(null);

    try {
      if (selectedGlobalNote) {
        const data = await updateGlobalNote(selectedGlobalNote.id, request);
        await globalNotesList.refresh(data.note.id);
      } else {
        const data = await createGlobalNote(request);
        await globalNotesList.refresh(data.note.id);
      }
    } catch (error) {
      setGlobalNotesError(formatError(error, "全局笔记保存失败"));
    } finally {
      setSavingGlobalNote(false);
    }
  }

  async function handleGlobalNoteSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistGlobalNoteDraft();
  }

  async function handleGlobalNoteDelete(note: NoteSummary) {
    const confirmed = await confirm(`确认删除全局笔记「${note.title}」？`, { danger: true });

    if (!confirmed) {
      return;
    }

    setDeletingGlobalNoteId(note.id);
    setGlobalNotesError(null);

    try {
      await deleteGlobalNote(note.id);
      await globalNotesList.refresh(null);
      setGlobalNoteSettingsOpen(false);
    } catch (error) {
      setGlobalNotesError(formatError(error, "全局笔记删除失败"));
    } finally {
      setDeletingGlobalNoteId(null);
    }
  }

  async function persistNoteDraft() {
    if (!selectedProject) {
      return;
    }

    const request = noteDraftToRequest(noteDraft);
    if (!request.title && !request.content && !request.tags.length) {
      return;
    }

    setSavingNote(true);
    setNotesError(null);

    try {
      if (selectedNote) {
        const data = await updateNote(selectedProject.id, selectedNote.id, request);
        await projectNotesList.refresh(data.note.id);
      } else {
        const data = await createNote(selectedProject.id, request);
        await projectNotesList.refresh(data.note.id);
      }
    } catch (error) {
      setNotesError(formatError(error, "项目笔记保存失败"));
    } finally {
      setSavingNote(false);
    }
  }

  async function handleNoteSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistNoteDraft();
  }

  async function handleNoteDelete(note: NoteSummary) {
    if (!selectedProject) {
      return;
    }

    const confirmed = await confirm(`确认删除笔记「${note.title}」？如果有任务引用它，来源关联会被清空。`, { danger: true });

    if (!confirmed) {
      return;
    }

    setDeletingNoteId(note.id);
    setNotesError(null);

    try {
      await deleteNote(selectedProject.id, note.id);
      await Promise.all([projectNotesList.refresh(null), projectTodosList.refresh(null)]);
      setNoteSettingsOpen(false);
    } catch (error) {
      setNotesError(formatError(error, "项目笔记删除失败"));
    } finally {
      setDeletingNoteId(null);
    }
  }

  async function handleCreateTodoFromNote() {
    if (!selectedProject || !selectedNote) {
      return;
    }

    setSavingTodo(true);
    setTodosError(null);

    try {
      const data = await createTodo(selectedProject.id, {
        title: selectedNote.title,
        description: selectedNote.content,
        sourceNoteId: selectedNote.id,
        status: "draft",
        tags: selectedNote.tags
      });
      await projectTodosList.refresh(data.todo.id);
      setActiveProjectTab("todos");
    } catch (error) {
      setTodosError(formatError(error, "从笔记创建任务失败"));
    } finally {
      setSavingTodo(false);
    }
  }

  async function handleTodoSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    setSavingTodo(true);
    setTodosError(null);

    try {
      const request = todoDraftToRequest(todoDraft);

      if (selectedTodo) {
        const data = await updateTodo(selectedProject.id, selectedTodo.id, request);
        await projectTodosList.refresh(data.todo.id);
      } else {
        const data = await createTodo(selectedProject.id, request);
        await projectTodosList.refresh(data.todo.id);
      }
    } catch (error) {
      setTodosError(formatError(error, "项目任务保存失败"));
    } finally {
      setSavingTodo(false);
    }
  }

  async function handleTodoDelete(todo: TodoSummary) {
    if (!selectedProject) {
      return;
    }

    const confirmed = await confirm(`确认删除任务「${todo.title}」？`, { danger: true });

    if (!confirmed) {
      return;
    }

    setDeletingTodoId(todo.id);
    setTodosError(null);

    try {
      await deleteTodo(selectedProject.id, todo.id);
      await projectTodosList.refresh(null);
      setTodoDraft(emptyTodoDraft());
    } catch (error) {
      setTodosError(formatError(error, "项目任务删除失败"));
    } finally {
      setDeletingTodoId(null);
    }
  }

  async function handleTodoStatusChange(todo: TodoSummary, newStatus: TodoStatus) {
    if (!selectedProject || todo.status === newStatus) return;

    setTodosError(null);

    try {
      if (newStatus === "completed" && !todoStatuses.includes("completed")) {
        setTodoStatuses([...todoStatuses, "completed"]);
      }
      await updateTodo(selectedProject.id, todo.id, { status: newStatus });
      await projectTodosList.refresh(todo.id);
    } catch (error) {
      setTodosError(formatError(error, "任务状态更新失败"));
    }
  }

  function openWorktreeDialog() {
    setWorktreeDraft(emptyWorktreeDraft());
    setWorktreeError(null);
    setWorktreeDialogOpen(true);
  }

  function startCreateGlobalNote() {
    setSelectedGlobalNoteId(null);
    setGlobalNoteSettingsOpen(false);
    setGlobalNoteTitleLocked(false);
    globalNoteAutosaveSkipRef.current += 1;
    setGlobalNoteDraft(emptyNoteDraft());
    setGlobalNotesError(null);
  }

  function startCreateNote() {
    setSelectedNoteId(null);
    setNoteSettingsOpen(false);
    setNoteTitleLocked(false);
    noteAutosaveSkipRef.current += 1;
    setNoteDraft(emptyNoteDraft());
    setNotesError(null);
  }

  function startCreateTodo() {
    setSelectedTodoId(null);
    setTodoDraft(emptyTodoDraft());
    setTodosError(null);
  }

  async function createChatSessionRecord() {
    setCreatingChat(true);
    setChatError(null);

    try {
      const data = await createChatSession({
        projectId: selectedProject?.id ?? null,
        worktreeId: selectedWorktree?.id ?? null
      });
      await reloadChatSessions(data.chatSession.id);
      setChatDraft("");
      setChatFile(null);
    } catch (error) {
      setChatError(formatError(error, "聊天会话创建失败"));
    } finally {
      setCreatingChat(false);
    }
  }

  async function handleChatFileChange(file: File | null) {
    if (!file) {
      setChatFile(null);
      return;
    }

    try {
      const attachment = await readChatFile(file);
      setChatFile(attachment);
      setChatError(null);
    } catch (error) {
      setChatError(formatError(error, "文件读取失败"));
      setChatFile(null);
    }
  }

  async function handleSendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = chatDraft.trim();
    const attachments = chatFile ? [toChatAttachment(chatFile)] : [];

    if (!content && !attachments.length) {
      return;
    }

    let targetChatId = selectedChat?.id ?? null;

    if (!targetChatId) {
      setCreatingChat(true);
      setChatError(null);

      try {
        const created = await createChatSession({
          projectId: selectedProject?.id ?? null,
          worktreeId: selectedWorktree?.id ?? null
        });
        targetChatId = created.chatSession.id;
        setSelectedChatId(created.chatSession.id);
      } catch (error) {
        setChatError(formatError(error, "聊天会话创建失败"));
        setCreatingChat(false);
        return;
      } finally {
        setCreatingChat(false);
      }
    }

    const isEditing = editingMessageId !== null;

    if (isEditing && targetChatId) {
      try {
        await truncateChatMessages(targetChatId, editingMessageId!);
        await reloadChatSessions(targetChatId);
      } catch (error) {
        setChatError(formatError(error, "消息清理失败"));
        return;
      }
    }

    setSendingChat(true);
    setChatError(null);
    setChatDraft("");
    setChatFile(null);
    setEditingMessageId(null);
    setStreamingChatId(targetChatId);
    setStreamingBlocks([]);

    streamAbortRef.current?.();
    const abort = streamChatMessage(
      targetChatId,
      {
        content,
        attachments,
        projectId: selectedProject?.id ?? null,
        worktreeId: selectedWorktree?.id ?? null
      },
      (event: ChatStreamEvent) => {
        switch (event.type) {
          case "chat.text_delta":
            setStreamingBlocks((prev) => {
              const last = prev[prev.length - 1];
              if (last?.type === "text") {
                return [...prev.slice(0, -1), { ...last, text: last.text + (event.text ?? "") }];
              }
              return [...prev, { type: "text", text: event.text ?? "" }];
            });
            break;
          case "chat.tool_use_pending":
            if (event.toolCall) {
              setStreamingBlocks((prev) => [...prev, { type: "tool", toolCall: { ...event.toolCall!, status: "pending_confirmation" } }]);
            }
            break;
          case "chat.tool_call":
            if (event.toolCall) {
              setStreamingBlocks((prev) =>
                prev.map((block) =>
                  block.type === "tool" && block.toolCall.id === event.toolCall!.id
                    ? { ...block, toolCall: { ...event.toolCall!, status: "executed" as const } }
                    : block
                )
              );
            }
            break;
          case "chat.tool_result":
            if (event.toolResult) {
              setStreamingBlocks((prev) =>
                prev.map((block) =>
                  block.type === "tool" && block.toolCall.id === event.toolResult!.toolCallId
                    ? { ...block, result: event.toolResult! }
                    : block
                )
              );
            }
            break;
          case "chat.done":
            setStreamingChatId(null);
            setSendingChat(false);
            reloadChatSessions(event.chatSessionId);
            break;
          case "chat.error":
            setChatError(event.message ?? "流式响应出错");
            setStreamingChatId(null);
            setSendingChat(false);
            reloadChatSessions(event.chatSessionId);
            break;
        }
      },
      (error: Error) => {
        setChatError(formatError(error, "消息发送失败"));
        setStreamingChatId(null);
        setSendingChat(false);
      }
    );

    streamAbortRef.current = abort;
  }

  function handleConfirmTool(toolCallId: string, approved: boolean) {
    if (!streamingChatId) return;

    if (approved) {
      setStreamingBlocks((prev) =>
        prev.map((block) =>
          block.type === "tool" && block.toolCall.id === toolCallId
            ? { ...block, toolCall: { ...block.toolCall, status: "approved" as const } }
            : block
        )
      );
    } else {
      setStreamingBlocks((prev) =>
        prev.map((block) =>
          block.type === "tool" && block.toolCall.id === toolCallId
            ? { ...block, toolCall: { ...block.toolCall, status: "rejected" as const } }
            : block
        )
      );
    }

    confirmChatTool(streamingChatId, toolCallId, approved).catch((error) => {
      setChatError(formatError(error, "工具确认失败"));
    });
  }

  function handleStartEditMessage(messageId: string, content: string) {
    setEditingMessageId(messageId);
    setChatDraft(content);
    setChatFile(null);
  }

  function handleCancelEditMessage() {
    setEditingMessageId(null);
    setChatDraft("");
  }

  async function handleDeleteChatSession(chatSession: ChatSessionSummary) {
    const confirmed = await confirm(`确认删除聊天「${chatSession.title}」？`, { danger: true });

    if (!confirmed) {
      return;
    }

    setDeletingChatId(chatSession.id);
    setChatError(null);

    try {
      await deleteChatSession(chatSession.id);
      const remaining = chatSessions.filter((session) => session.id !== chatSession.id);
      const nextChatId = selectedChatId === chatSession.id ? remaining[0]?.id ?? null : selectedChatId;
      await reloadChatSessions(nextChatId);
    } catch (error) {
      setChatError(formatError(error, "聊天删除失败"));
    } finally {
      setDeletingChatId(null);
    }
  }

  function openSessionModal(source: SessionSource, todoId?: string, sessionId?: string) {
    setSessionLaunchSource(source);
    setSessionsError(null);

    if (sessionId) {
      const session = sessions.find((item) => item.id === sessionId) ?? null;
      setSelectedExecution({ kind: "session", id: sessionId });
      setSelectedSessionId(sessionId);
      setSelectedPromptDraftId(session?.promptDraftId ?? null);
      if (session) {
        setSessionDraft(sessionToDraft(session, promptDrafts));
      }
      setSessionCreateModalOpen(false);
      setExecutionModalMode("session");
      return;
    }

    const nextDraft = buildSessionDraft({
      source,
      todo: todoId ? todos.find((todo) => todo.id === todoId) ?? null : null,
      selectedWorktree
    });

    setSelectedExecution(null);
    setSelectedSessionId(null);
    setSelectedPromptDraftId(null);
    setSessionDraft(nextDraft);
    setExecutionModalMode(null);
    setSessionCreateModalOpen(true);
  }

  async function handleOpenExecution(execution: ExecutionListItem) {
    setSelectedExecution({ kind: execution.kind, id: execution.id });
    setSessionCreateModalOpen(false);
    setSessionsError(null);

    if (execution.kind === "workspace-terminal") {
      setWorkspaceTerminalError(null);
      try {
        const data = await getWorkspaceTerminal(execution.id);
        setWorkspaceTerminal({
          id: execution.id,
          projectId: execution.projectId,
          worktreeId: execution.worktreeId,
          requestedWorktreeName: execution.requestedWorktreeName,
          runtimeStatus: data.runtimeStatus ?? execution.runtimeStatus ?? "stopped",
          pid: execution.pid,
          cwd: data.cwd ?? execution.cwd ?? "",
          createdAt: execution.createdAt,
          updatedAt: execution.updatedAt
        });
        setWorkspaceTerminalContext({
          projectId: execution.projectId,
          projectName: execution.projectName,
          worktreeId: execution.worktreeId,
          worktreeName: execution.requestedWorktreeName,
          requestedWorktreeName: execution.requestedWorktreeName
        });
        setExecutionModalMode("workspace-terminal");
      } catch (error) {
        setWorkspaceTerminalError(formatError(error, "终端加载失败"));
      }
      return;
    }

    if (execution.projectId && execution.projectId !== selectedProjectId) {
      setSelectedProjectId(execution.projectId);
    }
    setSelectedSessionId(execution.id);
    setExecutionModalMode("session");
  }

  function openSessionViewer() {
    setSessionCreateModalOpen(false);
    setSessionsError(null);

    const nextExecution =
      (selectedExecution ? executionItems.find((item) => item.kind === selectedExecution.kind && item.id === selectedExecution.id) : null) ??
      executionItems[0] ??
      null;

    if (!nextExecution) {
      setExecutionModalMode("session");
      return;
    }

    void handleOpenExecution(nextExecution);
  }

  async function handlePreviewPromptDraft() {
    if (!selectedProject) {
      return;
    }

    setPreviewingPromptDraft(true);
    setSessionsError(null);

    try {
      const data = await previewPromptDraft(selectedProject.id, {
        todoId: sessionDraft.todoId || null,
        worktreeId: sessionDraft.worktreeId || null,
        requestedWorktreeName: sessionDraft.requestedWorktreeName || null,
        source: sessionLaunchSource,
        title: sessionDraft.promptTitle || null
      });

      setSessionDraft((current) => ({
        ...current,
        promptTitle: data.title,
        prompt: data.prompt,
        todoId: data.todoId ?? current.todoId,
        worktreeId: data.worktreeId ?? current.worktreeId,
        requestedWorktreeName: data.requestedWorktreeName ?? current.requestedWorktreeName
      }));
    } catch (error) {
      setSessionsError(formatError(error, "Prompt 草稿生成失败"));
    } finally {
      setPreviewingPromptDraft(false);
    }
  }

  async function handleSavePromptDraft() {
    if (!selectedProject) {
      return;
    }

    setSavingPromptDraft(true);
    setSessionsError(null);

    try {
      const request = sessionDraftToPromptDraftRequest(sessionDraft, sessionLaunchSource);
      const data = sessionDraft.promptDraftId
        ? await updatePromptDraft(selectedProject.id, sessionDraft.promptDraftId, request)
        : await createPromptDraft(selectedProject.id, request);

      setSelectedPromptDraftId(data.promptDraft.id);
      setSessionDraft((current) => ({
        ...current,
        promptDraftId: data.promptDraft.id,
        promptTitle: data.promptDraft.title,
        prompt: data.promptDraft.prompt,
        todoId: data.promptDraft.todoId ?? "",
        worktreeId: data.promptDraft.worktreeId ?? "",
        requestedWorktreeName: data.promptDraft.requestedWorktreeName ?? ""
      }));
      await reloadPromptDrafts(selectedProject.id, data.promptDraft.id);
    } catch (error) {
      setSessionsError(formatError(error, "Prompt 草稿保存失败"));
    } finally {
      setSavingPromptDraft(false);
    }
  }

  async function handleCreateSessionRecord() {
    if (!selectedProject) {
      return;
    }

    setCreatingSession(true);
    setSessionsError(null);

    try {
      const data = await createSession(selectedProject.id, sessionDraftToCreateSessionRequest(sessionDraft, sessionLaunchSource));
      setSelectedExecution({ kind: "session", id: data.session.id });
      setSelectedSessionId(data.session.id);
      setSelectedPromptDraftId(data.session.promptDraftId ?? null);
      setSessionDraft(sessionToDraft(data.session, promptDrafts));
      await Promise.all([
        reloadSessions(selectedProject.id, data.session.id),
        reloadExecutions({ kind: "session", id: data.session.id }),
        reloadWorktrees(selectedProject.id, data.session.worktreeId ?? selectedWorktreeId),
        data.session.todoId ? projectTodosList.refresh(data.session.todoId) : Promise.resolve(),
        sessionDraft.promptDraftId ? reloadPromptDrafts(selectedProject.id, sessionDraft.promptDraftId) : Promise.resolve()
      ]);
      setSessionCreateModalOpen(false);
      setExecutionModalMode("session");
    } catch (error) {
      setSessionsError(formatError(error, "会话启动失败"));
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleStopSession(session: SessionSummary | Extract<ExecutionListItem, { kind: "session" }>) {
    const targetProjectId = session.projectId;

    if (!targetProjectId) {
      return;
    }

    setUpdatingSessionId(session.id);
    setSessionsError(null);

    try {
      await stopSession(targetProjectId, session.id);
      await Promise.all([
        reloadExecutions({ kind: "session", id: session.id }),
        selectedProjectId === targetProjectId ? reloadSessions(targetProjectId, session.id) : Promise.resolve()
      ]);
    } catch (error) {
      setSessionsError(formatError(error, "会话停止失败"));
    } finally {
      setUpdatingSessionId(null);
    }
  }

  async function handleSessionRuntimeEvent(event: SessionStreamEvent) {
    if (!selectedProject || event.sessionId !== selectedSessionId) {
      return;
    }

    if (event.type === "session.output") {
      return;
    }

    await Promise.all([
      reloadSessions(selectedProject.id, event.sessionId),
      reloadExecutions({ kind: "session", id: event.sessionId })
    ]);
  }

  async function handleRenameSession(session: SessionSummary | Extract<ExecutionListItem, { kind: "session" }>) {
    const targetProjectId = session.projectId;

    if (!targetProjectId) {
      return;
    }

    const nextName = await prompt("请输入新的会话名称", { defaultValue: session.name });

    if (!nextName || nextName.trim() === session.name) {
      return;
    }

    setRenamingSessionId(session.id);
    setSessionsError(null);

    try {
      const data = await updateSession(targetProjectId, session.id, { name: nextName.trim() });
      await Promise.all([
        reloadExecutions({ kind: "session", id: data.session.id }),
        selectedProjectId === targetProjectId ? reloadSessions(targetProjectId, data.session.id) : Promise.resolve()
      ]);
    } catch (error) {
      setSessionsError(formatError(error, "会话重命名失败"));
    } finally {
      setRenamingSessionId(null);
    }
  }

  async function handleDeleteSession(session: SessionSummary | Extract<ExecutionListItem, { kind: "session" }>) {
    const targetProjectId = session.projectId;

    if (!targetProjectId) {
      return;
    }

    const confirmed = await confirm(`确认删除会话「${session.name}」？`, { danger: true });

    if (!confirmed) {
      return;
    }

    setDeletingSessionId(session.id);
    setSessionsError(null);

    try {
      await deleteSession(targetProjectId, session.id);

      const remainingSessions = sessions.filter((item) => item.id !== session.id);
      const nextSessionId = selectedSessionId === session.id ? remainingSessions[0]?.id ?? null : selectedSessionId;
      const nextExecution = nextSessionId ? { kind: "session" as const, id: nextSessionId } : null;
      await Promise.all([
        reloadExecutions(nextExecution),
        selectedProjectId === targetProjectId ? reloadSessions(targetProjectId, nextSessionId) : Promise.resolve()
      ]);

      if (selectedSessionId === session.id) {
        setSelectedPromptDraftId(null);
        setSelectedExecution(nextExecution);

        if (!nextSessionId) {
          setSessionDraft(emptySessionEditorDraft());
          setExecutionModalMode(null);
        }
      }
    } catch (error) {
      setSessionsError(formatError(error, "会话删除失败"));
    } finally {
      setDeletingSessionId(null);
    }
  }

  async function handleContinueSession(session: SessionSummary | Extract<ExecutionListItem, { kind: "session" }>) {
    const targetProjectId = session.projectId;

    if (!targetProjectId) {
      return;
    }

    setContinuingSessionId(session.id);
    setSessionsError(null);

    try {
      const data = await continueSession(targetProjectId, session.id);
      setSelectedExecution({ kind: "session", id: data.session.id });
      setSelectedSessionId(data.session.id);
      if (selectedProjectId !== targetProjectId) {
        setSelectedProjectId(targetProjectId);
      }
      await Promise.all([
        reloadExecutions({ kind: "session", id: data.session.id }),
        reloadSessions(targetProjectId, data.session.id)
      ]);
    } catch (error) {
      setSessionsError(formatError(error, "会话继续失败"));
    } finally {
      setContinuingSessionId(null);
    }
  }

  async function handleOpenWorkspaceTerminal(context?: WorkspaceTerminalContext | null, options?: WorkspaceTerminalOpenOptions) {
    const nextContext: WorkspaceTerminalContext = context ?? {
      projectId: selectedProject?.id ?? null,
      projectName: selectedProject?.name ?? null,
      worktreeId: selectedWorktree?.id ?? null,
      worktreeName: selectedWorktree?.name ?? null,
      requestedWorktreeName: null
    };

    const shouldReuseWorkspaceTerminal =
      options?.forceCreate !== true &&
      workspaceTerminal !== null &&
      workspaceTerminal.projectId === nextContext.projectId &&
      workspaceTerminal.worktreeId === nextContext.worktreeId &&
      workspaceTerminal.requestedWorktreeName === nextContext.requestedWorktreeName &&
      (workspaceTerminal.runtimeStatus === "starting" || workspaceTerminal.runtimeStatus === "running" || workspaceTerminal.runtimeStatus === "stopping");

    if (shouldReuseWorkspaceTerminal) {
      setWorkspaceTerminalError(null);
      setWorkspaceTerminalContext(nextContext);
      if (workspaceTerminal) {
        setSelectedExecution({ kind: "workspace-terminal", id: workspaceTerminal.id });
      }
      setExecutionModalMode("workspace-terminal");
      return;
    }

    setOpeningWorkspaceTerminal(true);
    setWorkspaceTerminalError(null);

    try {
      const data = await createWorkspaceTerminal({
        projectId: nextContext.projectId,
        worktreeId: nextContext.worktreeId,
        requestedWorktreeName: nextContext.requestedWorktreeName
      });
      setWorkspaceTerminal(data.terminal);
      setWorkspaceTerminalContext(nextContext);
      setSelectedExecution({ kind: "workspace-terminal", id: data.terminal.id });
      await reloadExecutions({ kind: "workspace-terminal", id: data.terminal.id });
      setExecutionModalMode("workspace-terminal");
    } catch (error) {
      setWorkspaceTerminalError(formatError(error, "终端打开失败"));
    } finally {
      setOpeningWorkspaceTerminal(false);
    }
  }


  async function handleStopWorkspaceTerminal() {
    if (!workspaceTerminal) {
      return;
    }

    setStoppingWorkspaceTerminal(true);
    setWorkspaceTerminalError(null);

    try {
      const data = await stopWorkspaceTerminal(workspaceTerminal.id);
      setWorkspaceTerminal(data.terminal);
      await reloadExecutions({ kind: "workspace-terminal", id: data.terminal.id });
    } catch (error) {
      setWorkspaceTerminalError(formatError(error, "终端停止失败"));
    } finally {
      setStoppingWorkspaceTerminal(false);
    }
  }

  async function handleDeleteWorkspaceTerminal(execution: Extract<ExecutionListItem, { kind: "workspace-terminal" }>) {
    const confirmed = await confirm(`确认删除终端「${execution.name}」？`, { danger: true });

    if (!confirmed) {
      return;
    }

    setDeletingWorkspaceTerminalId(execution.id);
    setWorkspaceTerminalError(null);
    setSessionsError(null);

    try {
      await deleteWorkspaceTerminal(execution.id);

      const deletingSelectedExecution = selectedExecution?.kind === execution.kind && selectedExecution.id === execution.id;
      const remainingExecutions = executionItems.filter((item) => !(item.kind === execution.kind && item.id === execution.id));
      const nextExecution = deletingSelectedExecution
        ? remainingExecutions[0] ?? null
        : executionItems.find((item) => item.kind === selectedExecution?.kind && item.id === selectedExecution?.id) ?? remainingExecutions[0] ?? null;

      await reloadExecutions(nextExecution ? { kind: nextExecution.kind, id: nextExecution.id } : null);

      if (!deletingSelectedExecution) {
        return;
      }

      setWorkspaceTerminal(null);
      setWorkspaceTerminalContext(null);

      if (!nextExecution) {
        setSelectedExecution(null);
        setExecutionModalMode(null);
        return;
      }

      await handleOpenExecution(nextExecution);
    } catch (error) {
      setWorkspaceTerminalError(formatError(error, "终端删除失败"));
    } finally {
      setDeletingWorkspaceTerminalId(null);
    }
  }

  function handleWorkspaceTerminalRuntimeEvent(event: WorkspaceTerminalStreamEvent) {
    if (!workspaceTerminal || event.terminalId !== workspaceTerminal.id) {
      return;
    }

    if (event.type === "terminal.output") {
      return;
    }

    setWorkspaceTerminal((current) => {
      if (!current || current.id !== event.terminalId) {
        return current;
      }

      return {
        ...current,
        runtimeStatus: event.runtimeStatus ?? current.runtimeStatus,
        pid: event.pid === undefined ? current.pid : event.pid,
        cwd: event.cwd ?? current.cwd,
        updatedAt: new Date().toISOString()
      };
    });
    void reloadExecutions({ kind: "workspace-terminal", id: event.terminalId });
  }

  return (
    <div className="flex h-full flex-col bg-[#0b0c10] text-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#111318] px-4 py-3 sm:px-5">
        <div className="mr-1 min-w-44">
          <div className="text-sm font-semibold tracking-wide">Workhorse Station</div>
          <div className="text-xs text-slate-400">全局工作台 / 项目执行上下文</div>
        </div>

        <TopModeNav
          value={workspaceScope === "home" ? activeHomeMode : null}
          modes={topModes}
          onChange={(mode) => {
            setProjectMenuOpen(false);
            setWorkspaceScope("home");
            setActiveHomeMode(mode);
          }}
        />

        <ProjectMenu
          open={projectMenuOpen}
          projects={projects}
          selectedProject={selectedProject}
          loading={projectsLoading}
          onToggle={() => setProjectMenuOpen((current) => !current)}
          onEnter={(project) => selectProject(project)}
          onCreate={() => {
            setProjectMenuOpen(false);
            startCreateProject();
          }}
        />

        <input
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-slate-400 max-md:hidden"
          placeholder="搜索项目、笔记、任务、Skill"
        />
        <button
          onClick={openSessionViewer}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          会话
        </button>
        <StatusPill connected={apiConnected} loading={apiState.loading} />
      </header>

      <main className={workspaceScope === "home" && activeHomeMode === "chat" ? "min-h-0 flex-1 overflow-hidden bg-[#0f1117]" : "min-h-0 flex-1 overflow-auto bg-[#0f1117] p-4 sm:p-5"}>
        {workspaceScope === "home" ? (
          <HomeWorkspace
            activeMode={activeHomeMode}
            activeModeInfo={homeMode}
            featureCards={featureCards}
            selectedProject={selectedProject}
            selectedWorktree={selectedWorktree}
            apiConnected={apiConnected}
            apiError={apiState.error}
            databaseInfo={databaseInfo}
            globalNotes={globalNotes}
            selectedGlobalNote={selectedGlobalNote}
            globalNotesLoading={globalNotesLoading}
            globalNotesError={globalNotesError}
            globalNoteDraft={globalNoteDraft}
            savingGlobalNote={savingGlobalNote}
            deletingGlobalNoteId={deletingGlobalNoteId}
            globalNoteSettingsOpen={globalNoteSettingsOpen}
            globalSkills={globalSkills}
            globalSkillsLoading={globalSkillsLoading}
            globalSkillsError={globalSkillsError}
            projectSkills={projectSkills}
            skillOperationName={skillOperationName}
            chatSessions={chatSessions}
            selectedChat={selectedChat}
            chatDraft={chatDraft}
            chatFile={chatFile}
            chatLoading={chatLoading}
            chatError={chatError}
            creatingChat={creatingChat}
            sendingChat={sendingChat}
            deletingChatId={deletingChatId}
            onChatSelect={(session) => { streamAbortRef.current?.(); setStreamingChatId(null); setSelectedChatId(session.id); }}
            onCreateChat={() => void createChatSessionRecord()}
            onChatDraftChange={setChatDraft}
            onChatFileChange={(file) => void handleChatFileChange(file)}
            onChatSubmit={(event) => void handleSendChatMessage(event)}
            onDeleteChat={handleDeleteChatSession}
            onConfirmTool={handleConfirmTool}
            editingMessageId={editingMessageId}
            onStartEditMessage={handleStartEditMessage}
            onCancelEditMessage={handleCancelEditMessage}
            streamingChatId={streamingChatId}
            streamingBlocks={streamingBlocks}
            onCreateGlobalNote={startCreateGlobalNote}
            onSelectGlobalNote={(note) => setSelectedGlobalNoteId(note.id)}
            onGlobalNoteDraftChange={updateGlobalNoteDraft}
            onSaveGlobalNote={handleGlobalNoteSave}
            onDeleteGlobalNote={handleGlobalNoteDelete}
            onOpenGlobalNoteSettings={() => setGlobalNoteSettingsOpen(true)}
            onCloseGlobalNoteSettings={() => setGlobalNoteSettingsOpen(false)}
            onCreateGlobalSkill={handleCreateGlobalSkill}
            onRenameGlobalSkill={handleRenameGlobalSkill}
            onDeleteGlobalSkill={handleDeleteGlobalSkill}
            onCopyGlobalSkillToProject={handleCopyGlobalSkillToProject}
            onEditGlobalSkillDocument={handleEditGlobalSkillDocument}
            storeSkills={storeSkills}
            storeSkillsLoading={storeSkillsLoading}
            storeSkillsError={storeSkillsError}
            storeSkillOperationName={storeSkillOperationName}
            onCreateStoreSkill={handleCreateStoreSkill}
            onRenameStoreSkill={handleRenameStoreSkill}
            onDeleteStoreSkill={handleDeleteStoreSkill}
            onInstallStoreSkill={handleInstallStoreSkill}
            onEditStoreSkillDocument={handleEditStoreSkillDocument}
            chatSkills={chatSkills}
            chatSkillsLoading={chatSkillsLoading}
            chatSkillsError={chatSkillsError}
            deletingChatSkillName={deletingChatSkillName}
            onDeleteChatSkill={handleDeleteChatSkill}
            projects={projects}
            recentProjects={recentProjects}
            runningSessions={runningSessions}
            onEnterProject={(projectId) => {
              if (projectId) {
                const project = projects.find((p) => p.id === projectId);
                if (project) {
                  selectProject(project);
                  return;
                }
              }
              setWorkspaceScope("project");
            }}
            onCreateProject={startCreateProject}
            onCreateSession={() => openSessionModal("direct")}
            onOpenWorkspaceTerminal={() => void handleOpenWorkspaceTerminal()}
            onOpenExecution={handleOpenExecution}
            globalNoteSearchQuery={globalNoteSearchQuery}
            globalNoteFilterTags={globalNoteFilterTags}
            availableGlobalNoteTags={availableGlobalNoteTags}
            onGlobalNoteSearchChange={setGlobalNoteSearchQuery}
            onGlobalNoteFilterTagsChange={setGlobalNoteFilterTags}
            globalNotesTotal={globalNotesTotal}
            globalNotesPage={globalNotesPage}
            onGlobalNotesPageChange={setGlobalNotesPage}
            onRefreshGlobalSkills={reloadGlobalSkills}
            onRefreshStoreSkills={reloadStoreSkills}
            onRefreshChatSkills={reloadChatSkills}
          />
        ) : (
          <ProjectWorkspacePage
            activeTab={activeProjectTab}
            onTabChange={setActiveProjectTab}
            projects={projects}
            selectedProject={selectedProject}
            selectedWorktree={selectedWorktree}
            worktrees={worktrees}
            projectsLoading={projectsLoading}
            worktreesLoading={worktreesLoading}
            deletingProject={deletingProject}
            deletingWorktreeId={deletingWorktreeId}
            projectError={projectError}
            worktreeError={worktreeError}
            notes={notes}
            notesTotal={notesTotal}
            notesPage={notesPage}
            selectedNote={selectedNote}
            notesLoading={notesLoading}
            notesError={notesError}
            noteDraft={noteDraft}
            savingNote={savingNote}
            deletingNoteId={deletingNoteId}
            noteSettingsOpen={noteSettingsOpen}
            todos={todos}
            todosTotal={todosTotal}
            todosPage={todosPage}
            selectedTodo={selectedTodo}
            todosLoading={todosLoading}
            todosError={todosError}
            todoDraft={todoDraft}
            savingTodo={savingTodo}
            deletingTodoId={deletingTodoId}
            sessions={sessions}
            promptDrafts={promptDrafts}
            sessionsLoading={sessionsLoading}
            sessionsError={sessionsError}
            projectSkills={projectSkills}
            selectedProjectSkillName={selectedProjectSkillName}
            projectSkillsLoading={projectSkillsLoading}
            projectSkillsError={projectSkillsError}
            skillOperationName={skillOperationName}
            onCreateProject={startCreateProject}
            onEditProject={startEditProject}
            onSelectProject={selectProject}
            onDeleteProject={handleProjectDelete}
            onCreateWorktree={openWorktreeDialog}
            onWorktreeSelect={(worktree) => setSelectedWorktreeId(worktree.id)}
            onWorktreeDelete={handleWorktreeDelete}
            onCreateNote={startCreateNote}
            onSelectNote={(note) => setSelectedNoteId(note.id)}
            onNoteDraftChange={updateNoteDraft}
            onSaveNote={handleNoteSave}
            onDeleteNote={handleNoteDelete}
            onOpenNoteSettings={() => setNoteSettingsOpen(true)}
            onCloseNoteSettings={() => setNoteSettingsOpen(false)}
            onCreateTodoFromNote={handleCreateTodoFromNote}
            onCreateTodo={startCreateTodo}
            onSelectTodo={(todo) => setSelectedTodoId(todo.id)}
            onTodoDraftChange={updateTodoDraft}
            onSaveTodo={handleTodoSave}
            onDeleteTodo={handleTodoDelete}
            onSelectProjectSkill={(skill) => setSelectedProjectSkillName(skill.name)}
            onCreateProjectSkill={handleCreateProjectSkill}
            onRenameProjectSkill={handleRenameProjectSkill}
            onDeleteProjectSkill={handleDeleteProjectSkill}
            onCopyProjectSkillToGlobal={handleCopyProjectSkillToGlobal}
            onAddProjectSkillToStore={handleAddProjectSkillToStore}
            onEditProjectSkillDocument={handleEditProjectSkillDocument}
            onOpenSession={openSessionModal}
            onOpenWorkspaceTerminal={() =>
              void handleOpenWorkspaceTerminal({
                projectId: selectedProject?.id ?? null,
                projectName: selectedProject?.name ?? null,
                worktreeId: selectedWorktree?.id ?? null,
                worktreeName: selectedWorktree?.name ?? null,
                requestedWorktreeName: null
              }, { forceCreate: true })
            }
            noteSearchQuery={noteSearchQuery}
            noteFilterTags={noteFilterTags}
            availableNoteTags={availableNoteTags}
            onNoteSearchChange={setNoteSearchQuery}
            onNoteFilterTagsChange={setNoteFilterTags}
            onNotesPageChange={setNotesPage}
            onTodosPageChange={setTodosPage}
            todoSearchQuery={todoSearchQuery}
            todoFilterTags={todoFilterTags}
            todoStatuses={todoStatuses}
            availableTodoTags={availableTodoTags}
            onTodoSearchChange={setTodoSearchQuery}
            onTodoFilterTagsChange={setTodoFilterTags}
            onTodoStatusesChange={setTodoStatuses}
            onTodoStatusChange={handleTodoStatusChange}
            onRefreshWorktrees={() => selectedProject && reloadWorktrees(selectedProject.id, null)}
            onRefreshProjectSkills={() => selectedProject && reloadProjectSkills(selectedProject.id, null)}
          />
        )}
      </main>


      {skillDocumentEditor.open ? (
        <Modal title={skillDocumentEditor.title} description={skillDocumentEditor.scopeLabel} onClose={closeSkillDocumentEditor}>
          <div className="space-y-4">
            {skillDocumentError ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{skillDocumentError}</p> : null}
            {skillDocumentLoading ? (
              <div className="rounded-lg border border-white/10 p-4 text-sm text-slate-400">文档加载中...</div>
            ) : (
              <textarea
                value={skillDocumentContent}
                onChange={(e) => setSkillDocumentContent(e.target.value)}
                rows={18}
                className="w-full resize-y rounded-lg border border-white/10 bg-[#0b0c10] p-3 font-mono text-sm text-slate-100 outline-none focus:border-white/20"
              />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeSkillDocumentEditor} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                取消
              </button>
              <button type="button" disabled={skillDocumentLoading || skillDocumentSaving} onClick={() => void handleSaveSkillDocument()} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
                {skillDocumentSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {projectDialogOpen ? (
        <ProjectFormModal
          mode={projectMode}
          draft={projectDraft}
          saving={savingProject}
          error={projectError}
          onChange={updateProjectDraft}
          onSubmit={handleProjectSubmit}
          onClose={() => setProjectDialogOpen(false)}
        />
      ) : null}

      {skillTransferTarget ? (
        <SkillTransferModal
          target={skillTransferTarget}
          projects={projects}
          selectedProjectId={skillTransferProjectId}
          mode={skillTransferMode}
          error={skillTransferError}
          onProjectChange={setSkillTransferProjectId}
          onModeChange={setSkillTransferMode}
          onSubmit={() => void submitSkillTransfer()}
          onClose={closeSkillTransfer}
        />
      ) : null}

      {worktreeDialogOpen && selectedProject ? (
        <WorktreeCreateModal
          project={selectedProject}
          draft={worktreeDraft}
          saving={savingWorktree}
          error={worktreeError}
          onChange={updateWorktreeDraft}
          onSubmit={handleWorktreeSubmit}
          onClose={() => setWorktreeDialogOpen(false)}
        />
      ) : null}

      {sessionCreateModalOpen ? (
        <CreateSessionModal
          todos={todos}
          worktrees={worktrees}
          sessions={sessions}
          selectedProject={selectedProject}
          selectedWorktree={selectedWorktree}
          source={sessionLaunchSource}
          draft={sessionDraft}
          error={sessionsError}
          loading={sessionsLoading}
          previewingPrompt={previewingPromptDraft}
          savingPromptDraft={savingPromptDraft}
          creatingSession={creatingSession}
          onDraftChange={updateSessionDraft}
          onPreviewPrompt={handlePreviewPromptDraft}
          onSavePromptDraft={handleSavePromptDraft}
          onCreateSession={handleCreateSessionRecord}
          onClose={() => setSessionCreateModalOpen(false)}
        />
      ) : null}

      {executionModalMode ? (
        <SessionModalPanel
          executionItems={executionItems}
          selectedExecution={selectedExecution ? executionItems.find((item) => item.kind === selectedExecution.kind && item.id === selectedExecution.id) ?? null : null}
          sessions={sessions}
          selectedSession={selectedSession}
          selectedProject={selectedProject}
          projects={projects}
          todos={todos}
          worktrees={worktrees}
          workspaceTerminal={workspaceTerminal}
          workspaceTerminalError={workspaceTerminalError}
          openingWorkspaceTerminal={openingWorkspaceTerminal}
          stoppingWorkspaceTerminal={stoppingWorkspaceTerminal}
          draft={sessionDraft}
          error={sessionsError}
          loading={sessionsLoading}
          updatingSessionId={updatingSessionId}
          renamingSessionId={renamingSessionId}
          deletingSessionId={deletingSessionId}
          deletingWorkspaceTerminalId={deletingWorkspaceTerminalId}
          continuingSessionId={continuingSessionId}
          onSelectExecution={(execution) => void handleOpenExecution(execution)}
          onRenameSession={handleRenameSession}
          onStopSession={handleStopSession}
          onDeleteSession={handleDeleteSession}
          onDeleteWorkspaceTerminal={(execution) => void handleDeleteWorkspaceTerminal(execution)}
          onContinueSession={handleContinueSession}
          onRuntimeEvent={handleSessionRuntimeEvent}
          onRestartWorkspaceTerminal={() => void handleOpenWorkspaceTerminal(workspaceTerminalContext)}
          onStopWorkspaceTerminal={() => void handleStopWorkspaceTerminal()}
          onWorkspaceTerminalRuntimeEvent={handleWorkspaceTerminalRuntimeEvent}
          onClose={() => setExecutionModalMode(null)}
        />
      ) : null}
    </div>
  );
}

function TopModeNav({
  value,
  modes,
  onChange
}: {
  value: HomeMode | null;
  modes: Array<{ id: HomeMode; label: string; description: string }>;
  onChange: (value: HomeMode) => void;
}) {
  return (
    <nav className="flex rounded-lg border border-white/10 bg-black/20 p-1">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          className={`rounded-md px-3 py-1.5 text-sm ${value === mode.id ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}
        >
          {mode.label}
        </button>
      ))}
    </nav>
  );
}

function ProjectMenu({
  open,
  projects,
  selectedProject,
  loading,
  onToggle,
  onEnter,
  onCreate
}: {
  open: boolean;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  loading: boolean;
  onToggle: () => void;
  onEnter: (project: ProjectSummary) => void;
  onCreate: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onToggle]);

  return (
    <div ref={containerRef} className="relative">
      <button onClick={onToggle} className="min-w-44 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10">
        <span className="block truncate">项目：{selectedProject?.name ?? "未选择"}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#151821] shadow-2xl">
          <div className="border-b border-white/10 px-3 py-2 text-xs text-slate-500">项目列表</div>
          <div className="max-h-80 overflow-auto p-2">
            {loading ? <div className="px-3 py-3 text-sm text-slate-400">项目加载中...</div> : null}
            {!loading && projects.length === 0 ? <div className="px-3 py-3 text-sm text-slate-500">还没有项目。</div> : null}
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onEnter(project)}
                className={`w-full rounded-lg p-2 text-left ${selectedProject?.id === project.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
              >
                <div className="truncate text-sm text-slate-100">{project.name}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{project.path}</div>
              </button>
            ))}
          </div>
          <button onClick={onCreate} className="block w-full border-t border-white/10 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5">
            添加项目
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HomeWorkspace({
  activeMode,
  activeModeInfo,
  featureCards,
  selectedProject,
  selectedWorktree,
  apiConnected,
  apiError,
  databaseInfo,
  globalNotes,
  selectedGlobalNote,
  globalNotesLoading,
  globalNotesError,
  globalNoteDraft,
  savingGlobalNote,
  deletingGlobalNoteId,
  globalNoteSettingsOpen,
  globalSkills,
  globalSkillsLoading,
  globalSkillsError,
  projectSkills,
  skillOperationName,
  chatSessions,
  selectedChat,
  chatDraft,
  chatFile,
  chatLoading,
  chatError,
  creatingChat,
  sendingChat,
  deletingChatId,
  onChatSelect,
  onCreateChat,
  onChatDraftChange,
  onChatFileChange,
  onChatSubmit,
  onDeleteChat,
  onConfirmTool,
  editingMessageId,
  onStartEditMessage,
  onCancelEditMessage,
  streamingChatId,
  streamingBlocks,
  onCreateGlobalNote,
  onSelectGlobalNote,
  onGlobalNoteDraftChange,
  onSaveGlobalNote,
  onDeleteGlobalNote,
  onOpenGlobalNoteSettings,
  onCloseGlobalNoteSettings,
  onCreateGlobalSkill,
  onRenameGlobalSkill,
  onDeleteGlobalSkill,
  onCopyGlobalSkillToProject,
  onEditGlobalSkillDocument,
  storeSkills,
  storeSkillsLoading,
  storeSkillsError,
  storeSkillOperationName,
  onCreateStoreSkill,
  onRenameStoreSkill,
  onDeleteStoreSkill,
  onInstallStoreSkill,
  onEditStoreSkillDocument,
  chatSkills,
  chatSkillsLoading,
  chatSkillsError,
  deletingChatSkillName,
  onDeleteChatSkill,
  onEnterProject,
  onCreateProject,
  onCreateSession,
  onOpenWorkspaceTerminal,
  onOpenExecution,
  projects,
  recentProjects,
  runningSessions,
  globalNoteSearchQuery = "",
  globalNoteFilterTags = [],
  availableGlobalNoteTags = [],
  onGlobalNoteSearchChange,
  onGlobalNoteFilterTagsChange,
  globalNotesTotal = 0,
  globalNotesPage = 1,
  onGlobalNotesPageChange,
  onRefreshGlobalSkills,
  onRefreshStoreSkills,
  onRefreshChatSkills
}: {
  activeMode: HomeMode;
  activeModeInfo: { label: string; description: string };
  featureCards: Array<{ title: string; value: string; detail: string }>;
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  apiConnected: boolean;
  apiError: string | null;
  databaseInfo: MetaResponse["database"] | null;
  globalNotes: NoteSummary[];
  selectedGlobalNote: NoteSummary | null;
  globalNotesLoading: boolean;
  globalNotesError: string | null;
  globalNoteDraft: NoteDraft;
  savingGlobalNote: boolean;
  deletingGlobalNoteId: string | null;
  globalNoteSettingsOpen: boolean;
  globalSkills: SkillSummary[];
  globalSkillsLoading: boolean;
  globalSkillsError: string | null;
  projectSkills: ProjectSkillSummary[];
  skillOperationName: string | null;
  chatSessions: ChatSessionSummary[];
  selectedChat: ChatSessionSummary | null;
  chatDraft: string;
  chatFile: ChatFileDraft | null;
  chatLoading: boolean;
  chatError: string | null;
  creatingChat: boolean;
  sendingChat: boolean;
  deletingChatId: string | null;
  onChatSelect: (session: ChatSessionSummary) => void;
  onCreateChat: () => void;
  onChatDraftChange: (value: string) => void;
  onChatFileChange: (file: File | null) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteChat: (chat: ChatSessionSummary) => void;
  onConfirmTool: (toolCallId: string, approved: boolean) => void;
  editingMessageId: string | null;
  onStartEditMessage: (messageId: string, content: string) => void;
  onCancelEditMessage: () => void;
  streamingChatId: string | null;
  streamingBlocks: StreamingBlock[];
  onCreateGlobalNote: () => void;
  onSelectGlobalNote: (note: NoteSummary) => void;
  onGlobalNoteDraftChange: (field: keyof NoteDraft, value: string) => void;
  onSaveGlobalNote: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteGlobalNote: (note: NoteSummary) => void;
  onOpenGlobalNoteSettings: () => void;
  onCloseGlobalNoteSettings: () => void;
  onCreateGlobalSkill: () => void;
  onRenameGlobalSkill: (skill: SkillSummary) => void;
  onDeleteGlobalSkill: (skill: SkillSummary) => void;
  onCopyGlobalSkillToProject: (skill: SkillSummary) => void;
  onEditGlobalSkillDocument: (skill: SkillSummary) => void;
  storeSkills: StoreSkillStatus[];
  storeSkillsLoading: boolean;
  storeSkillsError: string | null;
  storeSkillOperationName: string | null;
  onCreateStoreSkill: (name: string, description: string) => void;
  onRenameStoreSkill: (skill: StoreSkillStatus) => void;
  onDeleteStoreSkill: (skill: StoreSkillStatus) => void;
  onInstallStoreSkill: (skill: StoreSkillStatus, target: "claude-code" | "chat") => void;
  onEditStoreSkillDocument: (skill: StoreSkillStatus) => void;
  chatSkills: ChatSkill[];
  chatSkillsLoading: boolean;
  chatSkillsError: string | null;
  deletingChatSkillName: string | null;
  onDeleteChatSkill: (skill: ChatSkill) => void;
  projects: ProjectSummary[];
  recentProjects: ProjectSummary[];
  runningSessions: ExecutionListItem[];
  onEnterProject: (projectId?: string) => void;
  onCreateProject: () => void;
  onCreateSession: () => void;
  onOpenWorkspaceTerminal: () => void;
  onOpenExecution: (execution: ExecutionListItem) => void;
  globalNoteSearchQuery?: string;
  globalNoteFilterTags?: string[];
  availableGlobalNoteTags?: string[];
  onGlobalNoteSearchChange?: (query: string) => void;
  onGlobalNoteFilterTagsChange?: (tags: string[]) => void;
  globalNotesTotal?: number;
  globalNotesPage?: number;
  onGlobalNotesPageChange?: (page: number) => void;
  onRefreshGlobalSkills?: () => void;
  onRefreshStoreSkills?: () => void;
  onRefreshChatSkills?: () => void;
}) {
  return (
    <div className={activeMode === "chat" ? "flex h-full w-full flex-col" : "mx-auto flex w-full max-w-7xl flex-col gap-5"}>
      {activeMode === "chat" ? (
        <HomeChatWorkspace
          selectedProject={selectedProject}
          selectedWorktree={selectedWorktree}
          chatSessions={chatSessions}
          selectedChat={selectedChat}
          draft={chatDraft}
          chatFile={chatFile}
          loading={chatLoading && !streamingChatId}
          error={chatError}
          creating={creatingChat}
          sending={sendingChat}
          deletingChatId={deletingChatId}
          streamingChatId={streamingChatId}
          streamingBlocks={streamingBlocks}
          onSelect={onChatSelect}
          onCreate={onCreateChat}
          onDraftChange={onChatDraftChange}
          onFileChange={onChatFileChange}
          onSubmit={onChatSubmit}
          onDelete={onDeleteChat}
          onConfirmTool={onConfirmTool}
          editingMessageId={editingMessageId}
          onStartEditMessage={onStartEditMessage}
          onCancelEditMessage={onCancelEditMessage}
        />
      ) : (
        <HomeOverviewWorkspace
          apiConnected={apiConnected}
          apiError={apiError}
          databaseInfo={databaseInfo}
          selectedProject={selectedProject}
          globalNotes={globalNotes}
          selectedGlobalNote={selectedGlobalNote}
          globalNotesLoading={globalNotesLoading}
          globalNotesError={globalNotesError}
          globalNoteDraft={globalNoteDraft}
          savingGlobalNote={savingGlobalNote}
          deletingGlobalNoteId={deletingGlobalNoteId}
          globalNoteSettingsOpen={globalNoteSettingsOpen}
          globalSkills={globalSkills}
          loading={globalSkillsLoading}
          error={globalSkillsError}
          projectSkills={projectSkills}
          operationName={skillOperationName}
          chatSessions={chatSessions}
          projects={projects}
          recentProjects={recentProjects}
          runningSessions={runningSessions}
          onEnterProject={onEnterProject}
          onCreateProject={onCreateProject}
          onOpenWorkspaceTerminal={onOpenWorkspaceTerminal}
          onOpenExecution={onOpenExecution}
          onSelectChat={onChatSelect}
          onCreateNote={onCreateGlobalNote}
          onSelectNote={onSelectGlobalNote}
          onNoteDraftChange={onGlobalNoteDraftChange}
          onSaveNote={onSaveGlobalNote}
          onDeleteNote={onDeleteGlobalNote}
          onOpenNoteSettings={onOpenGlobalNoteSettings}
          onCloseNoteSettings={onCloseGlobalNoteSettings}
          onCreateSkill={onCreateGlobalSkill}
          onRenameSkill={onRenameGlobalSkill}
          onDeleteSkill={onDeleteGlobalSkill}
          onCopyToProject={onCopyGlobalSkillToProject}
          onEditDocument={onEditGlobalSkillDocument}
          storeSkills={storeSkills}
          storeSkillsLoading={storeSkillsLoading}
          storeSkillsError={storeSkillsError}
          storeSkillOperationName={storeSkillOperationName}
          onCreateStoreSkill={onCreateStoreSkill}
          onRenameStoreSkill={onRenameStoreSkill}
          onDeleteStoreSkill={onDeleteStoreSkill}
          onInstallStoreSkill={onInstallStoreSkill}
          onEditStoreSkillDocument={onEditStoreSkillDocument}
          chatSkillsData={chatSkills}
          chatSkillsLoadingData={chatSkillsLoading}
          chatSkillsErrorData={chatSkillsError}
          deletingChatSkillNameData={deletingChatSkillName}
          onDeleteChatSkillData={onDeleteChatSkill}
          globalNoteSearchQuery={globalNoteSearchQuery}
          globalNoteFilterTags={globalNoteFilterTags}
          availableGlobalNoteTags={availableGlobalNoteTags}
          onGlobalNoteSearchChange={onGlobalNoteSearchChange}
          onGlobalNoteFilterTagsChange={onGlobalNoteFilterTagsChange}
          globalNotesTotal={globalNotesTotal}
          globalNotesPage={globalNotesPage}
          onGlobalNotesPageChange={onGlobalNotesPageChange}
          onRefreshGlobalSkills={onRefreshGlobalSkills}
          onRefreshStoreSkills={onRefreshStoreSkills}
          onRefreshChatSkills={onRefreshChatSkills}
        />
      )}
    </div>
  );
}

function HomeChatWorkspace({
  selectedProject,
  selectedWorktree,
  chatSessions,
  selectedChat,
  draft,
  chatFile,
  loading,
  error,
  creating,
  sending,
  deletingChatId,
  streamingChatId,
  streamingBlocks,
  editingMessageId,
  onSelect,
  onCreate,
  onDraftChange,
  onFileChange,
  onSubmit,
  onDelete,
  onConfirmTool,
  onStartEditMessage,
  onCancelEditMessage
}: {
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  chatSessions: ChatSessionSummary[];
  selectedChat: ChatSessionSummary | null;
  draft: string;
  chatFile: ChatFileDraft | null;
  loading: boolean;
  error: string | null;
  creating: boolean;
  sending: boolean;
  deletingChatId: string | null;
  streamingChatId: string | null;
  streamingBlocks: StreamingBlock[];
  editingMessageId: string | null;
  onSelect: (session: ChatSessionSummary) => void;
  onCreate: () => void;
  onDraftChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (chat: ChatSessionSummary) => void;
  onConfirmTool: (toolCallId: string, approved: boolean) => void;
  onStartEditMessage: (messageId: string, content: string) => void;
  onCancelEditMessage: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCountRef = useRef(0);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const currentCount = selectedChat?.messages.length ?? 0;
    const isNewMessage = currentCount > prevMessageCountRef.current;
    prevMessageCountRef.current = currentCount;

    // Always scroll when a new message arrives (user sent or assistant replied)
    if (isNewMessage) {
      container.scrollTop = container.scrollHeight;
      return;
    }
  }, [selectedChat?.messages]);

  useEffect(() => {
    if (!streamingBlocks.length) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // During streaming, only follow if user is near the bottom
    const threshold = 150;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > threshold) return;

    container.scrollTop = container.scrollHeight;
  }, [streamingBlocks]);

  useEffect(() => {
    if (editingMessageId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingMessageId]);

  return (
    <section className="grid h-full grid-cols-1 overflow-hidden bg-[#0f1117] lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex flex-col overflow-hidden bg-[#111318] p-3">
        <div className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-slate-100">聊天会话</div>
              <div className="mt-1 text-xs text-slate-500">不同于 Claude Code 会话</div>
            </div>
            <button onClick={onCreate} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">
              新建
            </button>
          </div>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto lg:space-y-1">
          {chatSessions.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-slate-500">还没有聊天会话</div> : null}
          {chatSessions.map((session) => (
            <div key={session.id} className={`group flex items-center rounded-xl p-3 text-sm ${selectedChat?.id === session.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
              <button
                onClick={() => onSelect(session)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate font-medium text-slate-100">{session.title}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{formatDateTime(session.updatedAt)}</div>
              </button>
              <button
                type="button"
                disabled={deletingChatId === session.id}
                onClick={() => onDelete(session)}
                className="ml-2 shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 opacity-0 hover:bg-white/5 group-hover:opacity-100 disabled:opacity-50"
              >
                {deletingChatId === session.id ? "删除中..." : "删除"}
              </button>
            </div>
          ))}
        </div>
      </aside>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
        <div className="mx-auto w-full max-w-[768px] px-4 py-3 text-xs text-slate-500">
          上下文：{selectedProject?.name ?? "未选择项目"} / {selectedWorktree?.name ?? "未选择 worktree"} · 可直接让我搜索笔记、创建任务或保存 Prompt
        </div>
        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[768px] space-y-4 p-4 sm:p-6">
            {loading ? <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-500">聊天会话加载中...</div> : null}
            {!loading && error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
            {!loading && !selectedChat ? <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">新建或选择一个聊天会话。</div> : null}
            {selectedChat?.messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`space-y-3 rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "max-w-[82%] bg-slate-100 text-slate-950" : "w-full text-slate-200"} ${message.role === "user" && !streamingChatId ? "cursor-pointer" : ""}`}
                  onDoubleClick={message.role === "user" && !streamingChatId ? () => onStartEditMessage(message.id, message.content) : undefined}
                >
                  {editingMessageId === message.id ? (
                    <div className="space-y-2">
                      <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={(event) => onDraftChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            const form = event.currentTarget.closest("form");
                            if (form) form.requestSubmit();
                          } else if (event.key === "Escape") {
                            onCancelEditMessage();
                          }
                        }}
                        className="w-full resize-none rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={onCancelEditMessage}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200"
                        >
                          取消
                        </button>
                        <span className="text-[11px] text-slate-400">Enter 发送 · Shift+Enter 换行 · Esc 取消</span>
                      </div>
                    </div>
                  ) : (
                    <MarkdownContent content={message.content} />
                  )}
                  {message.attachments.length ? (
                    <div className="space-y-2 border-t border-white/10 pt-3 text-xs text-slate-400">
                      {message.attachments.map((attachment) => (
                        <div key={`${message.id}-${attachment.name}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="truncate font-medium text-slate-200">{attachment.name}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                            <span>{attachment.mimeType}</span>
                            <span>{formatFileSize(attachment.size)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {message.toolCalls.length ? (
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      {message.toolCalls.map((tc) => {
                        const result = message.toolResults.find(tr => tr.toolCallId === tc.id);
                        const isExpanded = expandedToolCalls.has(tc.id);
                        const isLong = result && result.result.length > 80;
                        const showExpanded = result && (result.isError || !isLong || isExpanded);

                        return (
                          <div key={tc.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-300">{toolLabel(tc.name)}</span>
                              <span className="truncate font-medium text-slate-100">{formatToolSummary(tc.name, tc.input)}</span>
                            </div>
                            {result ? (
                              <div className={`mt-2 border-t pt-2 ${result.isError ? "border-red-500/20" : "border-emerald-500/10"}`}>
                                {showExpanded ? (
                                  <div className={result.isError ? "text-red-300" : "text-slate-400"}>
                                    {result.isError ? "❌ " : "✅ "}{result.result}
                                    {isLong && !result.isError ? (
                                      <button onClick={() => {
                                        setExpandedToolCalls(prev => {
                                          const next = new Set(prev);
                                          next.delete(tc.id);
                                          return next;
                                        });
                                      }} className="ml-1 text-emerald-400 hover:text-emerald-300">收起</button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="text-slate-400">
                                    {result.result.slice(0, 80)}...
                                    <button onClick={() => {
                                      setExpandedToolCalls(prev => new Set([...prev, tc.id]));
                                    }} className="ml-1 text-emerald-400 hover:text-emerald-300">展开</button>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {message.role === "user" && message.toolResults.length ? (
                    <div className="space-y-1 border-t border-white/10 pt-3">
                      {message.toolResults.map((tr) => (
                        <div key={tr.toolCallId} className={`text-xs ${tr.isError ? "text-red-300" : "text-emerald-300"}`}>
                          {tr.isError ? "❌ " : "✅ "}{tr.result}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {message.artifactSuggestions.length ? (
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      {message.artifactSuggestions.map((suggestion) => {
                        const saved = suggestion.adoption?.status === "saved";

                        return (
                          <div key={suggestion.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-slate-100">{suggestion.title}</div>
                                <div className="mt-1 text-slate-500">{suggestion.type === "note" ? "笔记草稿" : suggestion.type === "todo" ? "任务草稿" : "Prompt 草稿"}</div>
                              </div>
                              {saved ? <span className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] text-emerald-300">已保存</span> : null}
                            </div>
                            {saved ? <div className="mt-2 text-[11px] text-emerald-300">已保存到 {formatSuggestionTargetLabel(suggestion.type)}</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {streamingChatId && selectedChat?.id === streamingChatId ? (
              <div className="flex justify-start">
                <div className="w-full space-y-3 rounded-2xl px-4 py-3 text-sm text-slate-200">
                  {streamingBlocks.length === 0 ? (
                    <div className="text-slate-500">...</div>
                  ) : (
                    streamingBlocks.map((block, idx) => {
                      if (block.type === "text") {
                        return <MarkdownContent key={`text-${idx}`} content={block.text} />;
                      }
                      const tc = block.toolCall;
                      const result = block.result;
                      const isExecuted = tc.status === "executed" || tc.status === "approved";
                      const isExpanded = expandedToolCalls.has(tc.id);
                      const isLong = result && result.result.length > 80;
                      const showExpanded = result && (result.isError || !isLong || isExpanded);

                      return (
                        <div key={tc.id} className={`rounded-xl border p-3 text-xs ${tc.status === "pending_confirmation" ? "border-amber-500/30 bg-amber-500/10" : tc.status === "rejected" ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${tc.status === "pending_confirmation" ? "bg-amber-500/15 text-amber-300" : tc.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                              {toolLabel(tc.name)}
                            </span>
                            <span className="truncate font-medium text-slate-100">
                              {formatToolSummary(tc.name, tc.input)}
                            </span>
                            {tc.status === "pending_confirmation" ? (
                              <span className="ml-auto shrink-0 text-[11px] text-amber-400">等待确认</span>
                            ) : tc.status === "rejected" ? (
                              <span className="ml-auto shrink-0 text-[11px] text-red-400">已拒绝</span>
                            ) : null}
                          </div>
                          {tc.status === "pending_confirmation" ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => onConfirmTool(tc.id, true)}
                                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20"
                              >
                                执行
                              </button>
                              <button
                                onClick={() => onConfirmTool(tc.id, false)}
                                className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/20"
                              >
                                拒绝
                              </button>
                            </div>
                          ) : null}
                          {isExecuted && result ? (
                            <div className={`mt-2 border-t pt-2 ${result.isError ? "border-red-500/20" : "border-emerald-500/10"}`}>
                              {showExpanded ? (
                                <div className={result.isError ? "text-red-300" : "text-slate-400"}>
                                  {result.isError ? "❌ " : "✅ "}{result.result}
                                  {isLong && !result.isError ? (
                                    <button onClick={() => {
                                      setExpandedToolCalls(prev => {
                                        const next = new Set(prev);
                                        next.delete(tc.id);
                                        return next;
                                      });
                                    }} className="ml-1 text-emerald-400 hover:text-emerald-300">收起</button>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="text-slate-400">
                                  {result.result.slice(0, 80)}...
                                  <button onClick={() => {
                                    setExpandedToolCalls(prev => new Set([...prev, tc.id]));
                                  }} className="ml-1 text-emerald-400 hover:text-emerald-300">展开</button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <div className="mx-auto w-full max-w-[768px]">
            {chatFile ? (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
                <span className="truncate">已选择文件：{chatFile.name}</span>
                <button type="button" onClick={() => onFileChange(null)} className="text-slate-500 hover:text-slate-200">
                  移除
                </button>
              </div>
            ) : null}
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
              <label className="shrink-0 cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
                选择文件
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                />
              </label>
              <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (!event.ctrlKey && !event.shiftKey) {
                      event.preventDefault();
                      const form = event.currentTarget.closest("form");
                      if (form) form.requestSubmit();
                    } else {
                      event.preventDefault();
                      const ta = event.currentTarget;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const newValue = draft.slice(0, start) + "\n" + draft.slice(end);
                      onDraftChange(newValue);
                      requestAnimationFrame(() => {
                        ta.selectionStart = ta.selectionEnd = start + 1;
                      });
                    }
                  }
                }}
                className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="输入消息。我会在需要时帮你搜索、创建笔记、任务或 Prompt。"
              />
              <button disabled={creating || sending || !!streamingChatId} className="shrink-0 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
                {streamingChatId ? "接收中..." : sending ? "发送中..." : creating ? "创建中..." : "发送"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

const workbenchTabs: Array<{ id: WorkbenchTab; label: string }> = [
  { id: "notes", label: "笔记" },
  { id: "skills", label: "Skill" },
  { id: "skill-store", label: "技能仓库" },
  { id: "projects", label: "项目" },
  { id: "chats", label: "聊天" },
  { id: "sessions", label: "会话" },
  { id: "memory", label: "记忆" }
];

function HomeOverviewWorkspace({
  apiConnected,
  apiError,
  databaseInfo,
  selectedProject,
  globalNotes,
  selectedGlobalNote,
  globalNotesLoading,
  globalNotesError,
  globalNoteDraft,
  savingGlobalNote,
  deletingGlobalNoteId,
  globalNoteSettingsOpen,
  globalSkills,
  loading,
  error,
  projectSkills,
  operationName,
  chatSessions,
  projects,
  recentProjects,
  runningSessions,
  onEnterProject,
  onCreateProject,
  onOpenWorkspaceTerminal,
  onOpenExecution,
  onSelectChat,
  onCreateNote,
  onSelectNote,
  onNoteDraftChange,
  onSaveNote,
  onDeleteNote,
  onOpenNoteSettings,
  onCloseNoteSettings,
  onCreateSkill,
  onRenameSkill,
  onDeleteSkill,
  onCopyToProject,
  onEditDocument,
  storeSkills = [],
  storeSkillsLoading = false,
  storeSkillsError = null,
  storeSkillOperationName = null,
  onCreateStoreSkill,
  onRenameStoreSkill,
  onDeleteStoreSkill,
  onInstallStoreSkill,
  onSendStoreSkillToProject,
  onEditStoreSkillDocument,
  chatSkillsData = [],
  chatSkillsLoadingData = false,
  chatSkillsErrorData = null,
  deletingChatSkillNameData = null,
  onDeleteChatSkillData,
  globalNoteSearchQuery = "",
  globalNoteFilterTags = [],
  availableGlobalNoteTags = [],
  onGlobalNoteSearchChange,
  onGlobalNoteFilterTagsChange,
  globalNotesTotal = 0,
  globalNotesPage = 1,
  onGlobalNotesPageChange,
  onRefreshGlobalSkills,
  onRefreshStoreSkills,
  onRefreshChatSkills
}: {
  apiConnected: boolean;
  apiError: string | null;
  databaseInfo: MetaResponse["database"] | null;
  selectedProject: ProjectSummary | null;
  globalNotes: NoteSummary[];
  selectedGlobalNote: NoteSummary | null;
  globalNotesLoading: boolean;
  globalNotesError: string | null;
  globalNoteDraft: NoteDraft;
  savingGlobalNote: boolean;
  deletingGlobalNoteId: string | null;
  globalNoteSettingsOpen: boolean;
  globalSkills: SkillSummary[];
  loading: boolean;
  error: string | null;
  projectSkills: ProjectSkillSummary[];
  operationName: string | null;
  chatSessions: ChatSessionSummary[];
  projects: ProjectSummary[];
  recentProjects: ProjectSummary[];
  runningSessions: ExecutionListItem[];
  onEnterProject: (projectId?: string) => void;
  onCreateProject: () => void;
  onOpenWorkspaceTerminal: () => void;
  onOpenExecution: (execution: ExecutionListItem) => void;
  onSelectChat: (session: ChatSessionSummary) => void;
  onCreateNote: () => void;
  onSelectNote: (note: NoteSummary) => void;
  onNoteDraftChange: (field: keyof NoteDraft, value: string) => void;
  onSaveNote: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteNote: (note: NoteSummary) => void;
  onOpenNoteSettings: () => void;
  onCloseNoteSettings: () => void;
  onCreateSkill: () => void;
  onRenameSkill: (skill: SkillSummary) => void;
  onDeleteSkill: (skill: SkillSummary) => void;
  onCopyToProject: (skill: SkillSummary) => void;
  onEditDocument: (skill: SkillSummary) => void;
  storeSkills?: StoreSkillStatus[];
  storeSkillsLoading?: boolean;
  storeSkillsError?: string | null;
  storeSkillOperationName?: string | null;
  onCreateStoreSkill?: (name: string, description: string) => void;
  onRenameStoreSkill?: (skill: StoreSkillStatus) => void;
  onDeleteStoreSkill?: (skill: StoreSkillStatus) => void;
  onInstallStoreSkill?: (skill: StoreSkillStatus, target: "claude-code" | "chat") => void;
  onSendStoreSkillToProject?: (skill: StoreSkillStatus) => void;
  onEditStoreSkillDocument: (skill: StoreSkillStatus) => void;
  chatSkillsData?: ChatSkill[];
  chatSkillsLoadingData?: boolean;
  chatSkillsErrorData?: string | null;
  deletingChatSkillNameData?: string | null;
  onDeleteChatSkillData?: (skill: ChatSkill) => void;
  globalNoteSearchQuery?: string;
  globalNoteFilterTags?: string[];
  availableGlobalNoteTags?: string[];
  onGlobalNoteSearchChange?: (query: string) => void;
  onGlobalNoteFilterTagsChange?: (tags: string[]) => void;
  globalNotesTotal?: number;
  globalNotesPage?: number;
  onGlobalNotesPageChange?: (page: number) => void;
  onRefreshGlobalSkills?: () => void;
  onRefreshStoreSkills?: () => void;
  onRefreshChatSkills?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("notes");

  const projectCount = projects.length;
  const runningCount = runningSessions.length;
  const chatCount = chatSessions.length;
  const noteCount = globalNotes.length;
  const skillCount = globalSkills.length;
  const storeSkillCount = storeSkills.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#151821] px-4 py-2.5 text-xs text-slate-400">
        <span className="font-medium text-slate-300">系统状态</span>
        <span className={`inline-flex items-center gap-1 ${apiConnected ? "text-emerald-400" : "text-red-400"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${apiConnected ? "bg-emerald-400" : "bg-red-400"}`} />
          API
        </span>
        <span className="text-slate-600">|</span>
        <span className={`inline-flex items-center gap-1 ${databaseInfo?.connected ? "text-emerald-400" : "text-slate-500"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${databaseInfo?.connected ? "bg-emerald-400" : "bg-slate-500"}`} />
          DB
        </span>
        <span className="text-slate-600">|</span>
        <span className={`inline-flex items-center gap-1 ${databaseInfo?.connected ? "text-emerald-400" : "text-slate-500"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${databaseInfo?.connected ? "bg-emerald-400" : "bg-slate-500"}`} />
          {databaseInfo?.engine?.toUpperCase() ?? "DB"}
        </span>
        {apiError ? (
          <>
            <span className="text-slate-600">|</span>
            <span className="text-red-400">{apiError}</span>
          </>
        ) : null}
      </div>

      <nav className="flex rounded-lg border border-white/10 bg-black/20 p-1">
        {workbenchTabs.map((tab) => {
          const count = tab.id === "projects" ? projectCount : tab.id === "sessions" ? runningCount : tab.id === "chats" ? chatCount : tab.id === "notes" ? noteCount : tab.id === "skill-store" ? storeSkillCount : skillCount;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${activeTab === tab.id ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}
            >
              {tab.label}
              <span className={`rounded px-1 text-[11px] ${activeTab === tab.id ? "bg-slate-200 text-slate-700" : "bg-white/10 text-slate-500"}`}>{count}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "notes" ? (
        <NotePanel
          project={null}
          title="全局笔记"
          description="沉淀跨项目上下文、复盘和可复用想法。"
          emptyText="还没有全局笔记，先记录一条跨项目上下文。"
          notes={globalNotes}
          selectedNote={selectedGlobalNote}
          loading={globalNotesLoading}
          error={globalNotesError}
          draft={globalNoteDraft}
          saving={savingGlobalNote}
          creatingTodo={false}
          deletingNoteId={deletingGlobalNoteId}
          settingsOpen={globalNoteSettingsOpen}
          showCreateTodo={false}
          searchQuery={globalNoteSearchQuery}
          filterTags={globalNoteFilterTags}
          availableTags={availableGlobalNoteTags}
          total={globalNotesTotal}
          page={globalNotesPage}
          onPageChange={onGlobalNotesPageChange}
          onCreate={onCreateNote}
          onSelect={onSelectNote}
          onDraftChange={onNoteDraftChange}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
          onCreateTodo={() => undefined}
          onOpenSettings={onOpenNoteSettings}
          onCloseSettings={onCloseNoteSettings}
          onSearchChange={onGlobalNoteSearchChange}
          onFilterTagsChange={onGlobalNoteFilterTagsChange}
        />
      ) : activeTab === "skills" ? (
        <GlobalSkillPanel
          selectedProject={selectedProject}
          skills={globalSkills}
          projectSkills={projectSkills}
          loading={loading}
          error={error}
          operationName={operationName}
          onCreate={onCreateSkill}
          onRename={onRenameSkill}
          onDelete={onDeleteSkill}
          onCopyToProject={onCopyToProject}
          onEditDocument={onEditDocument}
          onRefresh={onRefreshGlobalSkills ?? (() => {})}
        />
      ) : activeTab === "skill-store" ? (
        <SkillStorePanel
          skills={storeSkills}
          loading={storeSkillsLoading}
          error={storeSkillsError}
          operationName={storeSkillOperationName}
          onCreate={onCreateStoreSkill ?? (() => {})}
          onRename={onRenameStoreSkill ?? (() => undefined)}
          onDelete={onDeleteStoreSkill ?? (() => undefined)}
          onInstall={onInstallStoreSkill ?? (() => undefined)}
          onSendToProject={onSendStoreSkillToProject ?? (() => undefined)}
          onEditDocument={onEditStoreSkillDocument ?? (() => undefined)}
          onRefreshStore={onRefreshStoreSkills ?? (() => {})}
          chatSkills={chatSkillsData}
          chatSkillsLoading={chatSkillsLoadingData}
          chatSkillsError={chatSkillsErrorData}
          deletingChatSkillName={deletingChatSkillNameData}
          onDeleteChatSkill={onDeleteChatSkillData ?? (() => undefined)}
          onRefreshChatSkills={onRefreshChatSkills ?? (() => {})}
        />
      ) : activeTab === "projects" ? (
        <section className="rounded-xl border border-white/10 bg-[#151821]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-100">项目管理</div>
              <p className="mt-0.5 text-xs text-slate-500">所有项目，点击进入项目工作台。</p>
            </div>
            <button onClick={onCreateProject} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
              新建项目
            </button>
          </div>
          <div className="p-4">
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-slate-500">还没有项目，先创建一个吧。</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-100">{project.name}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">{project.path}</div>
                      </div>
                      <button onClick={() => onEnterProject(project.id)} className="shrink-0 rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5">
                        进入
                      </button>
                    </div>
                    {project.latestSessionResult ? (
                      <div className="mt-2 truncate rounded bg-white/[0.03] px-2 py-1 text-xs text-slate-400">
                        {project.latestSessionResult.sessionName}: {project.latestSessionResult.summary.slice(0, 80)}{project.latestSessionResult.summary.length > 80 ? "..." : ""}
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-slate-500">更新于 {formatDateTime(project.updatedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : activeTab === "chats" ? (
        <section className="rounded-xl border border-white/10 bg-[#151821]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-100">聊天会话</div>
              <p className="mt-0.5 text-xs text-slate-500">AI 聊天会话，点击进入聊天。</p>
            </div>
          </div>
          <div className="p-4">
            {chatSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-slate-500">还没有聊天会话，切换到聊天页面开始吧。</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {chatSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => onSelectChat(session)}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="truncate font-medium text-slate-100">{session.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(session.updatedAt)}</div>
                    {session.messages.length > 0 ? (
                      <div className="mt-1.5 truncate text-xs text-slate-400">{session.messages[session.messages.length - 1].content.slice(0, 100)}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : activeTab === "memory" ? (
        <GlobalMemoryPanel selectedProject={selectedProject} />
      ) : (
        <section className="rounded-xl border border-white/10 bg-[#151821]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-100">运行中执行项</div>
              <p className="mt-0.5 text-xs text-slate-500">当前正在运行的 Claude Code 会话与普通终端。</p>
            </div>
            <button onClick={onOpenWorkspaceTerminal} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
              打开终端
            </button>
          </div>
          <div className="p-4">
            {runningSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-slate-500">没有运行中的执行项</div>
            ) : (
              <div className="space-y-2">
                {runningSessions.map((session) => (
                  <div key={`${session.kind}:${session.id}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="truncate font-medium text-slate-100">{session.name}</span>
                        <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-300">{session.runtimeStatus ?? session.status}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span>{session.projectName ?? "工作台根目录"}</span>
                        <span>·</span>
                        <span>{session.kind === "workspace-terminal" ? "终端" : "Claude 会话"}</span>
                        <span>·</span>
                        <span>{formatDateTime(session.updatedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenExecution(session)}
                      className="ml-3 shrink-0 rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      打开
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
function ProjectWorkspacePage({
  activeTab,
  onTabChange,
  projects,
  selectedProject,
  selectedWorktree,
  worktrees,
  projectsLoading,
  worktreesLoading,
  deletingProject,
  deletingWorktreeId,
  projectError,
  worktreeError,
  notes,
  notesTotal = 0,
  notesPage = 1,
  selectedNote,
  notesLoading,
  notesError,
  noteDraft,
  savingNote,
  deletingNoteId,
  noteSettingsOpen,
  todos,
  todosTotal = 0,
  todosPage = 1,
  selectedTodo,
  todosLoading,
  todosError,
  todoDraft,
  savingTodo,
  deletingTodoId,
  sessions,
  promptDrafts,
  sessionsLoading,
  sessionsError,
  projectSkills,
  selectedProjectSkillName,
  projectSkillsLoading,
  projectSkillsError,
  skillOperationName,
  onCreateProject,
  onEditProject,
  onSelectProject,
  onDeleteProject,
  onCreateWorktree,
  onWorktreeSelect,
  onWorktreeDelete,
  onCreateNote,
  onSelectNote,
  onNoteDraftChange,
  onSaveNote,
  onDeleteNote,
  onOpenNoteSettings,
  onCloseNoteSettings,
  onCreateTodoFromNote,
  onCreateTodo,
  onSelectTodo,
  onTodoDraftChange,
  onSaveTodo,
  onDeleteTodo,
  onSelectProjectSkill,
  onCreateProjectSkill,
  onRenameProjectSkill,
  onDeleteProjectSkill,
  onCopyProjectSkillToGlobal,
  onAddProjectSkillToStore,
  onEditProjectSkillDocument,
  onOpenSession,
  onOpenWorkspaceTerminal,
  noteSearchQuery = "",
  noteFilterTags = [],
  availableNoteTags = [],
  onNoteSearchChange,
  onNoteFilterTagsChange,
  onNotesPageChange,
  onTodosPageChange,
  todoSearchQuery = "",
  todoFilterTags = [],
  todoStatuses = [],
  availableTodoTags = [],
  onTodoSearchChange,
  onTodoFilterTagsChange,
  onTodoStatusesChange,
  onTodoStatusChange,
  onRefreshWorktrees,
  onRefreshProjectSkills
}: {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  worktrees: WorktreeSummary[];
  projectsLoading: boolean;
  worktreesLoading: boolean;
  deletingProject: boolean;
  deletingWorktreeId: string | null;
  projectError: string | null;
  worktreeError: string | null;
  notes: NoteSummary[];
  notesTotal?: number;
  notesPage?: number;
  selectedNote: NoteSummary | null;
  notesLoading: boolean;
  notesError: string | null;
  noteDraft: NoteDraft;
  savingNote: boolean;
  deletingNoteId: string | null;
  noteSettingsOpen: boolean;
  todos: TodoSummary[];
  todosTotal?: number;
  todosPage?: number;
  selectedTodo: TodoSummary | null;
  todosLoading: boolean;
  todosError: string | null;
  todoDraft: TodoDraft;
  savingTodo: boolean;
  deletingTodoId: string | null;
  sessions: SessionSummary[];
  promptDrafts: PromptDraftSummary[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  projectSkills: ProjectSkillSummary[];
  selectedProjectSkillName: string | null;
  projectSkillsLoading: boolean;
  projectSkillsError: string | null;
  skillOperationName: string | null;
  onCreateProject: () => void;
  onEditProject: () => void;
  onSelectProject: (project: ProjectSummary) => void;
  onDeleteProject: () => void;
  onCreateWorktree: () => void;
  onWorktreeSelect: (worktree: WorktreeSummary) => void;
  onWorktreeDelete: (worktree: WorktreeSummary) => void;
  onCreateNote: () => void;
  onSelectNote: (note: NoteSummary) => void;
  onNoteDraftChange: (field: keyof NoteDraft, value: string) => void;
  onSaveNote: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteNote: (note: NoteSummary) => void;
  onOpenNoteSettings: () => void;
  onCloseNoteSettings: () => void;
  onCreateTodoFromNote: () => void;
  onCreateTodo: () => void;
  onSelectTodo: (todo: TodoSummary) => void;
  onTodoDraftChange: (field: keyof TodoDraft, value: string) => void;
  onSaveTodo: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteTodo: (todo: TodoSummary) => void;
  onSelectProjectSkill: (skill: ProjectSkillSummary) => void;
  onCreateProjectSkill: () => void;
  onRenameProjectSkill: (skill: ProjectSkillSummary) => void;
  onDeleteProjectSkill: (skill: ProjectSkillSummary) => void;
  onCopyProjectSkillToGlobal: (skill: ProjectSkillSummary) => void;
  onAddProjectSkillToStore: (skill: ProjectSkillSummary) => void;
  onEditProjectSkillDocument: (skill: ProjectSkillSummary) => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
  onOpenWorkspaceTerminal: () => void;
  noteSearchQuery?: string;
  noteFilterTags?: string[];
  availableNoteTags?: string[];
  onNoteSearchChange?: (query: string) => void;
  onNoteFilterTagsChange?: (tags: string[]) => void;
  onNotesPageChange?: (page: number) => void;
  onTodosPageChange?: (page: number) => void;
  todoSearchQuery?: string;
  todoFilterTags?: string[];
  todoStatuses?: TodoStatus[];
  availableTodoTags?: string[];
  onTodoSearchChange?: (query: string) => void;
  onTodoFilterTagsChange?: (tags: string[]) => void;
  onTodoStatusesChange?: (statuses: TodoStatus[]) => void;
  onTodoStatusChange?: (todo: TodoSummary, newStatus: TodoStatus) => void;
  onRefreshWorktrees?: () => void;
  onRefreshProjectSkills?: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="rounded-2xl border border-white/10 bg-[#151821] p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div className="text-xs text-slate-500">项目工作台</div>
              <h1 className="mt-2 text-2xl font-semibold">{selectedProject?.name ?? "选择或创建项目"}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                项目内承载任务、笔记、Skill、会话和 Worktree。会话终端通过模态框打开，关闭后继续后台运行。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!selectedProject}
                onClick={onOpenWorkspaceTerminal}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                打开终端
              </button>
              <button
                disabled={!selectedProject}
                onClick={() => onOpenSession("direct")}
                className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                创建会话
              </button>
            </div>
          </div>
          {selectedProject ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <CompactMetaPill label="目录" value={selectedProject.path} wide />
                <CompactMetaPill label="分支" value={selectedProject.defaultBranch} />
                <CompactMetaPill label="Worktree" value={selectedWorktree?.name ?? "未选择"} />
                <CompactMetaPill label="更新时间" value={formatDateTime(selectedProject.updatedAt)} />
                <button onClick={onEditProject} className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5">
                  编辑
                </button>
              </div>
              {selectedProject.description ? <p className="mt-3 line-clamp-2 text-xs text-slate-400">{selectedProject.description}</p> : null}
            </div>
          ) : null}
        </div>
        <ProjectTopNav activeTab={activeTab} onTabChange={onTabChange} />
      </section>

      {activeTab === "worktrees" ? (
        selectedProject ? (
          <WorktreePanel
            project={selectedProject}
            worktrees={worktrees}
            selectedWorktree={selectedWorktree}
            loading={worktreesLoading}
            deletingWorktreeId={deletingWorktreeId}
            error={worktreeError}
            onCreate={onCreateWorktree}
            onSelect={onWorktreeSelect}
            onDelete={onWorktreeDelete}
            onRefresh={onRefreshWorktrees ?? (() => {})}
          />
        ) : (
          <EmptyProjectNotice onCreateProject={onCreateProject} />
        )
      ) : null}

      {activeTab === "sessions" ? (
        <SessionsWorkspacePanel
          selectedProject={selectedProject}
          selectedWorktree={selectedWorktree}
          sessions={sessions}
          promptDrafts={promptDrafts}
          todos={todos}
          loading={sessionsLoading}
          error={sessionsError}
          onOpenSession={onOpenSession}
        />
      ) : null}

      {activeTab === "todos" ? (
        <TodoPanel
          project={selectedProject}
          notes={notes}
          todos={todos}
          selectedTodo={selectedTodo}
          loading={todosLoading}
          error={todosError}
          draft={todoDraft}
          saving={savingTodo}
          deletingTodoId={deletingTodoId}
          total={todosTotal}
          page={todosPage}
          onPageChange={onTodosPageChange}
          onCreate={onCreateTodo}
          onSelect={onSelectTodo}
          onDraftChange={onTodoDraftChange}
          onSave={onSaveTodo}
          onDelete={onDeleteTodo}
          onOpenSession={onOpenSession}
          searchQuery={todoSearchQuery}
          filterTags={todoFilterTags}
          statuses={todoStatuses}
          availableTags={availableTodoTags}
          onSearchChange={onTodoSearchChange}
          onFilterTagsChange={onTodoFilterTagsChange}
          onStatusesChange={onTodoStatusesChange}
          onStatusChange={onTodoStatusChange}
        />
      ) : null}

      {activeTab === "notes" ? (
        <NotePanel
          project={selectedProject}
          notes={notes}
          selectedNote={selectedNote}
          loading={notesLoading}
          error={notesError}
          draft={noteDraft}
          saving={savingNote}
          creatingTodo={savingTodo}
          deletingNoteId={deletingNoteId}
          settingsOpen={noteSettingsOpen}
          searchQuery={noteSearchQuery}
          filterTags={noteFilterTags}
          availableTags={availableNoteTags}
          total={notesTotal}
          page={notesPage}
          onPageChange={onNotesPageChange}
          onCreate={onCreateNote}
          onSelect={onSelectNote}
          onDraftChange={onNoteDraftChange}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
          onCreateTodo={onCreateTodoFromNote}
          onOpenSettings={onOpenNoteSettings}
          onCloseSettings={onCloseNoteSettings}
          onSearchChange={onNoteSearchChange}
          onFilterTagsChange={onNoteFilterTagsChange}
        />
      ) : null}

      {activeTab === "skills" ? (
        <ProjectSkillPanel
          project={selectedProject}
          skills={projectSkills}
          selectedSkillName={selectedProjectSkillName}
          loading={projectSkillsLoading}
          error={projectSkillsError}
          operationName={skillOperationName}
          onSelect={onSelectProjectSkill}
          onCreate={onCreateProjectSkill}
          onRename={onRenameProjectSkill}
          onDelete={onDeleteProjectSkill}
          onCopyToGlobal={onCopyProjectSkillToGlobal}
          onAddProjectSkillToStore={onAddProjectSkillToStore}
          onEditDocument={onEditProjectSkillDocument}
          onRefresh={onRefreshProjectSkills ?? (() => {})}
        />
      ) : null}

      {activeTab === "memory" ? (selectedProject ? <ProjectMemoryPanel projectId={selectedProject.id} /> : <EmptyProjectNotice onCreateProject={onCreateProject} />) : null}

      {!projectTabs.some((tab) => tab.id === activeTab) ? <EmptyProjectNotice onCreateProject={onCreateProject} /> : null}
    </div>
  );
}

function ProjectTopNav({ activeTab, onTabChange }: { activeTab: ProjectTab; onTabChange: (tab: ProjectTab) => void }) {
  return (
    <nav className="mt-5 flex gap-1 overflow-x-auto border-t border-white/10 pt-4">
      {projectTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${
            activeTab === tab.id ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function WorktreePanel({
  project,
  worktrees,
  selectedWorktree,
  loading,
  deletingWorktreeId,
  error,
  onCreate,
  onSelect,
  onDelete,
  onRefresh
}: {
  project: ProjectSummary;
  worktrees: WorktreeSummary[];
  selectedWorktree: WorktreeSummary | null;
  loading: boolean;
  deletingWorktreeId: string | null;
  error: string | null;
  onCreate: () => void;
  onSelect: (worktree: WorktreeSummary) => void;
  onDelete: (worktree: WorktreeSummary) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-[#151821] p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="text-sm font-medium text-slate-100">Worktree 管理</div>
          <div className="mt-1 break-all text-xs text-slate-500">{project.path}/.claude/worktree/</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">{worktrees.length} 个</span>
          <button onClick={onRefresh} className="rounded-lg border border-white/10 px-2.5 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
            ⟳
          </button>
          <button onClick={onCreate} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
            创建 worktree
          </button>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
      {loading ? <div className="rounded-lg border border-white/10 p-3 text-xs text-slate-400">Worktree 加载中...</div> : null}
      {!loading && worktrees.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-slate-500">当前项目还没有 worktree。</div>
      ) : null}

      {!loading && worktrees.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {worktrees.map((worktree) => (
            <div
              key={worktree.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                selectedWorktree?.id === worktree.id ? "border-slate-300/50 bg-white/[0.08]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <button type="button" onClick={() => onSelect(worktree)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-slate-100">{worktree.name}</span>
                  <WorktreeStatusPill status={worktree.status} />
                </div>
                <div className="mt-1 truncate text-xs text-slate-500">{worktree.path}</div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="truncate">分支：{worktree.branch}</span>
                  <span className="shrink-0">更新：{formatDateTime(worktree.updatedAt)}</span>
                </div>
              </button>
              <button
                type="button"
                disabled={deletingWorktreeId !== null}
                onClick={() => onDelete(worktree)}
                className="shrink-0 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 disabled:opacity-60"
              >
                {deletingWorktreeId === worktree.id ? "删除中" : "删除"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}


function GlobalSkillPanel({
  selectedProject,
  skills,
  projectSkills,
  loading,
  error,
  operationName,
  onCreate,
  onRename,
  onDelete,
  onCopyToProject,
  onEditDocument,
  onRefresh
}: {
  selectedProject: ProjectSummary | null;
  skills: SkillSummary[];
  projectSkills: ProjectSkillSummary[];
  loading: boolean;
  error: string | null;
  operationName: string | null;
  onCreate: () => void;
  onRename: (skill: SkillSummary) => void;
  onDelete: (skill: SkillSummary) => void;
  onCopyToProject: (skill: SkillSummary) => void;
  onEditDocument: (skill: SkillSummary) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#151821]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-100">全局 Skill 文件夹</div>
          <div className="mt-1 text-xs text-slate-500">来源：~/.claude/skills/*，支持直接编辑 SKILL.md。</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="rounded-lg border border-white/10 px-2.5 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
            ⟳
          </button>
          <button onClick={onCreate} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
            新建
          </button>
        </div>
      </div>
      <div className="p-4">
        {error ? <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
        {loading ? <div className="rounded-lg border border-white/10 p-3 text-xs text-slate-400">全局 Skill 加载中...</div> : null}
        {!loading && skills.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-slate-500">还没有全局 Skill 文件夹。</div> : null}
        {!loading && skills.length > 0 ? (
          <div className="space-y-2">
            {skills.map((skill) => {
              const projectState = projectSkills.find((item) => item.name === skill.name);
              const busy = operationName === skill.name;
              return (
                <div key={skill.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-100">{skill.name}</span>
                        {projectState?.hasOverride ? <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-100">被项目覆盖</span> : null}
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-500">{skill.path}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <button disabled={busy} onClick={() => onEditDocument(skill)} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 disabled:opacity-50">
                        编辑文档
                      </button>
                      <button disabled={busy} onClick={() => onCopyToProject(skill)} className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50">
                        发送到项目
                      </button>
                      <button disabled={busy} onClick={() => onDelete(skill)} className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 disabled:opacity-50">
                        {busy ? "处理中" : "删除"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SkillStorePanel({
  skills,
  loading,
  error,
  operationName,
  onCreate,
  onRename,
  onDelete,
  onInstall,
  onSendToProject,
  onEditDocument,
  onRefreshStore,
  chatSkills,
  chatSkillsLoading,
  chatSkillsError,
  deletingChatSkillName,
  onDeleteChatSkill,
  onRefreshChatSkills
}: {
  skills: StoreSkillStatus[];
  loading: boolean;
  error: string | null;
  operationName: string | null;
  onCreate: (name: string, description: string) => void;
  onRename: (skill: StoreSkillStatus) => void;
  onDelete: (skill: StoreSkillStatus) => void;
  onInstall: (skill: StoreSkillStatus, target: "claude-code" | "chat") => void;
  onSendToProject: (skill: StoreSkillStatus) => void;
  onEditDocument: (skill: StoreSkillStatus) => void;
  onRefreshStore: () => void;
  chatSkills: ChatSkill[];
  chatSkillsLoading: boolean;
  chatSkillsError: string | null;
  deletingChatSkillName: string | null;
  onDeleteChatSkill: (skill: ChatSkill) => void;
  onRefreshChatSkills: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");

  function handleSubmitCreate(e: FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    onCreate(name, createDesc.trim());
    setShowCreate(false);
    setCreateName("");
    setCreateDesc("");
  }

  function openCreate() {
    setCreateName("");
    setCreateDesc("");
    setShowCreate(true);
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#151821]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-100">技能仓库</div>
          <div className="mt-1 text-xs text-slate-500">来源：~/.workhorse/skills/*，统一管理并安装到各目标。</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefreshStore} className="rounded-lg border border-white/10 px-2.5 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
            ⟳
          </button>
          <button onClick={openCreate} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
            新建
          </button>
        </div>
      </div>
      <div className="p-4">
        {error ? <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
        {loading ? <div className="rounded-lg border border-white/10 p-3 text-xs text-slate-400">技能仓库加载中...</div> : null}
        {!loading && skills.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-slate-500">还没有 Skill，先新建一个。</div> : null}
        {!loading && skills.length > 0 ? (
          <div className="space-y-2">
            {skills.map((item) => {
              const busy = operationName === item.skill.name;
              return (
                <div key={item.skill.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-100">{item.skill.name}</span>
                        {item.skill.description ? <span className="text-xs text-slate-500">{item.skill.description}</span> : null}
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-600">{item.skill.path}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${item.installed.claudeCode ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-slate-600"}`}>
                          {item.installed.claudeCode ? "全局 CC" : "全局 CC"}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${item.installed.chat ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-slate-600"}`}>
                          {item.installed.chat ? "Chat" : "Chat"}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${item.installed.claudeCodeProject ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-slate-600"}`}>
                          {item.installed.claudeCodeProject ? "项目 CC" : "项目 CC"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <button disabled={busy || item.installed.claudeCode} onClick={() => onInstall(item, "claude-code")} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 disabled:opacity-50" title="安装到全局 Claude Code">
                        安装到 CC
                      </button>
                      <button disabled={busy || item.installed.chat} onClick={() => onInstall(item, "chat")} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 disabled:opacity-50" title="安装到 AI Chat">
                        安装到 Chat
                      </button>
                      <button disabled={busy} onClick={() => onSendToProject(item)} className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50" title="发送到指定项目">
                        发送到项目
                      </button>
                      <button disabled={busy} onClick={() => onEditDocument(item)} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 disabled:opacity-50">
                        编辑文档
                      </button>
                      <button disabled={busy} onClick={() => onDelete(item)} className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 disabled:opacity-50">
                        {busy ? "处理中" : "删除"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {showCreate ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#1a1d28] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmitCreate}>
                <div className="p-4 pb-0">
                  <h3 className="text-sm font-medium text-slate-100">新建 Skill</h3>
                  <p className="mt-1 text-xs text-slate-500">在 ~/.workhorse/skills/ 下创建新的 Skill 文件夹。</p>
                </div>
                <div className="space-y-3 px-4 pt-4">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">名称</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                      placeholder="Skill 名称"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">描述（可选）</label>
                    <input
                      type="text"
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                      placeholder="简要描述 Skill 用途"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-white/5 p-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-white/15 hover:bg-white/5 hover:text-slate-200"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-200"
                  >
                    创建
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}

      <div className="border-t border-white/10 px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-100">Chat Skills</div>
            <div className="mt-0.5 text-xs text-slate-500">AI Chat 运行时加载的 Skill，来源：~/.workhorse/chat-skills/*</div>
          </div>
          <button onClick={onRefreshChatSkills} className="rounded-lg border border-white/10 px-2.5 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
            ⟳
          </button>
        </div>
        {chatSkillsError ? <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{chatSkillsError}</p> : null}
        {chatSkillsLoading ? <div className="rounded-lg border border-white/10 p-3 text-xs text-slate-400">Chat Skills 加载中...</div> : null}
        {!chatSkillsLoading && chatSkills.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">还没有安装 Chat Skill，可在上方仓库中安装。</div> : null}
        {!chatSkillsLoading && chatSkills.length > 0 ? (
          <div className="space-y-2">
            {chatSkills.map((skill) => {
              const busy = deletingChatSkillName === skill.name;
              return (
                <div key={skill.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-100">{skill.name}</span>
                        {skill.description ? <span className="text-xs text-slate-500">{skill.description}</span> : null}
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-600">{skill.path}</div>
                    </div>
                    <button disabled={busy} onClick={() => onDeleteChatSkill(skill)} className="shrink-0 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 disabled:opacity-50">
                      {busy ? "处理中" : "移除"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProjectSkillPanel({
  project,
  skills,
  selectedSkillName,
  loading,
  error,
  operationName,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onCopyToGlobal,
  onAddProjectSkillToStore,
  onEditDocument,
  onRefresh
}: {
  project: ProjectSummary | null;
  skills: ProjectSkillSummary[];
  selectedSkillName: string | null;
  loading: boolean;
  error: string | null;
  operationName: string | null;
  onSelect: (skill: ProjectSkillSummary) => void;
  onCreate: () => void;
  onRename: (skill: ProjectSkillSummary) => void;
  onDelete: (skill: ProjectSkillSummary) => void;
  onCopyToGlobal: (skill: ProjectSkillSummary) => void;
  onAddProjectSkillToStore: (skill: ProjectSkillSummary) => void;
  onEditDocument: (skill: ProjectSkillSummary) => void;
  onRefresh: () => void;
}) {
  if (!project) {
    return <EmptyProjectNotice onCreateProject={() => undefined} />;
  }

  const selectedSkill = skills.find((skill) => skill.name === selectedSkillName) ?? skills[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-100">项目 Skill 文件夹</div>
            <div className="mt-1 break-all text-xs text-slate-500">来源：{project.path}/.claude/skills/*</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="rounded-lg border border-white/10 px-2.5 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
              ⟳
            </button>
            <button onClick={onCreate} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
              新建
            </button>
          </div>
        </div>
        <div className="p-4">
          {error ? <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
          {loading ? <div className="rounded-lg border border-white/10 p-3 text-xs text-slate-400">项目 Skill 加载中...</div> : null}
          {!loading && skills.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-slate-500">当前项目和全局都没有 Skill 文件夹。</div> : null}
          {!loading && skills.length > 0 ? (
            <div className="space-y-2">
              {skills.map((skill) => (
                <button
                  key={skill.name}
                  onClick={() => onSelect(skill)}
                  className={`w-full rounded-lg border p-3 text-left text-sm ${selectedSkill?.name === skill.name ? "border-slate-300/50 bg-white/[0.08]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-100">{skill.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${skill.effectiveSource === "project" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-sky-300/30 bg-sky-300/10 text-sky-100"}`}>
                          {skill.effectiveSource === "project" ? "项目生效" : "全局生效"}
                        </span>
                        {skill.hasOverride ? <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-100">覆盖全局</span> : null}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">{skill.effectivePath}</div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{skill.hasProject ? "项目" : "全局"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium text-slate-100">Skill 详情</div>
            <p className="mt-1 text-xs text-slate-500">可查看路径并直接编辑当前 Skill 的 SKILL.md。</p>
          </div>
          <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">{skills.length} 个</span>
        </div>
        {selectedSkill ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <DetailRow label="名称" value={selectedSkill.name} />
              <DetailRow label="生效来源" value={selectedSkill.effectiveSource === "project" ? "项目级" : "全局级"} />
              <DetailRow label="覆盖全局" value={selectedSkill.hasOverride ? "是" : "否"} />
            </div>
            <div className="space-y-2 text-xs">
              <PathBlock label="生效路径" value={selectedSkill.effectivePath} />
              <PathBlock label="项目路径" value={selectedSkill.projectPath ?? "无项目级文件夹"} />
              <PathBlock label="全局路径" value={selectedSkill.globalPath ?? "无全局级文件夹"} />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <button disabled={!selectedSkill.hasProject || operationName === selectedSkill.name} onClick={() => onRename(selectedSkill)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">
                重命名项目 Skill
              </button>
              <button disabled={!selectedSkill.hasProject || operationName === selectedSkill.name} onClick={() => onCopyToGlobal(selectedSkill)} className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs text-sky-100 disabled:opacity-50">
                复制到全局
              </button>
              <button disabled={operationName === selectedSkill.name} onClick={() => onEditDocument(selectedSkill)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">
                编辑文档
              </button>
              <button disabled={!selectedSkill.hasProject || operationName === selectedSkill.name} onClick={() => onAddProjectSkillToStore(selectedSkill)} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-50">
                添加到技能仓库
              </button>
              <button disabled={!selectedSkill.hasProject || operationName === selectedSkill.name} onClick={() => onDelete(selectedSkill)} className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 disabled:opacity-50">
                {operationName === selectedSkill.name ? "处理中" : "删除项目 Skill"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-xs text-slate-500">选择或创建一个 Skill 文件夹。</div>
        )}
      </section>
    </div>
  );
}

function SkillTransferModal({
  target,
  projects,
  selectedProjectId,
  mode,
  error,
  onProjectChange,
  onModeChange,
  onSubmit,
  onClose
}: {
  target: SkillTransferTarget;
  projects: ProjectSummary[];
  selectedProjectId: string;
  mode: SkillTransferMode;
  error: string | null;
  onProjectChange: (projectId: string) => void;
  onModeChange: (mode: SkillTransferMode) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const needsProject = target.kind === "global-to-project" || target.kind === "store-to-project";
  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));
  const modeOptions = [
    { value: "copy", label: "复制" },
    { value: "move", label: "转移" }
  ];
  const sourceName = target.kind === "store-to-project" ? target.skill.skill.name : target.skill.name;
  const title = needsProject ? `发送 Skill「${sourceName}」` : `添加 Skill「${sourceName}」到仓库`;
  const description = needsProject
    ? "选择目标项目，并决定保留源 Skill 还是在成功后移走源 Skill。"
    : "选择复制或转移模式，将现有 Skill 放入技能仓库。";

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {needsProject ? (
            <Field label="目标项目">
              <Select options={projectOptions} value={selectedProjectId} onChange={onProjectChange} placeholder="请选择目标项目" />
            </Field>
          ) : null}
          <Field label="传输模式">
            <Select options={modeOptions} value={mode} onChange={(value) => onModeChange(value === "move" ? "move" : "copy")} placeholder="请选择模式" />
          </Field>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
          <div>复制：保留源 Skill，目标新增或覆盖。</div>
          <div className="mt-1">转移：目标创建成功后删除源 Skill。</div>
        </div>

        {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
            取消
          </button>
          <button type="button" onClick={onSubmit} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
            确认
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PathBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 break-all text-slate-200">{value}</div>
    </div>
  );
}

function ProjectFormModal({
  mode,
  draft,
  saving,
  error,
  onChange,
  onSubmit,
  onClose
}: {
  mode: ProjectMode;
  draft: ProjectDraft;
  saving: boolean;
  error: string | null;
  onChange: (field: keyof ProjectDraft, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={mode === "create" ? "新建项目" : "编辑项目"} description="项目表单使用模态框承载，避免占用详情区域。" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="名称">
          <input
            value={draft.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
            placeholder="workhorse-station"
          />
        </Field>
        <Field label="代码目录">
          <input
            value={draft.path}
            onChange={(event) => onChange("path", event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
            placeholder="/home/wengfb/projects/workhorse-station"
          />
        </Field>
        <Field label="默认分支">
          <input
            value={draft.defaultBranch}
            onChange={(event) => onChange("defaultBranch", event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
            placeholder="main"
          />
        </Field>
        <Field label="备注">
          <textarea
            value={draft.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
            placeholder="记录项目用途、约束或当前阶段"
          />
        </Field>
        {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
            取消
          </button>
          <button disabled={saving} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-60">
            {saving ? "保存中..." : mode === "create" ? "创建项目" : "保存修改"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function WorktreeCreateModal({
  project,
  draft,
  saving,
  error,
  onChange,
  onSubmit,
  onClose
}: {
  project: ProjectSummary;
  draft: WorktreeDraft;
  saving: boolean;
  error: string | null;
  onChange: (field: keyof WorktreeDraft, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="创建 worktree" description={`${project.path}/.claude/worktree/`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="名称">
            <input
              value={draft.name}
              onChange={(event) => onChange("name", event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
              placeholder="phase-1-task"
            />
          </Field>
          <Field label="分支（可选）">
            <input
              value={draft.branch}
              onChange={(event) => onChange("branch", event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
              placeholder="workhorse/name"
            />
          </Field>
          <Field label="基准（可选）">
            <input
              value={draft.baseBranch}
              onChange={(event) => onChange("baseBranch", event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
              placeholder={project.defaultBranch}
            />
          </Field>
        </div>
        {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
            取消
          </button>
          <button disabled={saving} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-60">
            {saving ? "创建中..." : "创建 worktree"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/10 bg-[#151821] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-100">{title}</div>
            {description ? <div className="mt-1 break-all text-xs text-slate-500">{description}</div> : null}
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/10 px-2 py-1 text-sm text-slate-300 hover:bg-white/5">
            关闭
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function CollectionPlaceholder({
  title,
  description,
  items,
  detailTitle,
  notice
}: {
  title: string;
  description: string;
  items: string[];
  detailTitle: string;
  notice: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{description}</div>
        </div>
        <div className="divide-y divide-white/10">
          {items.map((item) => (
            <div key={item} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="text-slate-200">{item}</div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">占位</span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="font-medium text-slate-100">{detailTitle}</div>
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">{notice}</p>
      </section>
    </div>
  );
}

function ProjectCollectionPlaceholder({
  title,
  description,
  items,
  detailTitle,
  selectedProject,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  items: string[];
  detailTitle: string;
  selectedProject: ProjectSummary | null;
  actionLabel: string;
  onAction?: () => void;
}) {
  if (!selectedProject) {
    return <EmptyProjectNotice onCreateProject={() => undefined} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{description}</div>
        </div>
        <div className="divide-y divide-white/10">
          {items.map((item) => (
            <div key={item} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="text-slate-200">{item}</div>
                <div className="mt-1 text-xs text-slate-500">项目：{selectedProject.name}</div>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">占位</span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="font-medium text-slate-100">{detailTitle}</div>
        <p className="mt-3 text-slate-400">当前是项目内前端占位，后续接入真实 API、草稿确认和来源关联。</p>
        <button
          disabled={!onAction}
          onClick={onAction}
          className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionLabel}
        </button>
      </section>
    </div>
  );
}

function PlaceholderWorkspace({
  apiConnected,
  apiError,
  databaseInfo
}: {
  apiConnected: boolean;
  apiError: string | null;
  databaseInfo: MetaResponse["database"] | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">MVP 闭环</div>
        <div className="divide-y divide-white/10">
          {["首页聊天生成草稿", "进入项目选择 worktree", "从任务创建会话", "会话模态框后台运行"].map((item, index) => (
            <div key={item} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="text-slate-200">{item}</div>
                <div className="text-xs text-slate-500">新信息架构步骤 {index + 1}</div>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">规划中</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">系统状态</div>
        <div className="space-y-4 p-4 text-sm text-slate-300">
          <DetailRow label="当前阶段" value="Phase 2" />
          <DetailRow label="API 状态" value={apiConnected ? "已连接" : "未连接"} />
          <DetailRow label="数据库" value={databaseInfo?.connected ? `${databaseInfo.engine} 已连接` : "等待后端"} />
          <DetailRow label="实例" value={databaseInfo ? `${databaseInfo.host}/${databaseInfo.database}` : "未知"} />
          {apiError ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{apiError}</p> : null}
        </div>
      </section>
    </div>
  );
}

function FeatureCardGrid({ cards }: { cards: Array<{ title: string; value: string; detail: string }> }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs text-slate-500">{card.title}</div>
          <div className="mt-2 text-2xl font-semibold">{card.value}</div>
          <div className="mt-2 text-xs text-slate-400">{card.detail}</div>
        </article>
      ))}
    </div>
  );
}

function EmptyProjectNotice({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-white/10 bg-[#151821] p-6 text-sm text-slate-400">
      <div className="text-base font-medium text-slate-100">还没有选择项目</div>
      <p className="mt-2">进入项目后才能查看任务、项目笔记、项目 Skill、会话和 Worktree。</p>
      <button onClick={onCreateProject} className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
        新建项目
      </button>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ connected, loading }: { connected: boolean; loading: boolean }) {
  const label = loading ? "API 连接中" : connected ? "API 已连接" : "API 未连接";
  const className = connected
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    : "border-amber-400/40 bg-amber-400/10 text-amber-200";

  return <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>{label}</span>;
}

function WorktreeStatusPill({ status }: { status: WorktreeStatus }) {
  const styles: Record<WorktreeStatus, string> = {
    clean: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    dirty: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    missing: "border-red-400/30 bg-red-500/10 text-red-200",
    unknown: "border-slate-400/30 bg-slate-400/10 text-slate-300"
  };

  const labels: Record<WorktreeStatus, string> = {
    clean: "clean",
    dirty: "dirty",
    missing: "missing",
    unknown: "unknown"
  };

  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${styles[status]}`}>{labels[status]}</span>;
}

function SessionStatusPill({ status }: { status: SessionSummary["status"] }) {
  const styles: Record<SessionSummary["status"], string> = {
    draft: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    queued: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    running: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    completed: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    failed: "border-red-400/30 bg-red-500/10 text-red-200"
  };

  const labels: Record<SessionSummary["status"], string> = {
    draft: "draft",
    queued: "queued",
    running: "running",
    completed: "completed",
    failed: "failed"
  };

  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${styles[status]}`}>{labels[status]}</span>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="truncate text-right text-slate-100">{value}</span>
    </div>
  );
}

function CompactMetaPill({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 ${wide ? "max-w-full basis-full sm:basis-auto sm:max-w-[24rem]" : ""}`}>
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="truncate text-slate-100">{value}</span>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 truncate text-slate-100">{value}</div>
    </div>
  );
}

function emptyProjectDraft(): ProjectDraft {
  return {
    name: "",
    path: "",
    defaultBranch: "main",
    description: ""
  };
}

function emptyWorktreeDraft(): WorktreeDraft {
  return {
    name: "",
    branch: "",
    baseBranch: ""
  };
}

function emptySessionEditorDraft(): SessionEditorDraft {
  return {
    sessionName: "",
    promptTitle: "",
    prompt: "",
    todoId: "",
    worktreeId: "",
    requestedWorktreeName: "",
    promptDraftId: "",
    resumeSessionId: "",
    forkSession: false
  };
}

function projectToDraft(project: ProjectSummary): ProjectDraft {
  return {
    name: project.name,
    path: project.path,
    defaultBranch: project.defaultBranch,
    description: project.description ?? ""
  };
}

function projectDraftToRequest(draft: ProjectDraft) {
  return {
    name: draft.name,
    path: draft.path,
    defaultBranch: draft.defaultBranch || "main",
    description: draft.description || null
  };
}

function buildSessionDraft({
  source,
  todo,
  selectedWorktree
}: {
  source: SessionSource;
  todo: TodoSummary | null;
  selectedWorktree: WorktreeSummary | null;
}): SessionEditorDraft {
  return {
    sessionName: source === "todo" && todo ? todo.title : source === "todo" ? "任务会话" : "直接会话",
    promptTitle: source === "todo" && todo ? `Prompt 草稿：${todo.title}` : "",
    prompt: source === "todo" && todo?.description.trim() ? todo.description : "",
    todoId: todo?.id ?? "",
    worktreeId: selectedWorktree?.id ?? "",
    requestedWorktreeName: "",
    promptDraftId: "",
    resumeSessionId: "",
    forkSession: false
  };
}

function promptDraftToSessionDraft(promptDraft: PromptDraftSummary): SessionEditorDraft {
  return {
    sessionName: promptDraft.source === "todo" ? "任务会话" : "直接会话",
    promptTitle: promptDraft.title,
    prompt: promptDraft.prompt,
    todoId: promptDraft.todoId ?? "",
    worktreeId: promptDraft.worktreeId ?? "",
    requestedWorktreeName: promptDraft.requestedWorktreeName ?? "",
    promptDraftId: promptDraft.id,
    resumeSessionId: "",
    forkSession: false
  };
}

function sessionToDraft(session: SessionSummary, promptDrafts: PromptDraftSummary[]): SessionEditorDraft {
  const promptDraft = session.promptDraftId ? promptDrafts.find((item) => item.id === session.promptDraftId) ?? null : null;

  return {
    sessionName: session.name,
    promptTitle: promptDraft?.title ?? "",
    prompt: session.prompt,
    todoId: session.todoId ?? "",
    worktreeId: session.worktreeId ?? "",
    requestedWorktreeName: session.requestedWorktreeName ?? promptDraft?.requestedWorktreeName ?? "",
    promptDraftId: session.promptDraftId ?? "",
    resumeSessionId: "",
    forkSession: false
  };
}

function sessionDraftToPromptDraftRequest(draft: SessionEditorDraft, source: SessionSource) {
  return {
    todoId: optionalId(draft.todoId),
    worktreeId: optionalId(draft.worktreeId),
    requestedWorktreeName: optionalText(draft.requestedWorktreeName),
    source,
    title: draft.promptTitle.trim(),
    prompt: draft.prompt,
    status: "draft" as const
  };
}

function sessionDraftToCreateSessionRequest(draft: SessionEditorDraft, source: SessionSource) {
  return {
    todoId: optionalId(draft.todoId),
    worktreeId: optionalId(draft.worktreeId),
    promptDraftId: optionalId(draft.promptDraftId),
    requestedWorktreeName: optionalText(draft.requestedWorktreeName),
    source,
    name: optionalString(draft.sessionName),
    prompt: draft.prompt,
    status: "draft" as const,
    resumeSessionId: optionalId(draft.resumeSessionId),
    forkSession: draft.forkSession
  };
}

function optionalId(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function worktreeDraftToRequest(draft: WorktreeDraft): CreateWorktreeRequest {
  return {
    name: draft.name,
    branch: draft.branch.trim() || undefined,
    baseBranch: draft.baseBranch.trim() || undefined
  };
}

function emptyNoteDraft(): NoteDraft {
  return {
    title: "",
    content: "",
    tags: ""
  };
}

function emptyTodoDraft(): TodoDraft {
  return {
    title: "",
    description: "",
    status: "pending",
    tags: "",
    sourceNoteId: ""
  };
}

function noteToDraft(note: NoteSummary): NoteDraft {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags.join(", ")
  };
}

function todoToDraft(todo: TodoSummary): TodoDraft {
  return {
    title: todo.title,
    description: todo.description,
    status: todo.status,
    tags: todo.tags.join(", "),
    sourceNoteId: todo.sourceNoteId ?? ""
  };
}

function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function extractNoteTitle(content: string) {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ?? "";
}

function syncNoteTitleFromContent(draft: NoteDraft) {
  const derivedTitle = extractNoteTitle(draft.content);

  return derivedTitle && draft.title.trim() === "" ? { ...draft, title: derivedTitle } : draft;
}

function noteDraftToRequest(draft: NoteDraft) {
  return {
    title: draft.title.trim(),
    content: draft.content,
    tags: parseTagsInput(draft.tags)
  };
}

function todoDraftToRequest(draft: TodoDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description,
    status: draft.status,
    tags: parseTagsInput(draft.tags),
    sourceNoteId: draft.sourceNoteId || null
  };
}

function NotePanel({
  project,
  title = "项目笔记",
  description = "点击后直接进入 markdown 编辑器，正文首行默认作为标题。",
  emptyText = "当前项目还没有笔记，先创建一条上下文记录。",
  notes,
  selectedNote,
  loading,
  error,
  draft,
  saving,
  creatingTodo,
  deletingNoteId,
  settingsOpen,
  showCreateTodo = true,
  searchQuery = "",
  filterTags = [],
  availableTags = [],
  showSearch = true,
  total = 0,
  page = 1,
  pageSize = 12,
  onPageChange,
  onCreate,
  onSelect,
  onDraftChange,
  onSave,
  onDelete,
  onCreateTodo,
  onOpenSettings,
  onCloseSettings,
  onSearchChange,
  onFilterTagsChange
}: {
  project: ProjectSummary | null;
  title?: string;
  description?: string;
  emptyText?: string;
  notes: NoteSummary[];
  selectedNote: NoteSummary | null;
  loading: boolean;
  error: string | null;
  draft: NoteDraft;
  saving: boolean;
  creatingTodo: boolean;
  deletingNoteId: string | null;
  settingsOpen: boolean;
  showCreateTodo?: boolean;
  searchQuery?: string;
  filterTags?: string[];
  availableTags?: string[];
  showSearch?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onCreate: () => void;
  onSelect: (note: NoteSummary) => void;
  onDraftChange: (field: keyof NoteDraft, value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (note: NoteSummary) => void;
  onCreateTodo: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onSearchChange?: (query: string) => void;
  onFilterTagsChange?: (tags: string[]) => void;
}) {
  if (!project && showCreateTodo) {
    return <EmptyProjectNotice onCreateProject={() => undefined} />;
  }

  const [formModalOpen, setFormModalOpen] = useState(false);
  const isEditing = selectedNote !== null;

  const openCreateModal = () => {
    onCreate();
    setFormModalOpen(true);
  };

  const openEditModal = (note: NoteSummary) => {
    onDraftChange("title", note.title);
    onDraftChange("content", note.content);
    onDraftChange("tags", note.tags.join(", "));
    onSelect(note);
    setFormModalOpen(true);
  };

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="mt-1 text-xs text-slate-500">{description}</div>
          </div>
          <button onClick={openCreateModal} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-950">
            新建笔记
          </button>
        </div>

        {showSearch ? (
          <div className="border-b border-white/10 px-4 py-2 space-y-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="搜索笔记标题、内容、标签..."
                className="w-full rounded-md border border-white/10 bg-black/20 pl-8 pr-3 py-1.5 text-xs text-slate-100 outline-none focus:border-slate-400"
              />
            </div>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const next = filterTags.includes(tag)
                        ? filterTags.filter((t) => t !== tag)
                        : [...filterTags, tag];
                      onFilterTagsChange?.(next);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                      filterTags.includes(tag)
                        ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                        : "border border-white/10 text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[11px] text-slate-500">
              {notes.length} 条结果
              {(searchQuery || filterTags.length > 0) ? "（已筛选）" : ""}
            </div>
          </div>
        ) : null}

        <div className="min-h-[200px] grid grid-cols-3 gap-3 p-3 items-start">
          {loading ? <div className="col-span-3 px-4 py-6 text-sm text-slate-400">{title}加载中...</div> : null}
          {!loading && notes.length === 0 ? <div className="col-span-3 px-4 py-8 text-sm text-slate-500">{emptyText}</div> : null}
          {!loading
            ? notes.map((note) => (
                <div
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditModal(note)}
                  onKeyDown={(e) => { if (e.key === "Enter") openEditModal(note); }}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors cursor-pointer ${selectedNote?.id === note.id ? "border-white/20 bg-white/[0.08]" : "border-white/10 bg-[#1a1d28] hover:border-white/20 hover:bg-[#1e2130]"}`}
                >
                  <div className="truncate font-medium text-slate-100">{note.title}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{note.content || "暂无正文"}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {note.tags.length > 0 ? note.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!onFilterTagsChange) return;
                          const next = filterTags.includes(tag)
                            ? filterTags.filter((t) => t !== tag)
                            : [...filterTags, tag];
                          onFilterTagsChange(next);
                        }}
                        className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                          filterTags.includes(tag)
                            ? "border-blue-400/30 bg-blue-500/20 text-blue-300"
                            : "border-white/10 text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        {tag}
                      </button>
                    )) : <span className="text-[11px] text-slate-600">无标签</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{formatDateTime(note.updatedAt)}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEditModal(note); }}
                      className="rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      编辑
                    </button>
                  </div>
                </div>
              ))
            : null}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-xs text-slate-400">
          <span>共 {total} 条，第 {page} / {Math.ceil(total / pageSize)} 页</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30"
            >
              上一页
            </button>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => onPageChange?.(page + 1)}
              className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30"
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      {formModalOpen ? (
        <Modal
          title={isEditing ? "编辑笔记" : "新建笔记"}
          description="支持 Markdown，正文首行默认作为标题，自动保存已开启。"
          onClose={() => setFormModalOpen(false)}
        >
          <form onSubmit={(e) => { e.preventDefault(); onSave(e); }} className="space-y-4">
            <Field label="标题">
              <input
                value={draft.title}
                onChange={(event) => onDraftChange("title", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                placeholder="默认取正文第一行，也可以手动修改"
              />
            </Field>
            <Field label="Markdown 正文">
              <textarea
                value={draft.content}
                onChange={(event) => onDraftChange("content", event.target.value)}
                className="min-h-[380px] w-full rounded-lg border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-slate-400"
                placeholder="# 会话入口梳理&#10;&#10;直接开始写，系统会自动保存。"
              />
            </Field>
            <Field label="标签">
              <input
                value={draft.tags}
                onChange={(event) => onDraftChange("tags", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                placeholder="逗号分隔，例如：ui, session"
              />
            </Field>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{saving ? "自动保存中..." : "已开启自动保存"}</span>
            </div>
            {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {showCreateTodo && isEditing && selectedNote ? (
                  <button
                    type="button"
                    disabled={creatingTodo}
                    onClick={onCreateTodo}
                    className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200 disabled:opacity-50"
                  >
                    {creatingTodo ? "创建中..." : "创建任务"}
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2">
                {isEditing && selectedNote ? (
                  <button
                    type="button"
                    disabled={deletingNoteId === selectedNote.id}
                    onClick={() => onDelete(selectedNote)}
                    className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-50"
                  >
                    {deletingNoteId === selectedNote.id ? "删除中..." : "删除笔记"}
                  </button>
                ) : null}
                <button type="button" onClick={() => setFormModalOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                  关闭
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

function TodoPanel({
  project,
  notes,
  todos,
  selectedTodo,
  loading,
  error,
  draft,
  saving,
  deletingTodoId,
  total = 0,
  page = 1,
  pageSize = 12,
  onPageChange,
  onCreate,
  onSelect,
  onDraftChange,
  onSave,
  onDelete,
  onOpenSession,
  searchQuery = "",
  filterTags = [],
  statuses = [],
  availableTags = [],
  onSearchChange,
  onFilterTagsChange,
  onStatusesChange,
  onStatusChange
}: {
  project: ProjectSummary | null;
  notes: NoteSummary[];
  todos: TodoSummary[];
  selectedTodo: TodoSummary | null;
  loading: boolean;
  error: string | null;
  draft: TodoDraft;
  saving: boolean;
  deletingTodoId: string | null;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onCreate: () => void;
  onSelect: (todo: TodoSummary) => void;
  onDraftChange: (field: keyof TodoDraft, value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (todo: TodoSummary) => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
  searchQuery?: string;
  filterTags?: string[];
  statuses?: TodoStatus[];
  availableTags?: string[];
  onSearchChange?: (query: string) => void;
  onFilterTagsChange?: (tags: string[]) => void;
  onStatusesChange?: (statuses: TodoStatus[]) => void;
  onStatusChange?: (todo: TodoSummary, newStatus: TodoStatus) => void;
}) {
  if (!project) {
    return <EmptyProjectNotice onCreateProject={() => undefined} />;
  }

  const [formModalOpen, setFormModalOpen] = useState(false);
  const prevSavingRef = useRef(saving);

  useEffect(() => {
    if (prevSavingRef.current && !saving && !error) {
      setFormModalOpen(false);
    }
    prevSavingRef.current = saving;
  }, [saving, error]);

  const noteOptions = notes.map((note) => ({ id: note.id, title: note.title }));
  const linkedNote = draft.sourceNoteId ? noteOptions.find((note) => note.id === draft.sourceNoteId) ?? null : null;
  const isEditing = selectedTodo !== null;

  const openCreateModal = () => {
    onCreate();
    setFormModalOpen(true);
  };

  const openEditModal = (todo: TodoSummary) => {
    onSelect(todo);
    setFormModalOpen(true);
  };

  const statusStyle = (status: TodoStatus) => {
    if (status === "completed") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
    if (status === "in_progress") return "border-blue-400/40 bg-blue-400/10 text-blue-300";
    return "border-white/10 text-slate-300";
  };

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium">项目任务</div>
            <div className="mt-1 text-xs text-slate-500">任务属于具体项目，可保留状态、标签和来源笔记关联。</div>
          </div>
          <button onClick={openCreateModal} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-950">
            新建任务
          </button>
        </div>
        <div className="border-b border-white/10 px-4 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
              placeholder="搜索任务标题、描述或标签..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {todoStatusOptions.map((option) => {
              const active = statuses.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? statuses.filter((status) => status !== option.value)
                      : [...statuses, option.value];
                    onStatusesChange?.(next);
                  }}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    active ? "border-violet-400/40 bg-violet-400/10 text-violet-300" : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {availableTags.map((tag) => {
                const active = filterTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const next = active ? filterTags.filter((t) => t !== tag) : [...filterTags, tag];
                      onFilterTagsChange?.(next);
                    }}
                    className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                      active ? "border-blue-400/40 bg-blue-400/10 text-blue-300" : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
          <div className="text-[11px] text-slate-500">
            {todos.length} 条结果{(searchQuery || filterTags.length > 0 || statuses.length !== todoStatusOptions.length) ? "（已筛选）" : ""}
          </div>
        </div>
        <div className="min-h-[200px] grid grid-cols-3 gap-3 p-3 items-start">
          {loading ? <div className="col-span-3 px-4 py-6 text-sm text-slate-400">项目任务加载中...</div> : null}
          {!loading && todos.length === 0 ? <div className="col-span-3 px-4 py-8 text-sm text-slate-500">当前项目还没有任务，可以手动创建或从笔记生成。</div> : null}
          {!loading
            ? todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${selectedTodo?.id === todo.id ? "border-white/20 bg-white/[0.08]" : "border-white/10 bg-[#1a1d28] hover:border-white/20 hover:bg-[#1e2130]"}`}
                >
                  <div className="flex items-center justify-between">
                    <select
                      value={todo.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onStatusChange?.(todo, e.target.value as TodoStatus);
                      }}
                      className={`rounded-full border px-2 py-0.5 text-[11px] cursor-pointer appearance-none bg-transparent outline-none ${statusStyle(todo.status)}`}
                    >
                      {todoStatusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#1a1d28] text-slate-200">{opt.label}</option>
                      ))}
                    </select>
                    <span className="text-[11px] text-slate-500">{formatTodoTime(todo)}</span>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditModal(todo)}
                    onKeyDown={(e) => { if (e.key === "Enter") openEditModal(todo); }}
                    className="mt-1.5 cursor-pointer"
                  >
                    <div className="truncate font-medium text-slate-100">{todo.title}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{todo.description || "暂无描述"}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {todo.tags.length > 0 && todo.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const active = filterTags.includes(tag);
                          const next = active ? filterTags.filter((t) => t !== tag) : [...filterTags, tag];
                          onFilterTagsChange?.(next);
                        }}
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer ${
                          filterTags.includes(tag) ? "border-blue-400/40 bg-blue-400/10 text-blue-300" : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {todo.sourceNoteId && <span className="text-[10px] text-slate-600">关联笔记</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSession("todo", todo.id);
                      }}
                      className="rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-200 hover:bg-emerald-400/15"
                    >
                      创建会话
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(todo);
                      }}
                      className="rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      disabled={deletingTodoId === todo.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(todo);
                      }}
                      className="rounded border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-200 hover:bg-red-500/15 disabled:opacity-50"
                    >
                      {deletingTodoId === todo.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>
              ))
            : null}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-xs text-slate-400">
          <span>共 {total} 条，第 {page} / {Math.ceil(total / pageSize)} 页</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30"
            >
              上一页
            </button>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => onPageChange?.(page + 1)}
              className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30"
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      {formModalOpen ? (
        <Modal
          title={isEditing ? "编辑任务" : "新建任务"}
          description="管理任务状态、标签和来源笔记关联。"
          onClose={() => setFormModalOpen(false)}
        >
          <form onSubmit={(e) => { e.preventDefault(); onSave(e); }} className="space-y-4">
            <Field label="标题">
              <input
                value={draft.title}
                onChange={(event) => onDraftChange("title", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                placeholder="例如：补完项目页 notes/todos 面板"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="状态">
                <Select
                  value={draft.status}
                  onChange={(value) => onDraftChange("status", value)}
                  options={todoStatusOptions}
                />
              </Field>
              <Field label="来源笔记">
                <Select
                  value={draft.sourceNoteId}
                  onChange={(value) => onDraftChange("sourceNoteId", value)}
                  options={[{ value: "", label: "不关联" }, ...noteOptions.map((n) => ({ value: n.id, label: n.title }))]}
                />
              </Field>
            </div>
            <Field label="标签">
              <input
                value={draft.tags}
                onChange={(event) => onDraftChange("tags", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                placeholder="逗号分隔，例如：phase2, api"
              />
            </Field>
            <Field label="描述">
              <textarea
                value={draft.description}
                onChange={(event) => onDraftChange("description", event.target.value)}
                className="min-h-40 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                placeholder="补充任务目标、验收点或限制。"
              />
            </Field>
            {linkedNote ? <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">当前关联笔记：{linkedNote.title}</p> : null}
            {selectedTodo ? (
              <div className="flex flex-wrap gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                <span>创建于：{formatDateTime(selectedTodo.createdAt)}</span>
                <span>{selectedTodo.status === "completed" ? "完成于" : "更新于"}：{formatDateTime((selectedTodo.status === "completed" ? selectedTodo.completedAt : selectedTodo.updatedAt) ?? selectedTodo.updatedAt)}</span>
              </div>
            ) : null}
            {selectedTodo?.latestSessionResult ? (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-50">
                <div className="font-medium text-emerald-100">最新会话结果</div>
                <div className="mt-2 text-emerald-100">{selectedTodo.latestSessionResult.sessionName}</div>
                <div className="mt-1 whitespace-pre-wrap text-emerald-50/90">{selectedTodo.latestSessionResult.summary}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-emerald-100/80">
                  <span>状态：{selectedTodo.latestSessionResult.status}</span>
                  <span>退出码：{selectedTodo.latestSessionResult.exitCode ?? "无"}</span>
                  <span>更新：{formatDateTime(selectedTodo.latestSessionResult.updatedAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenSession("todo", selectedTodo.id, selectedTodo.latestSessionResult?.sessionId)}
                  className="mt-3 rounded-md border border-emerald-200/20 px-2 py-1 text-xs text-emerald-50 hover:bg-white/5"
                >
                  打开会话
                </button>
              </div>
            ) : null}
            {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setFormModalOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                  关闭
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
                  {saving ? "保存中..." : isEditing ? "保存修改" : "创建任务"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

// ─── Memory panels ───

const memoryTypeLabels: Record<MemoryType, string> = {
  user: "用户",
  feedback: "反馈",
  project: "项目",
  reference: "参考"
};

const memoryTypeColors: Record<MemoryType, string> = {
  user: "bg-blue-500/10 text-blue-300",
  feedback: "bg-amber-500/10 text-amber-300",
  project: "bg-emerald-500/10 text-emerald-300",
  reference: "bg-purple-500/10 text-purple-300"
};

function ProjectMemoryPanel({ projectId }: { projectId: string }) {
  const [claudeMd, setClaudeMd] = useState("");
  const [claudeMdLoading, setClaudeMdLoading] = useState(true);
  const [savingClaudeMd, setSavingClaudeMd] = useState(false);
  const [claudeMdEditing, setClaudeMdEditing] = useState(false);
  const [claudeMdDraft, setClaudeMdDraft] = useState("");

  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [ruleOperationName, setRuleOperationName] = useState<string | null>(null);

  const [memories, setMemories] = useState<MemorySummary[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [memoryOperationName, setMemoryOperationName] = useState<string | null>(null);

  const [memoryFormOpen, setMemoryFormOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryDetail | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<{ name: string; type: MemoryType; description: string; content: string }>({
    name: "", type: "reference", description: "", content: ""
  });
  const [savingMemory, setSavingMemory] = useState(false);

  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleSummary | null>(null);
  const [ruleContentDraft, setRuleContentDraft] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  const { confirm, prompt } = useConfirmDialog();

  useEffect(() => {
    loadClaudeMd();
    loadRules();
    loadMemories();
  }, [projectId]);

  async function loadClaudeMd() {
    setClaudeMdLoading(true);
    try {
      const data = await getProjectClaudeMd(projectId);
      setClaudeMd(data.content);
      setClaudeMdDraft(data.content);
    } catch { setClaudeMd(""); setClaudeMdDraft(""); }
    finally { setClaudeMdLoading(false); }
  }

  async function loadRules() {
    setRulesLoading(true);
    try {
      const data = await getRules(projectId);
      setRules(data.rules);
      setRulesError(null);
    } catch (error) { setRulesError(formatError(error, "规则加载失败")); }
    finally { setRulesLoading(false); }
  }

  async function loadMemories() {
    setMemoriesLoading(true);
    try {
      const data = await getMemories(projectId);
      setMemories(data.memories);
      setMemoriesError(null);
    } catch (error) { setMemoriesError(formatError(error, "记忆加载失败")); }
    finally { setMemoriesLoading(false); }
  }

  async function handleSaveClaudeMd() {
    setSavingClaudeMd(true);
    try {
      await updateProjectClaudeMd(projectId, { content: claudeMdDraft });
      setClaudeMd(claudeMdDraft);
      setClaudeMdEditing(false);
    } catch (error) { setClaudeMdDraft(formatError(error, "CLAUDE.md 保存失败")); }
    finally { setSavingClaudeMd(false); }
  }

  function startEditClaudeMd() {
    setClaudeMdDraft(claudeMd);
    setClaudeMdEditing(true);
  }

  // ─── Rule handlers ───

  async function handleCreateRule() {
    const name = await prompt("请输入规则文件名（不含 .md 后缀）");
    if (!name) return;
    const trimmedName = name.trim();
    setRuleOperationName(trimmedName);
    setRulesError(null);
    try {
      await createRule(projectId, { name: trimmedName });
      await loadRules();
    } catch (error) { setRulesError(formatError(error, "规则创建失败")); }
    finally { setRuleOperationName(null); }
  }

  function openEditRule(rule: RuleSummary) {
    setEditingRule(rule);
    setRuleContentDraft("");
    setRuleFormOpen(true);
    getRule(projectId, rule.name).then((data) => {
      setRuleContentDraft(data.rule.content);
    }).catch(() => {});
  }

  function openCreateRule() {
    handleCreateRule();
  }

  async function handleSaveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRule) return;
    setSavingRule(true);
    try {
      await updateRule(projectId, editingRule.name, { content: ruleContentDraft });
      setRuleFormOpen(false);
      setEditingRule(null);
      await loadRules();
    } catch (error) { setRulesError(formatError(error, "规则保存失败")); }
    finally { setSavingRule(false); }
  }

  async function handleDeleteRule(rule: RuleSummary) {
    const confirmed = await confirm(`确认删除规则「${rule.name}」？`, { danger: true });
    if (!confirmed) return;
    setRuleOperationName(rule.name);
    setRulesError(null);
    try {
      await deleteRule(projectId, rule.name, { confirmName: rule.name });
      await loadRules();
    } catch (error) { setRulesError(formatError(error, "规则删除失败")); }
    finally { setRuleOperationName(null); }
  }

  // ─── Memory handlers ───

  function openCreateMemory() {
    setEditingMemory(null);
    setMemoryDraft({ name: "", type: "reference", description: "", content: "" });
    setMemoryFormOpen(true);
  }

  async function openEditMemory(memory: MemorySummary) {
    try {
      const data = await getMemory(projectId, memory.name);
      setEditingMemory(data.memory);
      setMemoryDraft({
        name: data.memory.name,
        type: data.memory.type,
        description: data.memory.description,
        content: data.memory.content
      });
      setMemoryFormOpen(true);
    } catch (error) { setMemoriesError(formatError(error, "记忆读取失败")); }
  }

  async function handleSaveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memoryDraft.name.trim()) return;
    setSavingMemory(true);
    try {
      if (editingMemory) {
        await updateMemory(projectId, editingMemory.name, {
          name: memoryDraft.name.trim(),
          type: memoryDraft.type,
          description: memoryDraft.description.trim(),
          content: memoryDraft.content
        });
      } else {
        await createMemory(projectId, {
          name: memoryDraft.name.trim(),
          type: memoryDraft.type,
          description: memoryDraft.description.trim(),
          content: memoryDraft.content
        });
      }
      setMemoryFormOpen(false);
      setEditingMemory(null);
      await loadMemories();
    } catch (error) { setMemoriesError(formatError(error, "记忆保存失败")); }
    finally { setSavingMemory(false); }
  }

  async function handleDeleteMemory(memory: MemorySummary) {
    const confirmed = await confirm(`确认删除记忆「${memory.name}」？`, { danger: true });
    if (!confirmed) return;
    setMemoryOperationName(memory.name);
    setMemoriesError(null);
    try {
      await deleteMemory(projectId, memory.name, { confirmName: memory.name });
      await loadMemories();
    } catch (error) { setMemoriesError(formatError(error, "记忆删除失败")); }
    finally { setMemoryOperationName(null); }
  }

  return (
    <div className="space-y-5">
      {/* CLAUDE.md section */}
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-100">CLAUDE.md</div>
            <div className="mt-1 text-xs text-slate-500">项目根目录的 CLAUDE.md 指令文件，签入代码库。</div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadClaudeMd} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
              ⟳
            </button>
            {claudeMdEditing ? (
              <>
                <button onClick={() => { setClaudeMdEditing(false); setClaudeMdDraft(claudeMd); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">取消</button>
                <button onClick={handleSaveClaudeMd} disabled={savingClaudeMd} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 disabled:opacity-50">
                  {savingClaudeMd ? "保存中..." : "保存"}
                </button>
              </>
            ) : (
              <button onClick={startEditClaudeMd} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">编辑</button>
            )}
          </div>
        </div>
        <div className="p-4">
          {claudeMdLoading ? (
            <div className="py-8 text-center text-sm text-slate-600">加载中...</div>
          ) : claudeMdEditing ? (
            <textarea
              value={claudeMdDraft}
              onChange={(e) => setClaudeMdDraft(e.target.value)}
              rows={16}
              className="w-full resize-y rounded-lg border border-white/10 bg-[#0b0c10] p-3 text-sm text-slate-100 font-mono outline-none focus:border-white/20"
              placeholder="输入 CLAUDE.md 内容..."
            />
          ) : claudeMd ? (
            <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono max-h-96 overflow-y-auto">{claudeMd}</pre>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-slate-500">还没有 CLAUDE.md 文件。</div>
          )}
        </div>
      </section>

      {/* Rules section */}
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-100">规则文件</div>
            <div className="mt-1 text-xs text-slate-500">来源：项目 .claude/rules/*.md，签入代码库。</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadRules} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
              ⟳
            </button>
            <button onClick={openCreateRule} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950">新建</button>
          </div>
        </div>
        <div className="p-4">
          {rulesError ? <p className="mb-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">{rulesError}</p> : null}
          {rulesLoading ? <div className="py-8 text-center text-sm text-slate-600">规则加载中...</div> : null}
          {!rulesLoading && rules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-slate-500">还没有规则文件。</div>
          ) : null}
          {!rulesLoading && rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((rule) => {
                const busy = ruleOperationName === rule.name;
                return (
                  <div key={rule.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                    <div>
                      <span className="font-medium text-slate-100">{rule.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditRule(rule)} disabled={busy} className="rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50">编辑</button>
                      <button onClick={() => handleDeleteRule(rule)} disabled={busy} className="rounded border border-white/10 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50">{busy ? "删除中..." : "删除"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* Auto memory section */}
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-100">自动记忆</div>
            <div className="mt-1 text-xs text-slate-500">来源：~/.claude/projects/&lt;project&gt;/memory/，Claude Code 自动生成。</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadMemories} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
              ⟳
            </button>
            <button onClick={openCreateMemory} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950">新建</button>
          </div>
        </div>
        <div className="p-4">
          {memoriesError ? <p className="mb-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">{memoriesError}</p> : null}
          {memoriesLoading ? <div className="py-8 text-center text-sm text-slate-600">记忆加载中...</div> : null}
          {!memoriesLoading && memories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-slate-500">还没有自动记忆文件。</div>
          ) : null}
          {!memoriesLoading && memories.length > 0 ? (
            <div className="space-y-2">
              {memories.map((memory) => {
                const busy = memoryOperationName === memory.name;
                return (
                  <div key={memory.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-100 truncate">{memory.name}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${memoryTypeColors[memory.type]}`}>
                          {memoryTypeLabels[memory.type]}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{memory.description}</div>
                    </div>
                    <div className="ml-3 flex shrink-0 gap-1">
                      <button onClick={() => openEditMemory(memory)} disabled={busy} className="rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50">编辑</button>
                      <button onClick={() => handleDeleteMemory(memory)} disabled={busy} className="rounded border border-white/10 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50">{busy ? "删除中..." : "删除"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* Rule edit modal */}
      {ruleFormOpen ? (
        <Modal title={`编辑规则：${editingRule?.name ?? ""}`} onClose={() => { setRuleFormOpen(false); setEditingRule(null); }}>
          <form onSubmit={handleSaveRule} className="space-y-4">
            <Field label="Markdown 内容">
              <textarea
                value={ruleContentDraft}
                onChange={(e) => setRuleContentDraft(e.target.value)}
                rows={16}
                className="w-full resize-y rounded-lg border border-white/10 bg-[#0b0c10] p-3 text-sm text-slate-100 font-mono outline-none focus:border-white/20"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setRuleFormOpen(false); setEditingRule(null); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">取消</button>
              <button type="submit" disabled={savingRule} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 disabled:opacity-50">{savingRule ? "保存中..." : "保存"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Memory form modal */}
      {memoryFormOpen ? (
        <Modal title={editingMemory ? "编辑记忆" : "新建记忆"} description="编辑 frontmatter 字段和正文内容" onClose={() => { setMemoryFormOpen(false); setEditingMemory(null); }}>
          <form onSubmit={handleSaveMemory} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="文件名（不含 .md）">
                <input
                  value={memoryDraft.name}
                  onChange={(e) => setMemoryDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#0b0c10] px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/20"
                  placeholder="my-memory"
                />
              </Field>
              <Field label="类型">
                <select
                  value={memoryDraft.type}
                  onChange={(e) => setMemoryDraft((d) => ({ ...d, type: e.target.value as MemoryType }))}
                  className="w-full rounded-lg border border-white/10 bg-[#0b0c10] px-3 py-2 text-sm text-slate-100 outline-none"
                >
                  <option value="user">用户 (user)</option>
                  <option value="feedback">反馈 (feedback)</option>
                  <option value="project">项目 (project)</option>
                  <option value="reference">参考 (reference)</option>
                </select>
              </Field>
              <Field label="描述">
                <input
                  value={memoryDraft.description}
                  onChange={(e) => setMemoryDraft((d) => ({ ...d, description: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#0b0c10] px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/20"
                  placeholder="简要描述"
                />
              </Field>
            </div>
            <Field label="Markdown 正文">
              <textarea
                value={memoryDraft.content}
                onChange={(e) => setMemoryDraft((d) => ({ ...d, content: e.target.value }))}
                rows={14}
                className="w-full resize-y rounded-lg border border-white/10 bg-[#0b0c10] p-3 text-sm text-slate-100 font-mono outline-none focus:border-white/20"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setMemoryFormOpen(false); setEditingMemory(null); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">取消</button>
              <button type="submit" disabled={savingMemory} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 disabled:opacity-50">{savingMemory ? "保存中..." : "保存"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function GlobalMemoryPanel({ selectedProject, onRefresh }: { selectedProject: ProjectSummary | null; onRefresh?: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => { loadContent(); }, []);

  async function loadContent() {
    setLoading(true);
    try {
      const data = await getGlobalClaudeMd();
      setContent(data.content);
      setEditDraft(data.content);
    } catch { setContent(""); setEditDraft(""); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateGlobalClaudeMd({ content: editDraft });
      setContent(editDraft);
      setEditing(false);
    } catch { setEditDraft(formatError(new Error("保存失败"), "全局 CLAUDE.md 保存失败")); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-100">全局 CLAUDE.md</div>
            <div className="mt-1 text-xs text-slate-500">来源：~/.claude/CLAUDE.md，所有项目的全局指令。</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if (onRefresh) onRefresh(); else loadContent(); }} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200" title="刷新">
              ⟳
            </button>
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setEditDraft(content); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">取消</button>
                <button onClick={handleSave} disabled={saving} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 disabled:opacity-50">{saving ? "保存中..." : "保存"}</button>
              </>
            ) : (
              <button onClick={() => { setEditDraft(content); setEditing(true); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">编辑</button>
            )}
          </div>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-600">加载中...</div>
          ) : editing ? (
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={12}
              className="w-full resize-y rounded-lg border border-white/10 bg-[#0b0c10] p-3 text-sm text-slate-100 font-mono outline-none focus:border-white/20"
              placeholder="输入全局 CLAUDE.md 内容..."
            />
          ) : content ? (
            <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono max-h-80 overflow-y-auto">{content}</pre>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-slate-500">还没有全局 CLAUDE.md 文件。</div>
          )}
        </div>
      </section>

      {selectedProject ? (
        <section className="rounded-xl border border-white/10 bg-[#151821]">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-medium text-slate-100">项目记忆</div>
            <div className="mt-1 text-xs text-slate-500">进入项目「{selectedProject.name}」的记忆标签页管理 CLAUDE.md、规则和自动记忆。</div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatTodoStatus(status: TodoStatus) {
  const labels: Record<TodoStatus, string> = {
    draft: "草稿",
    pending: "待处理",
    in_progress: "进行中",
    completed: "已完成"
  };

  return labels[status];
}

function readChatFile(file: File) {
  if (!isTextChatFile(file)) {
    throw new Error("仅支持文本文件");
  }

  if (file.size > maxChatFileSize) {
    throw new Error("文件不能超过 200KB");
  }

  return file.text().then((textContent) => ({
    name: file.name,
    mimeType: file.type || guessMimeType(file.name),
    size: file.size,
    textContent
  }));
}

function toChatAttachment(file: ChatFileDraft): ChatAttachment {
  return file;
}

function isTextChatFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return textFileExtensions.has(extension) || file.type.startsWith("text/") || file.type === "application/json";
}

function guessMimeType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "json") return "application/json";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "ts" || extension === "tsx") return "text/typescript";
  if (extension === "js" || extension === "jsx" || extension === "mjs" || extension === "cjs") return "text/javascript";
  if (extension === "yml" || extension === "yaml") return "text/yaml";
  return "text/plain";
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSuggestionTargetLabel(type: ChatArtifactSuggestion["type"]) {
  if (type === "note") {
    return "笔记";
  }

  if (type === "todo") {
    return "任务";
  }

  return "Prompt 草稿";
}

function toolLabel(name: string) {
  switch (name) {
    case "search_notes": return "搜索笔记";
    case "create_note": return "创建笔记";
    case "list_todos": return "查看任务";
    case "create_todo": return "创建任务";
    case "create_prompt_draft": return "保存 Prompt";
    case "list_projects": return "查看项目";
    case "list_worktrees": return "查看 Worktree";
    case "list_prompt_drafts": return "查看 Prompt";
    case "Skill": return "加载技能";
    case "bash": return "执行命令";
    default: return name;
  }
}

function formatToolSummary(name: string, input: Record<string, unknown>) {
  if (name === "Skill") return String(input.skill ?? "").slice(0, 80);
  if (name === "bash") return String(input.command ?? "").slice(0, 80);
  const title = (input.title || input.query || "") as string;
  return title ? String(title).slice(0, 80) : name;
}

function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatTodoTime(todo: TodoSummary) {
  const label = todo.status === "completed" ? "完成于" : "更新于";
  const value = todo.status === "completed" ? todo.completedAt ?? todo.updatedAt : todo.updatedAt;
  return `${label} ${formatDateTime(value)}`;
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
