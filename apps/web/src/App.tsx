import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type {
  ChatArtifactSuggestion,
  ChatAttachment,
  ChatMessageSummary,
  ChatSessionSummary,
  CreateWorktreeRequest,
  HealthResponse,
  ProjectSkillSummary,
  MetaResponse,
  NoteSummary,
  OverviewSessionSummary,
  ProjectSummary,
  PromptDraftSummary,
  SessionSource,
  SessionStreamEvent,
  SessionSummary,
  SkillSummary,
  TodoStatus,
  TodoSummary,
  WorktreeStatus,
  WorktreeSummary
} from "@workhorse-station/shared";
import {
  copyGlobalSkillToProject,
  copyProjectSkillToGlobal,
  createGlobalSkill,
  createGlobalNote,
  createProjectSkill,
  createNote,
  createProject,
  createPromptDraft,
  createSession,
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
  deleteTodo,
  deleteWorktree,
  getChatSessions,
  getHealth,
  getMeta,
  getGlobalNotes,
  getGlobalSkills,
  getNotes,
  getProjectSkills,
  getProjects,
  getPromptDrafts,
  getRunningSessions,
  getSessions,
  getTodos,
  getWorktrees,
  previewPromptDraft,
  renameGlobalSkill,
  renameProjectSkill,
  sendChatMessage,
  stopSession,
  updateGlobalNote,
  updateNote,
  updateProject,
  updatePromptDraft,
  updateSession,
  updateTodo
} from "./api";
import { SessionModal as SessionModalPanel, CreateSessionModal, SessionsWorkspace as SessionsWorkspacePanel, type SessionEditorDraft } from "./session-ui";

type ApiState = {
  health: HealthResponse | null;
  meta: MetaResponse | null;
  loading: boolean;
  error: string | null;
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
type ProjectTab = "overview" | "todos" | "notes" | "skills" | "sessions" | "worktrees";
type SessionView = "terminal" | "history";

const topModes: Array<{ id: HomeMode; label: string; description: string }> = [
  { id: "chat", label: "聊天", description: "左侧聊天会话列表，右侧简洁聊天区" },
  { id: "overview", label: "概览", description: "管理全局笔记、全局 Skill、最近项目和运行中会话" }
];

const homeModes = topModes;

const projectTabs: Array<{ id: ProjectTab; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "todos", label: "任务" },
  { id: "notes", label: "笔记" },
  { id: "skills", label: "Skill" },
  { id: "sessions", label: "会话" },
  { id: "worktrees", label: "Worktree" }
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
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>("overview");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [worktreeDialogOpen, setWorktreeDialogOpen] = useState(false);
  const [sessionCreateModalOpen, setSessionCreateModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedPromptDraftId, setSelectedPromptDraftId] = useState<string | null>(null);
  const [sessionView, setSessionView] = useState<SessionView>("terminal");
  const [sessionLaunchSource, setSessionLaunchSource] = useState<SessionSource>("direct");
  const [sessionDraft, setSessionDraft] = useState<SessionEditorDraft>(emptySessionEditorDraft());
  const [sessionResultDraft, setSessionResultDraft] = useState("");
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
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(emptyNoteDraft());
  const [notesError, setNotesError] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [noteSettingsOpen, setNoteSettingsOpen] = useState(false);
  const [noteTitleLocked, setNoteTitleLocked] = useState(false);
  const noteAutosaveTimerRef = useRef<number | null>(null);
  const noteAutosaveSkipRef = useRef(false);

  const [todos, setTodos] = useState<TodoSummary[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [todoDraft, setTodoDraft] = useState<TodoDraft>(emptyTodoDraft());
  const [todosError, setTodosError] = useState<string | null>(null);
  const [savingTodo, setSavingTodo] = useState(false);
  const [deletingTodoId, setDeletingTodoId] = useState<string | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<PromptDraftSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [runningSessions, setRunningSessions] = useState<OverviewSessionSummary[]>([]);
  const [previewingPromptDraft, setPreviewingPromptDraft] = useState(false);
  const [savingPromptDraft, setSavingPromptDraft] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [updatingSessionId, setUpdatingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [globalNotes, setGlobalNotes] = useState<NoteSummary[]>([]);
  const [globalNotesLoading, setGlobalNotesLoading] = useState(true);
  const [selectedGlobalNoteId, setSelectedGlobalNoteId] = useState<string | null>(null);
  const [globalNoteDraft, setGlobalNoteDraft] = useState<NoteDraft>(emptyNoteDraft());
  const [globalNotesError, setGlobalNotesError] = useState<string | null>(null);
  const [savingGlobalNote, setSavingGlobalNote] = useState(false);
  const [deletingGlobalNoteId, setDeletingGlobalNoteId] = useState<string | null>(null);
  const [globalNoteSettingsOpen, setGlobalNoteSettingsOpen] = useState(false);
  const [globalNoteTitleLocked, setGlobalNoteTitleLocked] = useState(false);
  const globalNoteAutosaveSkipRef = useRef(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteFilterTags, setNoteFilterTags] = useState<string[]>([]);
  const [globalNoteSearchQuery, setGlobalNoteSearchQuery] = useState("");
  const [globalNoteFilterTags, setGlobalNoteFilterTags] = useState<string[]>([]);
  const noteSearchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const globalNoteSearchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const availableNoteTags = (() => {
    const tagSet = new Set<string>();
    for (const note of notes) {
      for (const tag of note.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  })();

  const availableGlobalNoteTags = (() => {
    const tagSet = new Set<string>();
    for (const note of globalNotes) {
      for (const tag of note.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  })();
  const [globalSkills, setGlobalSkills] = useState<SkillSummary[]>([]);
  const [globalSkillsLoading, setGlobalSkillsLoading] = useState(true);
  const [globalSkillsError, setGlobalSkillsError] = useState<string | null>(null);
  const [projectSkills, setProjectSkills] = useState<ProjectSkillSummary[]>([]);
  const [projectSkillsLoading, setProjectSkillsLoading] = useState(false);
  const [projectSkillsError, setProjectSkillsError] = useState<string | null>(null);
  const [selectedProjectSkillName, setSelectedProjectSkillName] = useState<string | null>(null);
  const [skillOperationName, setSkillOperationName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAppState() {
      try {
        const [health, meta, projectsData, chatData, globalNotesData, globalSkillsData] = await Promise.all([getHealth(), getMeta(), getProjects(), getChatSessions(), getGlobalNotes(), getGlobalSkills()]);

        if (cancelled) {
          return;
        }

        const firstProject = projectsData.projects[0] ?? null;
        const firstChat = chatData.chatSessions[0] ?? null;
        const firstGlobalNote = globalNotesData.notes[0] ?? null;
        setApiState({ health, meta, loading: false, error: null });
        setProjects(projectsData.projects);
        setProjectsLoading(false);
        setChatSessions(chatData.chatSessions);
        setGlobalNotes(globalNotesData.notes);
        setSelectedGlobalNoteId(firstGlobalNote?.id ?? null);
        setGlobalNotesLoading(false);
        setGlobalNotesError(null);
        setGlobalSkills(globalSkillsData.skills);
        setGlobalSkillsLoading(false);
        setGlobalSkillsError(null);
        setSelectedChatId(firstChat?.id ?? null);
        setChatLoading(false);
        setChatError(null);

        if (firstProject) {
          setSelectedProjectId(firstProject.id);
          setProjectMode("edit");
          setProjectDraft(projectToDraft(firstProject));
        }

        try {
          const runningData = await getRunningSessions();
          if (!cancelled) {
            setRunningSessions(runningData.sessions);
          }
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
          setGlobalNotesLoading(false);
          setGlobalNotesError(formatError(error, "全局笔记加载失败"));
          setGlobalSkillsLoading(false);
          setGlobalSkillsError(formatError(error, "全局 Skill 加载失败"));
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
      setNotes([]);
      setSelectedNoteId(null);
      setNotesLoading(false);
      setNotesError(null);
      setTodos([]);
      setSelectedTodoId(null);
      setTodosLoading(false);
      setTodosError(null);
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
      setSessionModalOpen(false);
      setSessionDraft(emptySessionEditorDraft());
      setSessionResultDraft("");
      return;
    }

    async function loadProjectResources(projectId: string) {
      setWorktreesLoading(true);
      setWorktreeError(null);
      setNotesLoading(true);
      setNotesError(null);
      setTodosLoading(true);
      setTodosError(null);
      setSessionsLoading(true);
      setSessionsError(null);
      setProjectSkillsLoading(true);
      setProjectSkillsError(null);

      const [worktreesResult, notesResult, todosResult, promptDraftsResult, sessionsResult, projectSkillsResult] = await Promise.allSettled([
        getWorktrees(projectId),
        getNotes(projectId),
        getTodos(projectId),
        getPromptDrafts(projectId),
        getSessions(projectId),
        getProjectSkills(projectId)
      ]);

      if (cancelled) {
        return;
      }

      if (worktreesResult.status === "fulfilled") {
        const nextWorktree = worktreesResult.value.worktrees.find((worktree) => worktree.id === selectedWorktreeId) ?? worktreesResult.value.worktrees[0] ?? null;
        setWorktrees(worktreesResult.value.worktrees);
        setSelectedWorktreeId(nextWorktree?.id ?? null);
        setWorktreeError(null);
      } else {
        setWorktrees([]);
        setSelectedWorktreeId(null);
        setWorktreeError(formatError(worktreesResult.reason, "Worktree 列表加载失败"));
      }

      if (notesResult.status === "fulfilled") {
        const nextNote = notesResult.value.notes.find((note) => note.id === selectedNoteId) ?? notesResult.value.notes[0] ?? null;
        setNotes(notesResult.value.notes);
        setSelectedNoteId(nextNote?.id ?? null);
        setNotesError(null);
      } else {
        setNotes([]);
        setSelectedNoteId(null);
        setNotesError(formatError(notesResult.reason, "项目笔记加载失败"));
      }

      if (todosResult.status === "fulfilled") {
        const nextTodo = todosResult.value.todos.find((todo) => todo.id === selectedTodoId) ?? todosResult.value.todos[0] ?? null;
        setTodos(todosResult.value.todos);
        setSelectedTodoId(nextTodo?.id ?? null);
        setTodosError(null);
      } else {
        setTodos([]);
        setSelectedTodoId(null);
        setTodosError(formatError(todosResult.reason, "项目任务加载失败"));
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
      setNotesLoading(false);
      setTodosLoading(false);
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
  const selectedGlobalNote = globalNotes.find((note) => note.id === selectedGlobalNoteId) ?? null;
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const selectedTodo = todos.find((todo) => todo.id === selectedTodoId) ?? null;
  const selectedSession = selectedSessionId ? sessions.find((session) => session.id === selectedSessionId) ?? null : null;
  const selectedPromptDraft = selectedPromptDraftId ? promptDrafts.find((promptDraft) => promptDraft.id === selectedPromptDraftId) ?? null : null;
  const apiConnected = apiState.health?.status === "ok";

  useEffect(() => {
    if (selectedGlobalNote) {
      globalNoteAutosaveSkipRef.current = true;
      setGlobalNoteTitleLocked(true);
      setGlobalNoteDraft(noteToDraft(selectedGlobalNote));
      return;
    }

    globalNoteAutosaveSkipRef.current = true;
    setGlobalNoteTitleLocked(false);
    setGlobalNoteDraft(emptyNoteDraft());
  }, [selectedGlobalNoteId]);

  useEffect(() => {
    if (globalNoteAutosaveSkipRef.current) {
      globalNoteAutosaveSkipRef.current = false;
      return;
    }

    if (!selectedGlobalNote && !globalNoteDraft.title.trim() && !globalNoteDraft.content.trim() && !globalNoteDraft.tags.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistGlobalNoteDraft();
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [globalNoteDraft.content, globalNoteDraft.tags, globalNoteDraft.title, selectedGlobalNoteId]);

  useEffect(() => {
    if (selectedNote) {
      noteAutosaveSkipRef.current = true;
      setNoteTitleLocked(true);
      setNoteDraft(noteToDraft(selectedNote));
      return;
    }

    noteAutosaveSkipRef.current = true;
    setNoteTitleLocked(false);
    setNoteDraft(emptyNoteDraft());
  }, [selectedNoteId, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    if (noteAutosaveSkipRef.current) {
      noteAutosaveSkipRef.current = false;
      return;
    }

    if (!selectedNote && !noteDraft.title.trim() && !noteDraft.content.trim() && !noteDraft.tags.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistNoteDraft();
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [noteDraft.content, noteDraft.tags, noteDraft.title, selectedNoteId, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (noteSearchTimerRef.current) clearTimeout(noteSearchTimerRef.current);
    noteSearchTimerRef.current = setTimeout(() => {
      reloadNotes(selectedProjectId, null);
    }, 300);
    return () => { if (noteSearchTimerRef.current) clearTimeout(noteSearchTimerRef.current); };
  }, [noteSearchQuery, noteFilterTags]);

  useEffect(() => {
    if (globalNoteSearchTimerRef.current) clearTimeout(globalNoteSearchTimerRef.current);
    globalNoteSearchTimerRef.current = setTimeout(() => {
      reloadGlobalNotes(null);
    }, 300);
    return () => { if (globalNoteSearchTimerRef.current) clearTimeout(globalNoteSearchTimerRef.current); };
  }, [globalNoteSearchQuery, globalNoteFilterTags]);

  useEffect(() => {
    if (selectedTodo) {
      setTodoDraft(todoToDraft(selectedTodo));
      return;
    }

    setTodoDraft(emptyTodoDraft());
  }, [selectedTodoId, selectedProjectId]);

  useEffect(() => {
    if (selectedSession) {
      setSessionDraft(sessionToDraft(selectedSession, promptDrafts));
      setSessionResultDraft(selectedSession.summary ?? "");
      setSelectedPromptDraftId(selectedSession.promptDraftId ?? null);
      setSessionLaunchSource(selectedSession.source);
      return;
    }

    if (selectedPromptDraft) {
      setSessionDraft(promptDraftToSessionDraft(selectedPromptDraft));
      setSessionResultDraft("");
      setSessionLaunchSource(selectedPromptDraft.source);
      return;
    }

    setSessionResultDraft("");
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
    { title: "SQLite", value: databaseInfo?.connected ? "已连接" : "等待中", detail: databaseInfo ? `FTS5: ${databaseInfo.fts5 ? "可用" : "不可用"}` : "等待后端" }
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
        data.worktrees[0] ??
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

  async function reloadGlobalNotes(preferredNoteId?: string | null) {
    setGlobalNotesLoading(true);

    try {
      const data = await getGlobalNotes({
        search: globalNoteSearchQuery || undefined,
        tags: globalNoteFilterTags.length ? globalNoteFilterTags : undefined
      });
      const nextNote =
        (preferredNoteId ? data.notes.find((note) => note.id === preferredNoteId) : null) ?? data.notes.find((note) => note.id === selectedGlobalNoteId) ?? data.notes[0] ?? null;

      setGlobalNotes(data.notes);
      setSelectedGlobalNoteId(nextNote?.id ?? null);
      setGlobalNotesError(null);
    } catch (error) {
      setGlobalNotesError(formatError(error, "全局笔记加载失败"));
    } finally {
      setGlobalNotesLoading(false);
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

  async function reloadNotes(projectId: string, preferredNoteId?: string | null) {
    setNotesLoading(true);

    try {
      const data = await getNotes(projectId, {
        search: noteSearchQuery || undefined,
        tags: noteFilterTags.length ? noteFilterTags : undefined
      });
      const nextNote =
        (preferredNoteId ? data.notes.find((note) => note.id === preferredNoteId) : null) ?? data.notes.find((note) => note.id === selectedNoteId) ?? data.notes[0] ?? null;

      setNotes(data.notes);
      setSelectedNoteId(nextNote?.id ?? null);
      setNotesError(null);
    } catch (error) {
      setNotesError(formatError(error, "项目笔记加载失败"));
    } finally {
      setNotesLoading(false);
    }
  }

  async function reloadTodos(projectId: string, preferredTodoId?: string | null) {
    setTodosLoading(true);

    try {
      const data = await getTodos(projectId);
      const nextTodo =
        (preferredTodoId ? data.todos.find((todo) => todo.id === preferredTodoId) : null) ?? data.todos.find((todo) => todo.id === selectedTodoId) ?? data.todos[0] ?? null;

      setTodos(data.todos);
      setSelectedTodoId(nextTodo?.id ?? null);
      setTodosError(null);
    } catch (error) {
      setTodosError(formatError(error, "项目任务加载失败"));
    } finally {
      setTodosLoading(false);
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
    setWorkspaceScope("project");
    setActiveProjectTab("overview");
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
    setActiveProjectTab("overview");
    setProjectMenuOpen(false);
    void Promise.all([
      reloadWorktrees(project.id, null),
      reloadNotes(project.id, null),
      reloadTodos(project.id, null),
      reloadPromptDrafts(project.id, null),
      reloadSessions(project.id, null),
      reloadProjectSkills(project.id, null)
    ]);
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

  function updateSessionDraft(field: keyof SessionEditorDraft, value: string) {
    setSessionDraft((current) => {
      if (field === "worktreeId") {
        return {
          ...current,
          worktreeId: value,
          requestedWorktreeName: value ? "" : current.requestedWorktreeName
        };
      }

      if (field === "requestedWorktreeName") {
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
      setActiveProjectTab("overview");
    } catch (error) {
      setProjectError(formatError(error, "项目保存失败"));
    } finally {
      setSavingProject(false);
    }
  }

  async function handleCreateGlobalSkill() {
    const name = window.prompt("请输入全局 Skill 文件夹名");

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
    const newName = window.prompt("请输入新的全局 Skill 文件夹名", skill.name);

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
    const confirmed = window.confirm(`确认删除全局 Skill 文件夹「${skill.name}」？\n\n将删除目录：${skill.path}`);

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
    if (!selectedProject) {
      return;
    }

    const existingProjectSkill = projectSkills.find((item) => item.name === skill.name && item.hasProject);
    const overwrite = existingProjectSkill ? window.confirm(`项目中已存在同名 Skill「${skill.name}」，是否覆盖项目文件夹？`) : false;

    if (existingProjectSkill && !overwrite) {
      return;
    }

    setSkillOperationName(skill.name);
    setGlobalSkillsError(null);
    setProjectSkillsError(null);

    try {
      await copyGlobalSkillToProject(skill.name, { targetProjectId: selectedProject.id, overwrite });
      await reloadProjectSkills(selectedProject.id, skill.name);
    } catch (error) {
      setGlobalSkillsError(formatError(error, "复制全局 Skill 到项目失败"));
    } finally {
      setSkillOperationName(null);
    }
  }

  async function handleCreateProjectSkill() {
    if (!selectedProject) {
      return;
    }

    const name = window.prompt("请输入项目 Skill 文件夹名");

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

    const newName = window.prompt("请输入新的项目 Skill 文件夹名", skill.name);

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

    const confirmed = window.confirm(`确认删除项目 Skill 文件夹「${skill.name}」？\n\n将删除目录：${skill.projectPath ?? skill.effectivePath}`);

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

  async function handleCopyProjectSkillToGlobal(skill: ProjectSkillSummary) {
    if (!selectedProject || !skill.hasProject) {
      return;
    }

    const overwrite = skill.hasGlobal ? window.confirm(`全局中已存在同名 Skill「${skill.name}」，是否覆盖全局文件夹？`) : false;

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

  async function handleProjectDelete() {
    if (!selectedProject) {
      return;
    }

    const confirmed = window.confirm("删除项目只会移除 Workhorse Station 中的记录，不会删除本地代码目录。若项目仍有 worktree，需要先删除 worktree。确认删除？");

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

    const confirmed = window.confirm(
      `确认删除 worktree「${worktree.name}」？\n\n将删除目录：${worktree.path}\n将删除本地分支：${worktree.branch}\n\n如果存在未提交改动或未合并提交，后端会阻止删除。`
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
        await reloadGlobalNotes(data.note.id);
      } else {
        const data = await createGlobalNote(request);
        await reloadGlobalNotes(data.note.id);
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
    const confirmed = window.confirm(`确认删除全局笔记「${note.title}」？`);

    if (!confirmed) {
      return;
    }

    setDeletingGlobalNoteId(note.id);
    setGlobalNotesError(null);

    try {
      await deleteGlobalNote(note.id);
      await reloadGlobalNotes(null);
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
        await reloadNotes(selectedProject.id, data.note.id);
      } else {
        const data = await createNote(selectedProject.id, request);
        await reloadNotes(selectedProject.id, data.note.id);
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

    const confirmed = window.confirm(`确认删除笔记「${note.title}」？如果有任务引用它，来源关联会被清空。`);

    if (!confirmed) {
      return;
    }

    setDeletingNoteId(note.id);
    setNotesError(null);

    try {
      await deleteNote(selectedProject.id, note.id);
      await Promise.all([reloadNotes(selectedProject.id, null), reloadTodos(selectedProject.id, null)]);
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
      await reloadTodos(selectedProject.id, data.todo.id);
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
        await reloadTodos(selectedProject.id, data.todo.id);
      } else {
        const data = await createTodo(selectedProject.id, request);
        await reloadTodos(selectedProject.id, data.todo.id);
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

    const confirmed = window.confirm(`确认删除任务「${todo.title}」？`);

    if (!confirmed) {
      return;
    }

    setDeletingTodoId(todo.id);
    setTodosError(null);

    try {
      await deleteTodo(selectedProject.id, todo.id);
      await reloadTodos(selectedProject.id, null);
      setTodoDraft(emptyTodoDraft());
    } catch (error) {
      setTodosError(formatError(error, "项目任务删除失败"));
    } finally {
      setDeletingTodoId(null);
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
    globalNoteAutosaveSkipRef.current = true;
    setGlobalNoteDraft(emptyNoteDraft());
    setGlobalNotesError(null);
  }

  function startCreateNote() {
    setSelectedNoteId(null);
    setNoteSettingsOpen(false);
    setNoteTitleLocked(false);
    noteAutosaveSkipRef.current = true;
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

    setSendingChat(true);
    setChatError(null);

    try {
      const data = await sendChatMessage(targetChatId, {
        content,
        attachments,
        projectId: selectedProject?.id ?? null,
        worktreeId: selectedWorktree?.id ?? null
      });
      setChatDraft("");
      setChatFile(null);
      await reloadChatSessions(data.chatSession.id);
    } catch (error) {
      setChatError(formatError(error, "消息发送失败"));
    } finally {
      setSendingChat(false);
    }
  }

  async function handleDeleteChatSession(chatSession: ChatSessionSummary) {
    const confirmed = window.confirm(`确认删除聊天「${chatSession.title}」？`);

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
    setSessionView("terminal");
    setSessionsError(null);

    if (sessionId) {
      const session = sessions.find((item) => item.id === sessionId) ?? null;
      setSelectedSessionId(sessionId);
      setSelectedPromptDraftId(session?.promptDraftId ?? null);
      if (session) {
        setSessionDraft(sessionToDraft(session, promptDrafts));
        setSessionResultDraft(session.summary ?? "");
      }
      setSessionCreateModalOpen(false);
      setSessionModalOpen(true);
      return;
    }

    const nextDraft = buildSessionDraft({
      source,
      todo: todoId ? todos.find((todo) => todo.id === todoId) ?? null : null,
      selectedWorktree
    });

    setSelectedSessionId(null);
    setSelectedPromptDraftId(null);
    setSessionDraft(nextDraft);
    setSessionResultDraft("");
    setSessionModalOpen(false);
    setSessionCreateModalOpen(true);
  }

  function openSessionViewer() {
    setSessionCreateModalOpen(false);
    setSessionView("terminal");
    setSessionsError(null);

    if (!selectedSessionId && sessions[0]) {
      setSelectedSessionId(sessions[0].id);
      setSelectedPromptDraftId(sessions[0].promptDraftId ?? null);
      setSessionLaunchSource(sessions[0].source);
      setSessionDraft(sessionToDraft(sessions[0], promptDrafts));
      setSessionResultDraft(sessions[0].summary ?? "");
    }

    setSessionModalOpen(true);
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
      setSelectedSessionId(data.session.id);
      setSelectedPromptDraftId(data.session.promptDraftId ?? null);
      setSessionDraft(sessionToDraft(data.session, promptDrafts));
      await Promise.all([
        reloadSessions(selectedProject.id, data.session.id),
        reloadWorktrees(selectedProject.id, data.session.worktreeId ?? selectedWorktreeId),
        sessionDraft.promptDraftId ? reloadPromptDrafts(selectedProject.id, sessionDraft.promptDraftId) : Promise.resolve()
      ]);
      setSessionCreateModalOpen(false);
      setSessionView("terminal");
      setSessionModalOpen(true);
    } catch (error) {
      setSessionsError(formatError(error, "会话启动失败"));
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleSaveSessionResult(options?: { applyToTodo?: boolean; applyToProject?: boolean }) {
    if (!selectedProject || !selectedSession) {
      return;
    }

    setUpdatingSessionId(selectedSession.id);
    setSessionsError(null);

    try {
      await updateSession(selectedProject.id, selectedSession.id, {
        name: selectedSession.name,
        summary: sessionResultDraft,
        applyResultToTodo: options?.applyToTodo ?? false,
        applyResultToProject: options?.applyToProject ?? false
      });

      await Promise.all([
        reloadSessions(selectedProject.id, selectedSession.id),
        options?.applyToTodo && selectedSession.todoId ? reloadTodos(selectedProject.id, selectedSession.todoId) : Promise.resolve(),
        options?.applyToProject ? reloadProjects(selectedProject.id) : Promise.resolve()
      ]);
    } catch (error) {
      setSessionsError(formatError(error, "会话结果保存失败"));
    } finally {
      setUpdatingSessionId(null);
    }
  }

  async function handleStopSession(session: SessionSummary) {
    if (!selectedProject) {
      return;
    }

    setUpdatingSessionId(session.id);
    setSessionsError(null);

    try {
      await stopSession(selectedProject.id, session.id);
      await reloadSessions(selectedProject.id, session.id);
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

    await reloadSessions(selectedProject.id, event.sessionId);
  }

  async function handleDeleteSession(session: SessionSummary) {
    if (!selectedProject) {
      return;
    }

    const confirmed = window.confirm(`确认删除会话「${session.name}」？`);

    if (!confirmed) {
      return;
    }

    setDeletingSessionId(session.id);
    setSessionsError(null);

    try {
      await deleteSession(selectedProject.id, session.id);

      const remainingSessions = sessions.filter((item) => item.id !== session.id);
      const nextSessionId = selectedSessionId === session.id ? remainingSessions[0]?.id ?? null : selectedSessionId;
      await reloadSessions(selectedProject.id, nextSessionId);

      if (selectedSessionId === session.id) {
        setSelectedPromptDraftId(null);

        if (!nextSessionId) {
          setSessionDraft(emptySessionEditorDraft());
          setSessionResultDraft("");
          setSessionModalOpen(false);
        }
      }
    } catch (error) {
      setSessionsError(formatError(error, "会话删除失败"));
    } finally {
      setDeletingSessionId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0c10] text-slate-100">
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
          onSelect={(project) => {
            setCurrentProject(project);
            setProjectMenuOpen(false);
          }}
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

      <main className={workspaceScope === "home" && activeHomeMode === "chat" ? "flex-1 overflow-auto bg-[#0f1117]" : "flex-1 overflow-auto bg-[#0f1117] p-4 sm:p-5"}>
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
            onChatSelect={(session) => setSelectedChatId(session.id)}
            onCreateChat={() => void createChatSessionRecord()}
            onChatDraftChange={setChatDraft}
            onChatFileChange={(file) => void handleChatFileChange(file)}
            onChatSubmit={(event) => void handleSendChatMessage(event)}
            onDeleteChat={handleDeleteChatSession}
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
            onCreateSession={() => openSessionModal("direct")}
            globalNoteSearchQuery={globalNoteSearchQuery}
            globalNoteFilterTags={globalNoteFilterTags}
            availableGlobalNoteTags={availableGlobalNoteTags}
            onGlobalNoteSearchChange={setGlobalNoteSearchQuery}
            onGlobalNoteFilterTagsChange={setGlobalNoteFilterTags}
          />
        ) : (
          <ProjectWorkspacePage
            activeTab={activeProjectTab}
            onTabChange={setActiveProjectTab}
            projects={projects}
            selectedProject={selectedProject}
            selectedWorktree={selectedWorktree}
            worktrees={worktrees}
            projectFeatureCards={featureCards}
            projectsLoading={projectsLoading}
            worktreesLoading={worktreesLoading}
            deletingProject={deletingProject}
            deletingWorktreeId={deletingWorktreeId}
            projectError={projectError}
            worktreeError={worktreeError}
            notes={notes}
            selectedNote={selectedNote}
            notesLoading={notesLoading}
            notesError={notesError}
            noteDraft={noteDraft}
            savingNote={savingNote}
            deletingNoteId={deletingNoteId}
            noteSettingsOpen={noteSettingsOpen}
            todos={todos}
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
            onCopyGlobalSkillToProject={handleCopyGlobalSkillToProject}
            onOpenSession={openSessionModal}
            noteSearchQuery={noteSearchQuery}
            noteFilterTags={noteFilterTags}
            availableNoteTags={availableNoteTags}
            onNoteSearchChange={setNoteSearchQuery}
            onNoteFilterTagsChange={setNoteFilterTags}
          />
        )}
      </main>

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

      {sessionModalOpen ? (
        <SessionModalPanel
          sessions={sessions}
          selectedSession={selectedSession}
          selectedProject={selectedProject}
          selectedWorktree={selectedWorktree}
          todos={todos}
          worktrees={worktrees}
          apiConnected={apiConnected}
          source={sessionLaunchSource}
          view={sessionView}
          draft={sessionDraft}
          resultDraft={sessionResultDraft}
          savingResult={updatingSessionId === selectedSessionId}
          error={sessionsError}
          loading={sessionsLoading}
          updatingSessionId={updatingSessionId}
          deletingSessionId={deletingSessionId}
          onResultDraftChange={setSessionResultDraft}
          onSaveResult={() => void handleSaveSessionResult()}
          onApplyResultToTodo={() => void handleSaveSessionResult({ applyToTodo: true })}
          onApplyResultToProject={() => void handleSaveSessionResult({ applyToProject: true })}
          onViewChange={setSessionView}
          onSelectSession={(session) => setSelectedSessionId(session.id)}
          onStopSession={handleStopSession}
          onDeleteSession={handleDeleteSession}
          onRuntimeEvent={handleSessionRuntimeEvent}
          onClose={() => setSessionModalOpen(false)}
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
  onSelect,
  onEnter,
  onCreate
}: {
  open: boolean;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  loading: boolean;
  onToggle: () => void;
  onSelect: (project: ProjectSummary) => void;
  onEnter: (project: ProjectSummary) => void;
  onCreate: () => void;
}) {
  return (
    <div className="relative">
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
              <div key={project.id} className={`flex items-center gap-2 rounded-lg p-2 ${selectedProject?.id === project.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
                <button onClick={() => onSelect(project)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm text-slate-100">{project.name}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{project.path}</div>
                </button>
                <button onClick={() => onEnter(project)} className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5">
                  进入
                </button>
              </div>
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
  onEnterProject,
  onCreateSession,
  recentProjects,
  runningSessions,
  globalNoteSearchQuery = "",
  globalNoteFilterTags = [],
  availableGlobalNoteTags = [],
  onGlobalNoteSearchChange,
  onGlobalNoteFilterTagsChange
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
  recentProjects: ProjectSummary[];
  runningSessions: OverviewSessionSummary[];
  onEnterProject: (projectId?: string) => void;
  onCreateSession: () => void;
  globalNoteSearchQuery?: string;
  globalNoteFilterTags?: string[];
  availableGlobalNoteTags?: string[];
  onGlobalNoteSearchChange?: (query: string) => void;
  onGlobalNoteFilterTagsChange?: (tags: string[]) => void;
}) {
  return (
    <div className={activeMode === "chat" ? "flex min-h-[calc(100vh-104px)] w-full flex-col" : "mx-auto flex w-full max-w-7xl flex-col gap-5"}>
      {activeMode === "chat" ? (
        <HomeChatWorkspace
          selectedProject={selectedProject}
          selectedWorktree={selectedWorktree}
          chatSessions={chatSessions}
          selectedChat={selectedChat}
          draft={chatDraft}
          chatFile={chatFile}
          loading={chatLoading}
          error={chatError}
          creating={creatingChat}
          sending={sendingChat}
          deletingChatId={deletingChatId}
          onSelect={onChatSelect}
          onCreate={onCreateChat}
          onDraftChange={onChatDraftChange}
          onFileChange={onChatFileChange}
          onSubmit={onChatSubmit}
          onDelete={onDeleteChat}
        />
      ) : (
        <HomeOverviewWorkspace
          featureCards={featureCards}
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
          recentProjects={recentProjects}
          runningSessions={runningSessions}
          onEnterProject={onEnterProject}
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
          globalNoteSearchQuery={globalNoteSearchQuery}
          globalNoteFilterTags={globalNoteFilterTags}
          availableGlobalNoteTags={availableGlobalNoteTags}
          onGlobalNoteSearchChange={onGlobalNoteSearchChange}
          onGlobalNoteFilterTagsChange={onGlobalNoteFilterTagsChange}
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
  onSelect,
  onCreate,
  onDraftChange,
  onFileChange,
  onSubmit,
  onDelete
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
  onSelect: (session: ChatSessionSummary) => void;
  onCreate: () => void;
  onDraftChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (chat: ChatSessionSummary) => void;
}) {
  return (
    <section className="grid min-h-[calc(100vh-80px)] flex-1 grid-cols-1 bg-[#0f1117] lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="bg-[#111318] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-slate-100">聊天会话</div>
            <div className="mt-1 text-xs text-slate-500">不同于 Claude Code 会话</div>
          </div>
          <button onClick={onCreate} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">
            新建
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto lg:block lg:space-y-1">
          {chatSessions.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-slate-500">还没有聊天会话</div> : null}
          {chatSessions.map((session) => (
            <div key={session.id} className={`rounded-xl p-3 text-sm ${selectedChat?.id === session.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
              <button
                onClick={() => onSelect(session)}
                className="w-full text-left"
              >
                <div className="truncate font-medium text-slate-100">{session.title}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{formatDateTime(session.updatedAt)}</div>
              </button>
              <button
                type="button"
                disabled={deletingChatId === session.id}
                onClick={() => onDelete(session)}
                className="mt-2 rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/5 disabled:opacity-50"
              >
                {deletingChatId === session.id ? "删除中..." : "删除"}
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-h-0 flex-col">
        <div className="mx-auto w-full max-w-[768px] px-4 py-3 text-xs text-slate-500">
          上下文：{selectedProject?.name ?? "未选择项目"} / {selectedWorktree?.name ?? "未选择 worktree"} · 可直接让我搜索笔记、创建任务或保存 Prompt
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[768px] space-y-4 p-4 sm:p-6">
            {loading ? <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-500">聊天会话加载中...</div> : null}
            {!loading && error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
            {!loading && !selectedChat ? <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">新建或选择一个聊天会话。</div> : null}
            {selectedChat?.messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] space-y-3 rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-slate-100 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-200"}`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>
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
                      {message.toolCalls.map((tc) => (
                        <div key={tc.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-300">{toolLabel(tc.name)}</span>
                            <span className="truncate font-medium text-slate-100">{formatToolSummary(tc.name, tc.input)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {message.toolResults.length ? (
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
          </div>
        </div>
        <form onSubmit={onSubmit} className="p-3 sm:p-4">
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
                className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="输入消息。我会在需要时帮你搜索、创建笔记、任务或 Prompt。"
              />
              <button disabled={creating || sending} className="shrink-0 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
                {sending ? "发送中..." : creating ? "创建中..." : "发送"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

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
  recentProjects,
  runningSessions,
  onEnterProject,
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
  globalNoteSearchQuery = "",
  globalNoteFilterTags = [],
  availableGlobalNoteTags = [],
  onGlobalNoteSearchChange,
  onGlobalNoteFilterTagsChange
}: {
  featureCards: Array<{ title: string; value: string; detail: string }>;
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
  recentProjects: ProjectSummary[];
  runningSessions: OverviewSessionSummary[];
  onEnterProject: (projectId?: string) => void;
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
  globalNoteSearchQuery?: string;
  globalNoteFilterTags?: string[];
  availableGlobalNoteTags?: string[];
  onGlobalNoteSearchChange?: (query: string) => void;
  onGlobalNoteFilterTagsChange?: (tags: string[]) => void;
}) {
  return (
    <div className="space-y-5">
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
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
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
        />
        <section className="rounded-xl border border-white/10 bg-[#151821]">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">系统状态</div>
          <div className="space-y-4 p-4 text-sm text-slate-300">
            <DetailRow label="当前阶段" value="Phase 2" />
            <DetailRow label="API 状态" value={apiConnected ? "已连接" : "未连接"} />
            <DetailRow label="SQLite" value={databaseInfo?.connected ? "已初始化" : "等待后端"} />
            <DetailRow label="FTS5" value={databaseInfo ? (databaseInfo.fts5 ? "可用" : "不可用") : "未知"} />
            {apiError ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{apiError}</p> : null}
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-slate-100">最近项目</div>
            <p className="mt-1 text-xs text-slate-500">最近更新的项目，点击进入项目工作台。</p>
          </div>
          <button onClick={() => onEnterProject()} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
            进入项目
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {recentProjects.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-3 text-slate-500">还没有项目，先创建一个吧。</div> : null}
          {recentProjects.map((project) => (
            <div key={project.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="truncate font-medium text-slate-100">{project.name}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{project.path}</div>
              {project.latestSessionResult ? (
                <div className="mt-1 truncate text-xs text-slate-400">{project.latestSessionResult.sessionName}: {project.latestSessionResult.summary.slice(0, 60)}{project.latestSessionResult.summary.length > 60 ? "..." : ""}</div>
              ) : null}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{formatDateTime(project.updatedAt)}</span>
                <button onClick={() => onEnterProject(project.id)} className="rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5">
                  进入
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-slate-100">运行中会话</div>
            <p className="mt-1 text-xs text-slate-500">当前正在运行的 Claude Code 会话，点击进入。</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {runningSessions.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-3 text-slate-500">没有运行中的会话</div> : null}
          {runningSessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-slate-100">{session.name}</span>
                  <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-300">{session.runtimeStatus ?? session.status}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span>{session.projectName}</span>
                  <span>·</span>
                  <span>{formatDateTime(session.updatedAt)}</span>
                </div>
              </div>
              <button onClick={() => onEnterProject(session.projectId)} className="ml-3 shrink-0 rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5">
                进入
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div>
          <div className="font-medium text-slate-100">最近聊天</div>
          <p className="mt-1 text-xs text-slate-500">最近的 AI 聊天会话，不是 Claude Code 执行会话。</p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {chatSessions.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-3 text-slate-500">还没有聊天会话</div> : null}
          {chatSessions.slice(0, 6).map((session) => (
            <div key={session.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="truncate text-slate-100">{session.title}</div>
              <div className="mt-1 text-xs text-slate-500">{formatDateTime(session.updatedAt)}</div>
            </div>
          ))}
        </div>
      </section>
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
  projectFeatureCards,
  projectsLoading,
  worktreesLoading,
  deletingProject,
  deletingWorktreeId,
  projectError,
  worktreeError,
  notes,
  selectedNote,
  notesLoading,
  notesError,
  noteDraft,
  savingNote,
  deletingNoteId,
  noteSettingsOpen,
  todos,
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
  onCopyGlobalSkillToProject,
  onOpenSession,
  noteSearchQuery = "",
  noteFilterTags = [],
  availableNoteTags = [],
  onNoteSearchChange,
  onNoteFilterTagsChange
}: {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  worktrees: WorktreeSummary[];
  projectFeatureCards: Array<{ title: string; value: string; detail: string }>;
  projectsLoading: boolean;
  worktreesLoading: boolean;
  deletingProject: boolean;
  deletingWorktreeId: string | null;
  projectError: string | null;
  worktreeError: string | null;
  notes: NoteSummary[];
  selectedNote: NoteSummary | null;
  notesLoading: boolean;
  notesError: string | null;
  noteDraft: NoteDraft;
  savingNote: boolean;
  deletingNoteId: string | null;
  noteSettingsOpen: boolean;
  todos: TodoSummary[];
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
  onCopyGlobalSkillToProject: (skill: SkillSummary) => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
  noteSearchQuery?: string;
  noteFilterTags?: string[];
  availableNoteTags?: string[];
  onNoteSearchChange?: (query: string) => void;
  onNoteFilterTagsChange?: (tags: string[]) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="rounded-2xl border border-white/10 bg-[#151821] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="text-xs text-slate-500">项目工作台</div>
            <h1 className="mt-2 text-2xl font-semibold">{selectedProject?.name ?? "选择或创建项目"}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              项目内承载任务、笔记、Skill、会话和 Worktree。会话终端通过模态框打开，关闭后继续后台运行。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onCreateProject} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
              新建项目
            </button>
            <button
              disabled={!selectedProject}
              onClick={() => onOpenSession("direct")}
              className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              直接创建会话
            </button>
          </div>
        </div>
        <ProjectTopNav activeTab={activeTab} onTabChange={onTabChange} />
      </section>

      <ProjectTabWorkspace
        activeTab={activeTab}
        projects={projects}
        selectedProject={selectedProject}
        selectedWorktree={selectedWorktree}
        worktrees={worktrees}
        projectFeatureCards={projectFeatureCards}
        projectsLoading={projectsLoading}
        worktreesLoading={worktreesLoading}
        deletingProject={deletingProject}
        deletingWorktreeId={deletingWorktreeId}
        projectError={projectError}
        worktreeError={worktreeError}
        notes={notes}
        selectedNote={selectedNote}
        notesLoading={notesLoading}
        notesError={notesError}
        noteDraft={noteDraft}
        savingNote={savingNote}
        deletingNoteId={deletingNoteId}
        noteSettingsOpen={noteSettingsOpen}
        todos={todos}
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
        onCreateProject={onCreateProject}
        onEditProject={onEditProject}
        onSelectProject={onSelectProject}
        onDeleteProject={onDeleteProject}
        onCreateWorktree={onCreateWorktree}
        onWorktreeSelect={onWorktreeSelect}
        onWorktreeDelete={onWorktreeDelete}
        onCreateNote={onCreateNote}
        onSelectNote={onSelectNote}
        onNoteDraftChange={onNoteDraftChange}
        onSaveNote={onSaveNote}
        onDeleteNote={onDeleteNote}
        onOpenNoteSettings={onOpenNoteSettings}
        onCloseNoteSettings={onCloseNoteSettings}
        onCreateTodoFromNote={onCreateTodoFromNote}
        onCreateTodo={onCreateTodo}
        onSelectTodo={onSelectTodo}
        onTodoDraftChange={onTodoDraftChange}
        onSaveTodo={onSaveTodo}
        onDeleteTodo={onDeleteTodo}
        onSelectProjectSkill={onSelectProjectSkill}
        onCreateProjectSkill={onCreateProjectSkill}
        onRenameProjectSkill={onRenameProjectSkill}
        onDeleteProjectSkill={onDeleteProjectSkill}
        onCopyProjectSkillToGlobal={onCopyProjectSkillToGlobal}
        onCopyGlobalSkillToProject={onCopyGlobalSkillToProject}
        onOpenSession={onOpenSession}
        noteSearchQuery={noteSearchQuery}
        noteFilterTags={noteFilterTags}
        availableNoteTags={availableNoteTags}
        onNoteSearchChange={onNoteSearchChange}
        onNoteFilterTagsChange={onNoteFilterTagsChange}
      />
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

function ProjectTabWorkspace({
  activeTab,
  projects,
  selectedProject,
  selectedWorktree,
  worktrees,
  projectFeatureCards,
  projectsLoading,
  worktreesLoading,
  deletingProject,
  deletingWorktreeId,
  projectError,
  worktreeError,
  notes,
  selectedNote,
  notesLoading,
  notesError,
  noteDraft,
  savingNote,
  deletingNoteId,
  noteSettingsOpen,
  todos,
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
  onCopyGlobalSkillToProject,
  onOpenSession,
  noteSearchQuery = "",
  noteFilterTags = [],
  availableNoteTags = [],
  onNoteSearchChange,
  onNoteFilterTagsChange
}: {
  activeTab: ProjectTab;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  worktrees: WorktreeSummary[];
  projectFeatureCards: Array<{ title: string; value: string; detail: string }>;
  projectsLoading: boolean;
  worktreesLoading: boolean;
  deletingProject: boolean;
  deletingWorktreeId: string | null;
  projectError: string | null;
  worktreeError: string | null;
  notes: NoteSummary[];
  selectedNote: NoteSummary | null;
  notesLoading: boolean;
  notesError: string | null;
  noteDraft: NoteDraft;
  savingNote: boolean;
  deletingNoteId: string | null;
  noteSettingsOpen: boolean;
  todos: TodoSummary[];
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
  onCopyGlobalSkillToProject: (skill: SkillSummary) => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
  noteSearchQuery?: string;
  noteFilterTags?: string[];
  availableNoteTags?: string[];
  onNoteSearchChange?: (query: string) => void;
  onNoteFilterTagsChange?: (tags: string[]) => void;
}) {
  if (activeTab === "worktrees") {
    return selectedProject ? (
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
      />
    ) : (
      <EmptyProjectNotice onCreateProject={onCreateProject} />
    );
  }

  if (activeTab === "sessions") {
    return (
      <SessionsWorkspacePanel
        selectedProject={selectedProject}
        selectedWorktree={selectedWorktree}
        sessions={sessions}
        promptDrafts={promptDrafts}
        todos={todos}
        loading={sessionsLoading}
        error={sessionsError}
        onCreateProject={onCreateProject}
        onOpenSession={onOpenSession}
      />
    );
  }

  if (activeTab === "todos") {
    return (
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
        onCreate={onCreateTodo}
        onSelect={onSelectTodo}
        onDraftChange={onTodoDraftChange}
        onSave={onSaveTodo}
        onDelete={onDeleteTodo}
        onOpenSession={onOpenSession}
      />
    );
  }

  if (activeTab === "notes") {
    return (
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
    );
  }

  if (activeTab === "skills") {
    return (
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
        onCopyGlobalToProject={onCopyGlobalSkillToProject}
      />
    );
  }

  return (
    <div className="space-y-5">
      <FeatureCardGrid cards={projectFeatureCards} />
      <ProjectManagementPanel
        projects={projects}
        selectedProject={selectedProject}
        selectedWorktree={selectedWorktree}
        loading={projectsLoading}
        deleting={deletingProject}
        error={projectError}
        onCreate={onCreateProject}
        onEdit={onEditProject}
        onSelect={onSelectProject}
        onDelete={onDeleteProject}
        onOpenSession={onOpenSession}
      />
    </div>
  );
}

function ProjectManagementPanel({
  projects,
  selectedProject,
  selectedWorktree,
  loading,
  deleting,
  error,
  onCreate,
  onEdit,
  onSelect,
  onDelete,
  onOpenSession
}: {
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  loading: boolean;
  deleting: boolean;
  error: string | null;
  onCreate: () => void;
  onEdit: () => void;
  onSelect: (project: ProjectSummary) => void;
  onDelete: () => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm font-medium">项目列表</div>
          <button onClick={onCreate} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-950">
            新建项目
          </button>
        </div>
        <div className="min-h-[320px] divide-y divide-white/10">
          {loading ? <div className="px-4 py-6 text-sm text-slate-400">项目加载中...</div> : null}
          {!loading && projects.length === 0 ? (
            <div className="space-y-3 px-4 py-8 text-sm">
              <div className="text-base font-medium text-slate-100">还没有项目</div>
              <p className="text-slate-400">创建第一个项目，并绑定一个本机已有 Git 仓库主工作目录。</p>
              <button onClick={onCreate} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
                绑定第一个项目
              </button>
            </div>
          ) : null}
          {!loading
            ? projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onSelect(project)}
                  className={`block w-full px-4 py-3 text-left text-sm ${
                    selectedProject?.id === project.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-100">{project.name}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{project.path}</div>
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
                      已绑定目录
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>默认分支：{project.defaultBranch}</span>
                    <span>更新：{formatDateTime(project.updatedAt)}</span>
                  </div>
                </button>
              ))
            : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm font-medium">项目详情 / 属性</div>
          {selectedProject ? (
            <button onClick={onEdit} className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5">
              编辑
            </button>
          ) : null}
        </div>
        <div className="space-y-4 p-4 text-sm text-slate-300">
          {selectedProject ? (
            <>
              <DetailRow label="名称" value={selectedProject.name} />
              <DetailRow label="代码目录" value={selectedProject.path} />
              <DetailRow label="默认分支" value={selectedProject.defaultBranch} />
              <DetailRow label="当前 Worktree" value={selectedWorktree?.name ?? "未选择"} />
              <DetailRow label="Worktree 目录" value={`${selectedProject.path}/.claude/worktree/`} />
              <DetailRow label="创建时间" value={formatDateTime(selectedProject.createdAt)} />
              <DetailRow label="更新时间" value={formatDateTime(selectedProject.updatedAt)} />
              {selectedProject.latestSessionResult ? (
                <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-3 text-xs text-sky-50">
                  <div className="font-medium text-sky-100">最近会话结果</div>
                  <div className="mt-2 text-sky-100">{selectedProject.latestSessionResult.sessionName}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sky-50/90">{selectedProject.latestSessionResult.summary}</div>
                  <div className="mt-2 text-sky-100/80">更新：{formatDateTime(selectedProject.latestSessionResult.updatedAt)}</div>
                  <button
                    type="button"
                    onClick={() => onOpenSession("direct", undefined, selectedProject.latestSessionResult?.sessionId)}
                    className="mt-3 rounded-md border border-sky-200/20 px-2 py-1 text-xs text-sky-50 hover:bg-white/5"
                  >
                    打开会话
                  </button>
                </div>
              ) : null}
              {selectedProject.description ? <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-slate-400">{selectedProject.description}</p> : null}
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-60"
              >
                {deleting ? "删除中..." : "删除项目"}
              </button>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 p-4 text-slate-500">请选择一个项目，或创建第一个项目。</div>
          )}
          {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
        </div>
      </section>
    </div>
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
  onDelete
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
  onCopyToProject
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
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#151821]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-100">全局 Skill 文件夹</div>
          <div className="mt-1 text-xs text-slate-500">来源：~/.claude/skills/*，只管理整个文件夹。</div>
        </div>
        <button onClick={onCreate} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
          新建
        </button>
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
                      <button disabled={busy} onClick={() => onRename(skill)} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 disabled:opacity-50">
                        重命名
                      </button>
                      <button disabled={busy || !selectedProject} onClick={() => onCopyToProject(skill)} className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50">
                        复制到项目
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
  onCopyGlobalToProject
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
  onCopyGlobalToProject: (skill: SkillSummary) => void;
}) {
  if (!project) {
    return <EmptyProjectNotice onCreateProject={() => undefined} />;
  }

  const selectedSkill = skills.find((skill) => skill.name === selectedSkillName) ?? skills[0] ?? null;
  const selectedAsGlobalSkill: SkillSummary | null = selectedSkill?.hasGlobal && selectedSkill.globalPath ? { name: selectedSkill.name, source: "global", path: selectedSkill.globalPath } : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-100">项目 Skill 文件夹</div>
            <div className="mt-1 break-all text-xs text-slate-500">来源：{project.path}/.claude/skills/*</div>
          </div>
          <button onClick={onCreate} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
            新建
          </button>
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
            <p className="mt-1 text-xs text-slate-500">只展示和操作文件夹，不读取目录内容。</p>
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
              <button disabled={!selectedAsGlobalSkill || operationName === selectedSkill.name} onClick={() => selectedAsGlobalSkill && onCopyGlobalToProject(selectedAsGlobalSkill)} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-50">
                复制到项目
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
          <DetailRow label="SQLite" value={databaseInfo?.connected ? "已初始化" : "等待后端"} />
          <DetailRow label="FTS5" value={databaseInfo ? (databaseInfo.fts5 ? "可用" : "不可用") : "未知"} />
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
    promptDraftId: ""
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
    prompt: "",
    todoId: todo?.id ?? "",
    worktreeId: selectedWorktree?.id ?? "",
    requestedWorktreeName: "",
    promptDraftId: ""
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
    promptDraftId: promptDraft.id
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
    promptDraftId: session.promptDraftId ?? ""
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
    status: "draft" as const
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

  const headerTitle = selectedNote ? "笔记编辑器" : "新建笔记";

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-xl border border-white/10 bg-[#151821]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-medium">{title}</div>
              <div className="mt-1 text-xs text-slate-500">{description}</div>
            </div>
            <button onClick={onCreate} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-950">
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

          <div className="min-h-[320px] divide-y divide-white/10">
            {loading ? <div className="px-4 py-6 text-sm text-slate-400">{title}加载中...</div> : null}
            {!loading && notes.length === 0 ? <div className="px-4 py-8 text-sm text-slate-500">{emptyText}</div> : null}
            {!loading
              ? notes.map((note) => (
                  <div key={note.id} className={`flex items-start gap-3 px-4 py-3 ${selectedNote?.id === note.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
                    <div role="button" tabIndex={0} onClick={() => onSelect(note)} onKeyDown={(e) => { if (e.key === "Enter") onSelect(note); }} className="min-w-0 flex-1 cursor-pointer text-left text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-100">{note.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-500">{note.content || "暂无正文"}</div>
                        </div>
                        <span className="shrink-0 text-xs text-slate-500">{formatDateTime(note.updatedAt)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
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
                        )) : <span className="text-xs text-slate-600">无标签</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(note);
                        onOpenSettings();
                      }}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5"
                    >
                      属性
                    </button>
                  </div>
                ))
              : null}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-100">{headerTitle}</div>
              <div className="mt-1 text-xs text-slate-500">自动保存开启，标题支持单独修改。</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedNote ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
                >
                  编辑属性
                </button>
              ) : null}
              {showCreateTodo && selectedNote ? (
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
          </div>

          <form onSubmit={onSave} className="mt-4 space-y-4">
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
                className="min-h-[420px] w-full rounded-lg border border-white/10 bg-black/20 px-3 py-3 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-slate-400"
                placeholder="# 会话入口梳理\n\n直接开始写，系统会自动保存。"
              />
            </Field>
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>{saving ? "自动保存中..." : "已开启自动保存"}</span>
              <button type="submit" className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5">
                立即保存
              </button>
            </div>
            {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
          </form>
        </section>
      </div>

      {settingsOpen && selectedNote ? (
        <Modal title="编辑笔记属性" description="标签等次要属性放在模态框里修改。" onClose={onCloseSettings}>
          <form onSubmit={onSave} className="space-y-4">
            <Field label="标题">
              <input
                value={draft.title}
                onChange={(event) => onDraftChange("title", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                placeholder="笔记标题"
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
            {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                disabled={deletingNoteId === selectedNote.id}
                onClick={() => onDelete(selectedNote)}
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-50"
              >
                {deletingNoteId === selectedNote.id ? "删除中..." : "删除笔记"}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onCloseSettings} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                  关闭
                </button>
                <button disabled={saving} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
                  {saving ? "保存中..." : "保存属性"}
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
  onCreate,
  onSelect,
  onDraftChange,
  onSave,
  onDelete,
  onOpenSession
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
  onCreate: () => void;
  onSelect: (todo: TodoSummary) => void;
  onDraftChange: (field: keyof TodoDraft, value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (todo: TodoSummary) => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
}) {
  if (!project) {
    return <EmptyProjectNotice onCreateProject={() => undefined} />;
  }

  const noteOptions = notes.map((note) => ({ id: note.id, title: note.title }));
  const linkedNote = draft.sourceNoteId ? noteOptions.find((note) => note.id === draft.sourceNoteId) ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.8fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-medium">项目任务</div>
            <div className="mt-1 text-xs text-slate-500">任务属于具体项目，可保留状态、标签和来源笔记关联。</div>
          </div>
          <button onClick={onCreate} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-950">
            新建任务
          </button>
        </div>
        <div className="min-h-[320px] divide-y divide-white/10">
          {loading ? <div className="px-4 py-6 text-sm text-slate-400">项目任务加载中...</div> : null}
          {!loading && todos.length === 0 ? <div className="px-4 py-8 text-sm text-slate-500">当前项目还没有任务，可以手动创建或从笔记生成。</div> : null}
          {!loading
            ? todos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => onSelect(todo)}
                  className={`block w-full px-4 py-3 text-left text-sm ${selectedTodo?.id === todo.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-100">{todo.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-slate-500">{todo.description || "暂无描述"}</div>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">{formatTodoStatus(todo.status)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="truncate">来源：{todo.sourceNoteId ? "关联笔记" : "无"}</span>
                    <span>{formatDateTime(todo.updatedAt)}</span>
                  </div>
                </button>
              ))
            : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium text-slate-100">{selectedTodo ? "任务详情" : "新建任务"}</div>
          {selectedTodo ? (
            <button
              type="button"
              onClick={() => onOpenSession("todo", selectedTodo.id)}
              className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200"
            >
              从任务创建会话
            </button>
          ) : null}
        </div>
        <form onSubmit={onSave} className="mt-4 space-y-4">
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
              <select
                value={draft.status}
                onChange={(event) => onDraftChange("status", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
              >
                {todoStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="来源笔记">
              <select
                value={draft.sourceNoteId}
                onChange={(event) => onDraftChange("sourceNoteId", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
              >
                <option value="">不关联</option>
                {noteOptions.map((note) => (
                  <option key={note.id} value={note.id}>
                    {note.title}
                  </option>
                ))}
              </select>
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
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
              {saving ? "保存中..." : selectedTodo ? "保存修改" : "创建任务"}
            </button>
            {selectedTodo ? (
              <button
                type="button"
                disabled={deletingTodoId === selectedTodo.id}
                onClick={() => onDelete(selectedTodo)}
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-50"
              >
                {deletingTodoId === selectedTodo.id ? "删除中..." : "删除任务"}
              </button>
            ) : null}
          </div>
          {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
        </form>
      </section>
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
    default: return name;
  }
}

function formatToolSummary(name: string, input: Record<string, unknown>) {
  const title = (input.title || input.query || "") as string;
  return title ? String(title).slice(0, 80) : name;
}

function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
