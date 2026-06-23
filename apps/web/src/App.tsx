import { Moon, Sun, TerminalSquare } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type {
  ExecutionListItem,
  ChatAttachment,
  ChatSkill,
  ChatMessageSummary,
  ChatSessionSummary,
  ChatStreamEvent,
  ChatToolCall,
  ChatToolResult,
  InstallTarget,
  CreateMemoryRequest,
  CreateRuleRequest,
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
  SessionListItem,
  SessionSource,
  SessionStreamEvent,
  SessionSummary,
  SkillSummary,
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
  getChatSession,
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
  getSession,
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
  updateWorkspaceTerminal,
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
import { createClientId } from "./lib/utils";
import { useThemeSettings } from "./theme";
import type {
  ApiState,
  ChatFileDraft,
  ChatStreamPendingMessage,
  ExecutionModalMode,
  HomeMode,
  NoteDraft,
  ProjectDraft,
  ProjectMode,
  ProjectTab,
  SelectedExecution,
  SkillDocumentEditorState,
  SkillTransferTarget,
  SkillTransferMode,
  StreamingBlock,
  TodoDraft,
  WorkbenchTab,
  WorkspaceScope,
  WorkspaceTerminalContext,
  WorkspaceTerminalOpenOptions,
  WorktreeDraft,
} from "./lib/types";
import {
  emptyNoteDraft,
  emptyProjectDraft,
  emptySessionEditorDraft,
  emptyTodoDraft,
  emptyWorktreeDraft,
  noteDraftToRequest,
  noteToDraft,
  projectDraftToRequest,
  projectToDraft,
  syncNoteTitleFromContent,
  todoDraftToRequest,
  todoToDraft,
  worktreeDraftToRequest,
  buildSessionDraft,
  promptDraftToSessionDraft,
  sessionToDraft,
  sessionDraftToPromptDraftRequest,
  sessionDraftToCreateSessionRequest,
} from "./lib/draft-utils";
import {
  formatDateTime,
  formatTodoTime,
  formatError,
  formatChatStreamError,
  formatFileSize,
  formatSuggestionTargetLabel,
  readChatFile,
  toChatAttachment,
  toolLabel,
  formatToolSummary,
} from "./lib/format-utils";
import { Field, DetailRow, DetailCard, CompactMetaPill } from "./components/shared/DetailComponents";
import { StatusPill, WorktreeStatusPill, SessionStatusPill } from "./components/shared/StatusPills";
import { NotePanel } from "./features/notes/NotePanel";
import { TodoPanel } from "./features/todos/TodoPanel";
import { Modal } from "./features/shared/Modal";
import { EmptyProjectNotice } from "./features/shared/EmptyProjectNotice";
import { PathBlock } from "./features/shared/PathBlock";
import { TopModeNav } from "./features/navigation/TopModeNav";
import { ProjectMenu } from "./features/navigation/ProjectMenu";
import { HomeWorkspace } from "./features/home/HomeWorkspace";
import { ProjectWorkspacePage, ProjectFormModal, WorktreeCreateModal } from "./features/project/ProjectWorkspacePage";
import { HomeChatWorkspace, buildVisibleChatMessages, upsertChatMessage, deriveChatSessionTitle } from "./features/chat/HomeChatWorkspace";
import { HomeOverviewWorkspace } from "./features/overview/HomeOverviewWorkspace";
import { GlobalSkillPanel } from "./features/skills/GlobalSkillPanel";
import { SkillStorePanel } from "./features/skills/SkillStorePanel";
import { ProjectSkillPanel } from "./features/skills/ProjectSkillPanel";
import { SkillTransferModal } from "./features/skills/SkillTransferModal";
import { WorktreePanel } from "./features/worktrees/WorktreePanel";
import { ProjectMemoryPanel } from "./features/memory/ProjectMemoryPanel";
import { GlobalMemoryPanel } from "./features/memory/GlobalMemoryPanel";

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




export function App() {
  const { uiTheme, toggleUiTheme } = useThemeSettings();
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
  const [pendingChatMessages, setPendingChatMessages] = useState<ChatStreamPendingMessage[]>([]);
  const [chatScrollSignal, setChatScrollSignal] = useState(0);
  const [chatMessagesLoading, setChatMessagesLoading] = useState(false);
  const [chatMessagesVersion, setChatMessagesVersion] = useState(0);
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
  const [activeSessionProjectId, setActiveSessionProjectId] = useState<string | null>(null);
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
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<SessionSummary | null>(null);
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
        setChatSessions(chatData.chatSessions.map((s) => ({ ...s, messages: [] as ChatMessageSummary[] })));
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
  const selectedSession = selectedSessionDetail;
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
    const projectId = executionModalMode === "session" && activeSessionProjectId
      ? activeSessionProjectId
      : selectedProjectId;

    if (!projectId || !selectedSessionId) {
      setSelectedSessionDetail(null);
      return;
    }

    let cancelled = false;

    getSession(projectId, selectedSessionId)
      .then((data) => {
        if (!cancelled) {
          setSelectedSessionDetail(data.session);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedSessionDetail(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, activeSessionProjectId, selectedSessionId, executionModalMode]);

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

  // 选中聊天会话时按需加载消息历史
  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    let cancelled = false;
    setChatMessagesLoading(true);

    getChatSession(selectedChatId)
      .then((data) => {
        if (cancelled) return;
        setChatSessions((prev) => {
          const index = prev.findIndex((s) => s.id === selectedChatId);
          if (index === -1) return prev;
          const updated = [...prev];
          updated[index] = data.chatSession;
          return updated;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChatMessagesLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedChatId, chatMessagesVersion]);

  const databaseInfo = apiState.meta?.database ?? null;
  const runningSessionCount = sessions.filter((session) => session.status === "running" || session.status === "queued").length;
  const recentProjects = projects.slice(0, 5);
  const homeMode = homeModes.find((mode) => mode.id === activeHomeMode) ?? homeModes[0];
  const selectedChat = chatSessions.find((session) => session.id === selectedChatId) ?? chatSessions[0] ?? null;
  const featureCards = [
    { title: "项目", value: String(projects.length), detail: "已接入项目 CRUD 和目录绑定" },
    { title: "Worktree", value: String(worktrees.length), detail: selectedProject ? "当前项目 worktree" : "选择项目后查看" },
    { title: "运行中会话", value: String(runningSessionCount), detail: "真实代码会话与终端已接入" },
    { title: "MySQL", value: databaseInfo?.connected ? "已连接" : "等待中", detail: databaseInfo ? `${databaseInfo.engine} @ ${databaseInfo.host}/${databaseInfo.database}` : "等待后端" }
  ];

  const visibleChatMessages = selectedChat
    ? buildVisibleChatMessages(selectedChat, pendingChatMessages.filter((message) => message.chatSessionId === selectedChat.id))
    : [];

  const isStreamingSelectedChat = Boolean(streamingChatId && selectedChat?.id === streamingChatId);

  function updateChatSessionState(chatSessionId: string, updater: (session: ChatSessionSummary) => ChatSessionSummary) {
    setChatSessions((prev) => {
      const index = prev.findIndex((session) => session.id === chatSessionId);
      if (index === -1) {
        return prev;
      }

      const current = prev[index]!;
      const next = updater(current);
      const remaining = prev.filter((session) => session.id !== chatSessionId);
      return [next, ...remaining];
    });
  }

  function queuePendingChatMessage(message: ChatStreamPendingMessage) {
    setPendingChatMessages((prev) => [...prev.filter((item) => item.id !== message.id), message]);
  }

  function removePendingChatMessage(messageId: string) {
    setPendingChatMessages((prev) => prev.filter((item) => item.id !== messageId));
  }

  function commitChatMessage(chatMessage: ChatMessageSummary) {
    updateChatSessionState(chatMessage.chatSessionId, (session) => ({
      ...session,
      messages: upsertChatMessage(session.messages, chatMessage),
      updatedAt: chatMessage.createdAt
    }));
  }

  function requestChatScrollToBottom() {
    setChatScrollSignal((prev) => prev + 1);
  }

  function pushLocalChatError(chatSessionId: string, rawMessage: string) {
    const formatted = formatChatStreamError(rawMessage);
    const createdAt = new Date().toISOString();

    queuePendingChatMessage({
      id: createClientId("local-error-"),
      chatSessionId,
      role: "assistant",
      content: `::chat-error::${JSON.stringify(formatted)}`,
      attachments: [],
      createdAt
    });
    updateChatSessionState(chatSessionId, (session) => ({
      ...session,
      updatedAt: createdAt
    }));
    setChatError(formatted.summary);
    requestChatScrollToBottom();
  }

  async function reloadChatSessions(preferredChatId?: string | null) {
    setChatLoading(true);

    try {
      const data = await getChatSessions();
      const nextChat =
        (preferredChatId ? data.chatSessions.find((session) => session.id === preferredChatId) : null) ??
        data.chatSessions.find((session) => session.id === selectedChatId) ??
        data.chatSessions[0] ??
        null;

      setChatSessions((prev) =>
        data.chatSessions.map((item) => {
          const existing = prev.find((s) => s.id === item.id);
          return { ...item, messages: existing?.messages ?? [] };
        })
      );
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
      const [allData, runningData] = await Promise.all([getExecutions(80), getRunningExecutions()]);
      const nextExecution =
        (preferred ? allData.executions.find((item) => item.kind === preferred.kind && item.id === preferred.id) : null) ??
        (selectedExecution ? allData.executions.find((item) => item.kind === selectedExecution.kind && item.id === selectedExecution.id) : null) ??
        allData.executions[0] ??
        null;

      setExecutionItems((current) => mergePreservingStoppingExecutions(current, allData.executions));
      setSelectedExecution(nextExecution ? { kind: nextExecution.kind, id: nextExecution.id } : null);
      setRunningSessions((current) => mergePreservingStoppingExecutions(current, runningData.executions));
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

      setSessions((current) => mergePreservingStoppingSessions(current, data.sessions));
      setSelectedSessionId(nextSession?.id ?? null);

      // 用最新列表数据更新 detail 中的轻量字段（runtimeStatus 等可能已变化）
      if (nextSession && selectedSessionDetail?.id === nextSession.id) {
        const keepLocalStopping =
          selectedSessionDetail.runtimeStatus === "stopping" &&
          (nextSession.runtimeStatus === "running" || nextSession.runtimeStatus === "starting");
        setSelectedSessionDetail((prev) =>
          prev
            ? {
                ...prev,
                name: nextSession.name,
                status: nextSession.status,
                runtimeStatus: keepLocalStopping ? prev.runtimeStatus : nextSession.runtimeStatus,
                summary: nextSession.summary,
                pid: keepLocalStopping ? prev.pid : nextSession.pid,
                exitCode: nextSession.exitCode,
                lastActivityAt: nextSession.lastActivityAt,
                updatedAt: nextSession.updatedAt,
                cwd: nextSession.cwd,
                resolvedWorktreePath: nextSession.resolvedWorktreePath
              }
            : prev
        );
      }

      setSessionsError(null);
    } catch (error) {
      setSessionsError(formatError(error, "会话列表加载失败"));
    } finally {
      setSessionsLoading(false);
    }
  }

  function mergePreservingStoppingSessions(current: SessionListItem[], next: SessionListItem[]) {
    const stoppingIds = new Set(current.filter((item) => item.runtimeStatus === "stopping").map((item) => item.id));

    return next.map((item) =>
      stoppingIds.has(item.id) && (item.runtimeStatus === "running" || item.runtimeStatus === "starting")
        ? { ...item, runtimeStatus: "stopping" as const }
        : item
    );
  }

  function mergePreservingStoppingExecutions(current: ExecutionListItem[], next: ExecutionListItem[]) {
    const stoppingIds = new Set(current.filter((item) => item.kind === "session" && item.runtimeStatus === "stopping").map((item) => item.id));

    return next.map((item) =>
      item.kind === "session" && stoppingIds.has(item.id) && (item.runtimeStatus === "running" || item.runtimeStatus === "starting")
        ? { ...item, runtimeStatus: "stopping" as const }
        : item
    );
  }

  function upsertCreatedSession(session: SessionSummary, project: ProjectSummary) {
    const sessionListItem: SessionListItem = {
      id: session.id,
      projectId: session.projectId,
      provider: session.provider,
      providerThreadId: session.providerThreadId,
      providerMetadata: session.providerMetadata,
      worktreeId: session.worktreeId,
      todoId: session.todoId,
      promptDraftId: session.promptDraftId,
      requestedWorktreeName: session.requestedWorktreeName,
      source: session.source,
      name: session.name,
      status: session.status,
      runtimeStatus: session.runtimeStatus,
      summary: session.summary,
      pid: session.pid,
      cwd: session.cwd,
      resolvedWorktreePath: session.resolvedWorktreePath,
      exitCode: session.exitCode,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
    const executionItem: Extract<ExecutionListItem, { kind: "session" }> = {
      kind: "session",
      id: session.id,
      projectId: session.projectId,
      projectName: project.name,
      provider: session.provider,
      name: session.name,
      status: session.status,
      runtimeStatus: session.runtimeStatus,
      summary: session.summary,
      source: session.source,
      todoId: session.todoId,
      worktreeId: session.worktreeId,
      requestedWorktreeName: session.requestedWorktreeName,
      pid: session.pid,
      cwd: session.cwd,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };

    setSessions((current) => [sessionListItem, ...current.filter((item) => item.id !== session.id)]);
    setExecutionItems((current) => [executionItem, ...current.filter((item) => !(item.kind === "session" && item.id === session.id))]);
    setRunningSessions((current) => [executionItem, ...current.filter((item) => !(item.kind === "session" && item.id === session.id))]);
    setSelectedSessionDetail(session);
  }

  function upsertSessionState(session: SessionSummary, projectName: string | null) {
    const sessionListItem: SessionListItem = {
      id: session.id,
      projectId: session.projectId,
      provider: session.provider,
      providerThreadId: session.providerThreadId,
      providerMetadata: session.providerMetadata,
      worktreeId: session.worktreeId,
      todoId: session.todoId,
      promptDraftId: session.promptDraftId,
      requestedWorktreeName: session.requestedWorktreeName,
      source: session.source,
      name: session.name,
      status: session.status,
      runtimeStatus: session.runtimeStatus,
      summary: session.summary,
      pid: session.pid,
      cwd: session.cwd,
      resolvedWorktreePath: session.resolvedWorktreePath,
      exitCode: session.exitCode,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
    const executionItem: Extract<ExecutionListItem, { kind: "session" }> = {
      kind: "session",
      id: session.id,
      projectId: session.projectId,
      projectName,
      provider: session.provider,
      name: session.name,
      status: session.status,
      runtimeStatus: session.runtimeStatus,
      summary: session.summary,
      source: session.source,
      todoId: session.todoId,
      worktreeId: session.worktreeId,
      requestedWorktreeName: session.requestedWorktreeName,
      pid: session.pid,
      cwd: session.cwd,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };

    setSessions((current) => [sessionListItem, ...current.filter((item) => item.id !== session.id)]);
    setExecutionItems((current) => [executionItem, ...current.filter((item) => !(item.kind === "session" && item.id === session.id))]);
    setRunningSessions((current) => [executionItem, ...current.filter((item) => !(item.kind === "session" && item.id === session.id))]);
    setSelectedSessionDetail(session);
  }

  function markSessionStoppingLocally(sessionId: string) {
    setSessions((current) =>
      current.map((item) =>
        item.id === sessionId
          ? { ...item, runtimeStatus: "stopping" }
          : item
      )
    );
    setExecutionItems((current) =>
      current.map((item) =>
        item.kind === "session" && item.id === sessionId
          ? { ...item, runtimeStatus: "stopping" }
          : item
      )
    );
    setRunningSessions((current) =>
      current.map((item) => (item.kind === "session" && item.id === sessionId ? { ...item, runtimeStatus: "stopping" } : item))
    );
    setSelectedSessionDetail((current) => (current?.id === sessionId ? { ...current, runtimeStatus: "stopping" } : current));
  }

  function removeSessionLocally(sessionId: string) {
    setSessions((current) => current.filter((item) => item.id !== sessionId));
    setExecutionItems((current) => current.filter((item) => !(item.kind === "session" && item.id === sessionId)));
    setRunningSessions((current) => current.filter((item) => !(item.kind === "session" && item.id === sessionId)));
    setSelectedSessionDetail((current) => (current?.id === sessionId ? null : current));
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
      if (field === "provider" && typeof value === "string" && (value === "claude" || value === "codex")) {
        return {
          ...current,
          provider: value
        };
      }

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

  async function handleInstallStoreSkill(skill: StoreSkillStatus, target: InstallTarget) {
    const targetLabelMap: Record<InstallTarget, string> = {
      "claude-global": "全局 Claude Skills",
      "claude-project": "当前项目 Claude Skills",
      "codex-global": "全局 Codex Skills",
      "codex-project": "当前项目 Codex Skills",
      chat: "AI Chat"
    };
    const targetLabel = targetLabelMap[target];

    if ((target === "claude-project" || target === "codex-project") && !selectedProject) {
      setStoreSkillsError("安装到项目目标前请先选择一个项目");
      return;
    }

    const ok = await confirm(`确认将「${skill.skill.name}」安装到 ${targetLabel}？`);

    if (!ok) {
      return;
    }

    setStoreSkillOperationName(skill.skill.name);
    setStoreSkillsError(null);

    try {
      await installStoreSkill(skill.skill.name, {
        targets: [target],
        projectId: target === "claude-project" || target === "codex-project" ? selectedProject?.id : undefined,
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
      setChatSessions((prev) => [data.chatSession, ...prev.filter((session) => session.id !== data.chatSession.id)]);
      setSelectedChatId(data.chatSession.id);
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
        setChatSessions((prev) => [created.chatSession, ...prev.filter((session) => session.id !== created.chatSession.id)]);
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
        const truncatedData = await truncateChatMessages(targetChatId, editingMessageId!);
        setChatSessions((prev) => {
          const index = prev.findIndex((s) => s.id === targetChatId);
          if (index === -1) return prev;
          const updated = [...prev];
          updated[index] = truncatedData.chatSession;
          return updated;
        });
      } catch (error) {
        setChatError(formatError(error, "消息清理失败"));
        return;
      }
    }

    const pendingUserMessage: ChatStreamPendingMessage = {
      id: createClientId("pending-user-"),
      chatSessionId: targetChatId,
      role: "user",
      content,
      attachments,
      createdAt: new Date().toISOString()
    };

    queuePendingChatMessage(pendingUserMessage);

    updateChatSessionState(targetChatId, (session) => ({
      ...session,
      title: deriveChatSessionTitle(session.title, content, attachments),
      updatedAt: pendingUserMessage.createdAt
    }));

    setSendingChat(true);
    setChatError(null);
    setChatDraft("");
    setChatFile(null);
    setEditingMessageId(null);
    setStreamingChatId(targetChatId);
    setStreamingBlocks([]);
    requestChatScrollToBottom();

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
              setStreamingBlocks((prev) => [...prev, { type: "tool", toolCall: event.toolCall as ChatToolCall }]);
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
          case "chat.message_committed":
            if (event.chatMessage) {
              commitChatMessage(event.chatMessage);
              if (event.chatMessage.role === "user") {
                setPendingChatMessages((prev) => prev.filter((message) => !(message.chatSessionId === event.chatMessage!.chatSessionId && message.role === "user" && message.content === event.chatMessage!.content)));
              } else {
                setStreamingBlocks([]);
              }
            }
            break;
          case "chat.done":
            setStreamingChatId(null);
            setSendingChat(false);
            setStreamingBlocks([]);
            removePendingChatMessage(pendingUserMessage.id);
            break;
          case "chat.error":
            setStreamingChatId(null);
            setSendingChat(false);
            setStreamingBlocks([]);
            removePendingChatMessage(pendingUserMessage.id);
            pushLocalChatError(event.chatSessionId, event.message ?? "流式响应出错");
            break;
        }
      },
      (error: Error) => {
        setStreamingChatId(null);
        setSendingChat(false);
        setStreamingBlocks([]);
        removePendingChatMessage(pendingUserMessage.id);
        pushLocalChatError(targetChatId, formatError(error, "消息发送失败"));
      },
      () => {
        removePendingChatMessage(pendingUserMessage.id);
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
      setActiveSessionProjectId(null);
      setWorkspaceTerminalError(null);
      try {
        const data = await getWorkspaceTerminal(execution.id);
        setWorkspaceTerminal({
          id: execution.id,
          projectId: execution.projectId,
          worktreeId: execution.worktreeId,
          requestedWorktreeName: execution.requestedWorktreeName,
          name: execution.name,
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

    if (execution.projectId) {
      setActiveSessionProjectId(execution.projectId);
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
      upsertCreatedSession(data.session, selectedProject);
      setSelectedExecution({ kind: "session", id: data.session.id });
      setSelectedSessionId(data.session.id);
      setSelectedPromptDraftId(data.session.promptDraftId ?? null);
      setSessionDraft(sessionToDraft(data.session, promptDrafts));
      setSessionCreateModalOpen(false);
      setExecutionModalMode("session");
      void Promise.all([
        reloadSessions(selectedProject.id, data.session.id),
        reloadWorktrees(selectedProject.id, data.session.worktreeId ?? selectedWorktreeId),
        data.session.todoId ? projectTodosList.refresh(data.session.todoId) : Promise.resolve(),
        sessionDraft.promptDraftId ? reloadPromptDrafts(selectedProject.id, sessionDraft.promptDraftId) : Promise.resolve()
      ]).catch((error) => {
        setSessionsError(formatError(error, "会话状态刷新失败"));
      });
    } catch (error) {
      setSessionsError(formatError(error, "会话启动失败"));
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleStopSession(session: SessionListItem | Extract<ExecutionListItem, { kind: "session" }>) {
    const targetProjectId = session.projectId;

    if (!targetProjectId) {
      return;
    }

    setUpdatingSessionId(session.id);
    setSessionsError(null);

    try {
      await stopSession(targetProjectId, session.id);
      markSessionStoppingLocally(session.id);
      void Promise.all([
        reloadExecutions({ kind: "session", id: session.id }),
        selectedProjectId === targetProjectId ? reloadSessions(targetProjectId, session.id) : Promise.resolve()
      ]).catch((error) => {
        setSessionsError(formatError(error, "会话状态刷新失败"));
      });
    } catch (error) {
      setSessionsError(formatError(error, "会话停止失败"));
    } finally {
      setUpdatingSessionId(null);
    }
  }

  async function handleSessionRuntimeEvent(event: SessionStreamEvent) {
    const targetProjectId = activeSessionProjectId ?? selectedProject?.id;
    if (!targetProjectId || event.sessionId !== selectedSessionId) {
      return;
    }

    if (event.type === "session.output") {
      return;
    }

    await Promise.all([
      reloadSessions(targetProjectId, event.sessionId),
      reloadExecutions({ kind: "session", id: event.sessionId })
    ]);
  }

  async function handleRenameSession(session: SessionListItem | Extract<ExecutionListItem, { kind: "session" }>) {
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

  async function handleDeleteSession(session: SessionListItem | Extract<ExecutionListItem, { kind: "session" }>) {
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
      removeSessionLocally(session.id);
      void Promise.all([
        reloadExecutions(nextExecution),
        selectedProjectId === targetProjectId ? reloadSessions(targetProjectId, nextSessionId) : Promise.resolve()
      ]).catch((error) => {
        setSessionsError(formatError(error, "会话状态刷新失败"));
      });

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

  async function handleContinueSession(session: SessionListItem | Extract<ExecutionListItem, { kind: "session" }>) {
    const targetProjectId = session.projectId;

    if (!targetProjectId) {
      return;
    }

    setContinuingSessionId(session.id);
    setSessionsError(null);

    try {
      const data = await continueSession(targetProjectId, session.id);
      const projectName = projects.find((project) => project.id === targetProjectId)?.name ?? selectedProject?.name ?? null;
      upsertSessionState(data.session, projectName);
      setSelectedExecution({ kind: "session", id: data.session.id });
      setSelectedSessionId(data.session.id);
      if (selectedProjectId !== targetProjectId) {
        setSelectedProjectId(targetProjectId);
      }
      void Promise.all([
        reloadExecutions({ kind: "session", id: data.session.id }),
        reloadSessions(targetProjectId, data.session.id)
      ]).catch((error) => {
        setSessionsError(formatError(error, "会话状态刷新失败"));
      });
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

  function createWorkspaceTerminalFromExecutionModal() {
    const selectedItem = selectedExecution ? executionItems.find((item) => item.kind === selectedExecution.kind && item.id === selectedExecution.id) ?? null : null;
    const selectedProjectForExecution = selectedItem?.projectId ? projects.find((project) => project.id === selectedItem.projectId) ?? null : null;
    const selectedWorktreeForExecution =
      selectedItem?.worktreeId && selectedItem.projectId === selectedProjectId
        ? worktrees.find((worktree) => worktree.id === selectedItem.worktreeId) ?? null
        : null;
    const projectId = selectedItem ? selectedItem.projectId : selectedProject?.id ?? null;
    const projectName = selectedItem ? selectedItem.projectName ?? selectedProjectForExecution?.name ?? null : selectedProject?.name ?? null;
    const worktreeId = selectedItem ? selectedItem.worktreeId : selectedWorktree?.id ?? null;
    const worktreeName = selectedItem ? selectedWorktreeForExecution?.name ?? null : selectedWorktree?.name ?? null;

    void handleOpenWorkspaceTerminal(
      {
        projectId,
        projectName,
        worktreeId,
        worktreeName,
        requestedWorktreeName: selectedItem?.requestedWorktreeName ?? null
      },
      { forceCreate: true }
    );
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

  async function handleRenameWorkspaceTerminal(execution: Extract<ExecutionListItem, { kind: "workspace-terminal" }>) {
    const nextName = await prompt("请输入新的终端名称", { defaultValue: execution.name });

    if (!nextName || nextName.trim() === execution.name) {
      return;
    }

    setRenamingSessionId(execution.id);
    setWorkspaceTerminalError(null);
    setSessionsError(null);

    try {
      const data = await updateWorkspaceTerminal(execution.id, { name: nextName.trim() });
      setWorkspaceTerminal((current) => (current?.id === data.terminal.id ? data.terminal : current));
      await reloadExecutions({ kind: "workspace-terminal", id: data.terminal.id });
    } catch (error) {
      setWorkspaceTerminalError(formatError(error, "终端重命名失败"));
    } finally {
      setRenamingSessionId(null);
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
    <div className="app-theme flex h-full flex-col">
      <header className="app-header app-border flex flex-wrap items-center gap-2.5 border-b px-4 py-2.5 sm:px-5">
        <div className="mr-1 min-w-44">
          <div className="text-sm font-semibold tracking-wide">Workhorse Station</div>
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
          onOpenChange={setProjectMenuOpen}
          onEnterCurrent={() => {
            if (selectedProject) {
              selectProject(selectedProject);
            }
          }}
          onEnter={(project) => selectProject(project)}
          onCreate={() => {
            setProjectMenuOpen(false);
            startCreateProject();
          }}
        />

        <input
          className="app-input-shell min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none max-md:hidden"
          placeholder="搜索项目、笔记、任务、Skill"
        />
        <button
          type="button"
          onClick={toggleUiTheme}
          className="app-button-secondary flex h-9 w-9 items-center justify-center rounded-lg border"
          aria-label={uiTheme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
          title={uiTheme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
        >
          {uiTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={openSessionViewer}
          className="app-button-secondary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm"
        >
          <TerminalSquare className="h-4 w-4" aria-hidden="true" />
          会话
        </button>
        <StatusPill connected={apiConnected} loading={apiState.loading} />
      </header>

      <main className={workspaceScope === "home" && activeHomeMode === "chat" ? "app-surface min-h-0 flex-1 overflow-hidden" : "app-surface min-h-0 flex-1 overflow-auto p-4 sm:p-5"}>
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
            chatScrollSignal={chatScrollSignal}
            visibleChatMessages={visibleChatMessages}
            isStreamingSelectedChat={isStreamingSelectedChat}
            onChatSelect={(session) => {
              streamAbortRef.current?.();
              setStreamingChatId(null);
              setSelectedChatId(session.id);
              setActiveHomeMode("chat");
            }}
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
            chatMessagesLoading={chatMessagesLoading}
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
            onSendStoreSkillToProject={handleSendStoreSkillToProject}
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
        <Modal
          title={skillDocumentEditor.title}
          description={skillDocumentEditor.scopeLabel}
          onClose={closeSkillDocumentEditor}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeSkillDocumentEditor} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
                取消
              </button>
              <button type="button" disabled={skillDocumentLoading || skillDocumentSaving} onClick={() => void handleSaveSkillDocument()} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50">
                {skillDocumentSaving ? "保存中..." : "保存"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {skillDocumentError ? <p className="app-danger-soft rounded-lg border p-3 text-xs">{skillDocumentError}</p> : null}
            {skillDocumentLoading ? (
              <div className="app-border app-text-faint rounded-lg border p-4 text-sm">文档加载中...</div>
            ) : (
              <textarea
                value={skillDocumentContent}
                onChange={(e) => setSkillDocumentContent(e.target.value)}
                rows={18}
                className="app-input-shell-strong w-full resize-y rounded-lg border p-3 font-mono text-sm outline-none"
              />
            )}
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
          sessionProjectId={activeSessionProjectId}
          draft={sessionDraft}
          error={sessionsError}
          loading={sessionsLoading}
          updatingSessionId={updatingSessionId}
          renamingSessionId={renamingSessionId}
          deletingSessionId={deletingSessionId}
          deletingWorkspaceTerminalId={deletingWorkspaceTerminalId}
          continuingSessionId={continuingSessionId}
          onSelectExecution={(execution) => void handleOpenExecution(execution)}
          onCreateWorkspaceTerminal={createWorkspaceTerminalFromExecutionModal}
          onRenameSession={handleRenameSession}
          onStopSession={handleStopSession}
          onDeleteSession={handleDeleteSession}
          onRenameWorkspaceTerminal={handleRenameWorkspaceTerminal}
          onDeleteWorkspaceTerminal={(execution) => void handleDeleteWorkspaceTerminal(execution)}
          onContinueSession={handleContinueSession}
          onRuntimeEvent={handleSessionRuntimeEvent}
          onRestartWorkspaceTerminal={() => void handleOpenWorkspaceTerminal(workspaceTerminalContext)}
          onStopWorkspaceTerminal={() => void handleStopWorkspaceTerminal()}
          onWorkspaceTerminalRuntimeEvent={handleWorkspaceTerminalRuntimeEvent}
          onClose={() => {
            setExecutionModalMode(null);
            setActiveSessionProjectId(null);
          }}
        />
      ) : null}
    </div>
  );
}
