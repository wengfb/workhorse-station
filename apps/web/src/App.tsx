import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type {
  CreateWorktreeRequest,
  HealthResponse,
  MetaResponse,
  ProjectSummary,
  WorktreeStatus,
  WorktreeSummary
} from "@workhorse-station/shared";
import {
  createProject,
  createWorktree,
  deleteProject,
  deleteWorktree,
  getHealth,
  getMeta,
  getProjects,
  getWorktrees,
  updateProject
} from "./api";

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

type ProjectMode = "create" | "edit";
type WorkspaceScope = "home" | "project";
type HomeMode = "chat" | "overview";
type ProjectTab = "overview" | "todos" | "notes" | "skills" | "sessions" | "worktrees";
type SessionView = "terminal" | "history";
type SessionLaunchSource = "direct" | "todo";
type MockSessionStatus = "running" | "completed" | "draft";
type ChatRole = "user" | "assistant";

type MockChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type MockChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: MockChatMessage[];
};

type MockTodo = {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
};

type MockSession = {
  id: string;
  name: string;
  status: MockSessionStatus;
  source: SessionLaunchSource;
  prompt: string;
  todoTitle?: string;
  createdAt: string;
};

const topModes: Array<{ id: HomeMode; label: string; description: string }> = [
  { id: "chat", label: "聊天", description: "左侧聊天会话列表，右侧简洁聊天区" },
  { id: "overview", label: "概览", description: "管理全局笔记、全局 Skill、最近项目和运行中会话" }
];

const homeModes = topModes;

const projectTabs: Array<{ id: ProjectTab; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "todos", label: "待办" },
  { id: "notes", label: "笔记" },
  { id: "skills", label: "Skill" },
  { id: "sessions", label: "会话" },
  { id: "worktrees", label: "Worktree" }
];

const mockTodos: MockTodo[] = [
  { id: "todo-ui", title: "整理项目内会话入口", status: "待处理", priority: "P1", source: "聊天草稿" },
  { id: "todo-skill", title: "定义会话内 Skill 注入方式", status: "草稿", priority: "P2", source: "项目笔记" }
];

const initialChatSessions: MockChatSession[] = [
  {
    id: "chat-product",
    title: "产品信息架构讨论",
    updatedAt: new Date().toISOString(),
    messages: [
      { id: "m1", role: "user", content: "首页应该更像 ChatGPT，左侧是聊天会话列表。" },
      { id: "m2", role: "assistant", content: "已记录：聊天会话和 Claude Code 会话分开，生成笔记、待办、提示词作为默认 Skill。" }
    ]
  },
  {
    id: "chat-skill",
    title: "默认 Skill 设计",
    updatedAt: new Date().toISOString(),
    messages: [{ id: "m3", role: "assistant", content: "默认 Skill 可以负责生成笔记、待办、提示词和文件摘要。" }]
  }
];

const initialSessions: MockSession[] = [
  {
    id: "session-placeholder-1",
    name: "UI 重构占位会话",
    status: "running",
    source: "direct",
    prompt: "前端占位会话：后续接入 Claude Code PTY 后展示真实终端输出。",
    createdAt: new Date().toISOString()
  }
];

export function App() {
  const [workspaceScope, setWorkspaceScope] = useState<WorkspaceScope>("home");
  const [activeHomeMode, setActiveHomeMode] = useState<HomeMode>("chat");
  const [chatSessions, setChatSessions] = useState<MockChatSession[]>(initialChatSessions);
  const [selectedChatId, setSelectedChatId] = useState(initialChatSessions[0]?.id ?? null);
  const [chatDraft, setChatDraft] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>("overview");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [worktreeDialogOpen, setWorktreeDialogOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessions[0]?.id ?? null);
  const [sessionView, setSessionView] = useState<SessionView>("terminal");
  const [sessionLaunchSource, setSessionLaunchSource] = useState<SessionLaunchSource>("direct");
  const [localSessions, setLocalSessions] = useState<MockSession[]>(initialSessions);
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

  useEffect(() => {
    let cancelled = false;

    async function loadAppState() {
      try {
        const [health, meta, projectsData] = await Promise.all([getHealth(), getMeta(), getProjects()]);

        if (cancelled) {
          return;
        }

        const firstProject = projectsData.projects[0] ?? null;
        setApiState({ health, meta, loading: false, error: null });
        setProjects(projectsData.projects);
        setProjectsLoading(false);

        if (firstProject) {
          setSelectedProjectId(firstProject.id);
          setProjectMode("edit");
          setProjectDraft(projectToDraft(firstProject));
        }
      } catch (error) {
        if (!cancelled) {
          setApiState((current) => ({
            ...current,
            loading: false,
            error: formatError(error, "API 连接失败")
          }));
          setProjectsLoading(false);
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
      return;
    }

    async function loadWorktrees(projectId: string) {
      setWorktreesLoading(true);
      setWorktreeError(null);

      try {
        const data = await getWorktrees(projectId);

        if (cancelled) {
          return;
        }

        const nextWorktree = data.worktrees.find((worktree) => worktree.id === selectedWorktreeId) ?? data.worktrees[0] ?? null;
        setWorktrees(data.worktrees);
        setSelectedWorktreeId(nextWorktree?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          setWorktreeError(formatError(error, "Worktree 列表加载失败"));
          setWorktrees([]);
          setSelectedWorktreeId(null);
        }
      } finally {
        if (!cancelled) {
          setWorktreesLoading(false);
        }
      }
    }

    void loadWorktrees(selectedProjectId);

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedWorktree = worktrees.find((worktree) => worktree.id === selectedWorktreeId) ?? null;
  const selectedSession = localSessions.find((session) => session.id === selectedSessionId) ?? localSessions[0] ?? null;
  const apiConnected = apiState.health?.status === "ok";
  const databaseInfo = apiState.meta?.database ?? null;
  const runningSessionCount = localSessions.filter((session) => session.status === "running").length;
  const homeMode = homeModes.find((mode) => mode.id === activeHomeMode) ?? homeModes[0];
  const selectedChat = chatSessions.find((session) => session.id === selectedChatId) ?? chatSessions[0] ?? null;
  const featureCards = [
    { title: "项目", value: String(projects.length), detail: "已接入项目 CRUD 和目录绑定" },
    { title: "Worktree", value: String(worktrees.length), detail: selectedProject ? "当前项目 worktree" : "选择项目后查看" },
    { title: "运行中会话", value: String(runningSessionCount), detail: "前端占位，后续接入 Claude Code" },
    { title: "SQLite", value: databaseInfo?.connected ? "已连接" : "等待中", detail: databaseInfo ? `FTS5: ${databaseInfo.fts5 ? "可用" : "不可用"}` : "等待后端" }
  ];

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

  function openWorktreeDialog() {
    setWorktreeDraft(emptyWorktreeDraft());
    setWorktreeError(null);
    setWorktreeDialogOpen(true);
  }

  function createChatSession() {
    const nextChat: MockChatSession = {
      id: `chat-${Date.now()}`,
      title: `新聊天 ${chatSessions.length + 1}`,
      updatedAt: new Date().toISOString(),
      messages: [{ id: `message-${Date.now()}`, role: "assistant", content: "新的聊天会话已创建。生成笔记、待办、提示词等能力会作为默认 Skill 通过自然语言触发。" }]
    };

    setChatSessions((current) => [nextChat, ...current]);
    setSelectedChatId(nextChat.id);
    setChatDraft("");
    setSelectedFileName(null);
  }

  function handleChatFileChange(fileName: string | null) {
    setSelectedFileName(fileName);
  }

  function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = chatDraft.trim();
    if (!content && !selectedFileName) {
      return;
    }

    const targetChat = selectedChat ?? chatSessions[0] ?? null;
    if (!targetChat) {
      createChatSession();
      return;
    }

    const now = new Date().toISOString();
    const userMessage: MockChatMessage = {
      id: `message-${Date.now()}`,
      role: "user",
      content: selectedFileName ? `${content || "请处理这个文件。"}\n\n附件：${selectedFileName}` : content
    };
    const assistantMessage: MockChatMessage = {
      id: `message-${Date.now() + 1}`,
      role: "assistant",
      content: "这是聊天前端占位回复。后续接入 Claude SDK 后，默认 Skill 会负责生成笔记、待办、提示词或文件摘要。"
    };

    setChatSessions((current) =>
      current.map((session) =>
        session.id === targetChat.id
          ? {
              ...session,
              updatedAt: now,
              title: session.title.startsWith("新聊天") && content ? content.slice(0, 18) : session.title,
              messages: [...session.messages, userMessage, assistantMessage]
            }
          : session
      )
    );
    setChatDraft("");
    setSelectedFileName(null);
  }

  function openSessionModal(source: SessionLaunchSource, todo?: MockTodo, sessionId?: string) {
    setSessionLaunchSource(source);
    setSessionView("terminal");

    if (sessionId) {
      setSelectedSessionId(sessionId);
      setSessionModalOpen(true);
      return;
    }

    const now = new Date().toISOString();
    const nextSession: MockSession = {
      id: `session-${Date.now()}`,
      name: source === "todo" ? `待办会话：${todo?.title ?? "未选择待办"}` : `直接会话 ${localSessions.length + 1}`,
      status: "running",
      source,
      todoTitle: todo?.title,
      prompt:
        source === "todo"
          ? `根据待办「${todo?.title ?? "未选择待办"}」生成 Claude Code prompt。`
          : "直接创建 Claude Code 会话，后续接入真实 prompt 编辑与 PTY。",
      createdAt: now
    };

    setLocalSessions((current) => [nextSession, ...current]);
    setSelectedSessionId(nextSession.id);
    setSessionModalOpen(true);
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
          placeholder="搜索项目、笔记、待办、Skill"
        />
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
            chatSessions={chatSessions}
            selectedChat={selectedChat}
            chatDraft={chatDraft}
            selectedFileName={selectedFileName}
            onChatSelect={(session) => setSelectedChatId(session.id)}
            onCreateChat={createChatSession}
            onChatDraftChange={setChatDraft}
            onChatFileChange={handleChatFileChange}
            onChatSubmit={sendChatMessage}
            onEnterProject={() => setWorkspaceScope("project")}
            onCreateSession={() => openSessionModal("direct")}
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
            localSessions={localSessions}
            mockTodos={mockTodos}
            onCreateProject={startCreateProject}
            onEditProject={startEditProject}
            onSelectProject={selectProject}
            onDeleteProject={handleProjectDelete}
            onCreateWorktree={openWorktreeDialog}
            onWorktreeSelect={(worktree) => setSelectedWorktreeId(worktree.id)}
            onWorktreeDelete={handleWorktreeDelete}
            onOpenSession={openSessionModal}
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

      {sessionModalOpen ? (
        <SessionModal
          sessions={localSessions}
          selectedSession={selectedSession}
          selectedProject={selectedProject}
          selectedWorktree={selectedWorktree}
          apiConnected={apiConnected}
          source={sessionLaunchSource}
          view={sessionView}
          mockTodos={mockTodos}
          onViewChange={setSessionView}
          onSelectSession={(session) => setSelectedSessionId(session.id)}
          onCreateSession={openSessionModal}
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
  chatSessions,
  selectedChat,
  chatDraft,
  selectedFileName,
  onChatSelect,
  onCreateChat,
  onChatDraftChange,
  onChatFileChange,
  onChatSubmit,
  onEnterProject,
  onCreateSession
}: {
  activeMode: HomeMode;
  activeModeInfo: { label: string; description: string };
  featureCards: Array<{ title: string; value: string; detail: string }>;
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  apiConnected: boolean;
  apiError: string | null;
  databaseInfo: MetaResponse["database"] | null;
  chatSessions: MockChatSession[];
  selectedChat: MockChatSession | null;
  chatDraft: string;
  selectedFileName: string | null;
  onChatSelect: (session: MockChatSession) => void;
  onCreateChat: () => void;
  onChatDraftChange: (value: string) => void;
  onChatFileChange: (fileName: string | null) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEnterProject: () => void;
  onCreateSession: () => void;
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
          selectedFileName={selectedFileName}
          onSelect={onChatSelect}
          onCreate={onCreateChat}
          onDraftChange={onChatDraftChange}
          onFileChange={onChatFileChange}
          onSubmit={onChatSubmit}
        />
      ) : (
        <HomeOverviewWorkspace
          featureCards={featureCards}
          apiConnected={apiConnected}
          apiError={apiError}
          databaseInfo={databaseInfo}
          chatSessions={chatSessions}
          onEnterProject={onEnterProject}
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
  selectedFileName,
  onSelect,
  onCreate,
  onDraftChange,
  onFileChange,
  onSubmit
}: {
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  chatSessions: MockChatSession[];
  selectedChat: MockChatSession | null;
  draft: string;
  selectedFileName: string | null;
  onSelect: (session: MockChatSession) => void;
  onCreate: () => void;
  onDraftChange: (value: string) => void;
  onFileChange: (fileName: string | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
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
          {chatSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session)}
              className={`min-w-56 rounded-xl p-3 text-left text-sm lg:block lg:w-full lg:min-w-0 ${
                selectedChat?.id === session.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
              }`}
            >
              <div className="truncate font-medium text-slate-100">{session.title}</div>
              <div className="mt-1 truncate text-xs text-slate-500">{formatDateTime(session.updatedAt)}</div>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-h-0 flex-col">
        <div className="mx-auto w-full max-w-[768px] px-4 py-3 text-xs text-slate-500">
          上下文：{selectedProject?.name ?? "未选择项目"} / {selectedWorktree?.name ?? "未选择 worktree"} · 默认 Skill：生成笔记、待办、提示词、文件摘要
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[768px] space-y-4 p-4 sm:p-6">
            {selectedChat?.messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                    message.role === "user" ? "bg-slate-100 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-200"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {!selectedChat ? <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">新建或选择一个聊天会话。</div> : null}
          </div>
        </div>
        <form onSubmit={onSubmit} className="p-3 sm:p-4">
          <div className="mx-auto w-full max-w-[768px]">
            {selectedFileName ? (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
                <span className="truncate">已选择文件：{selectedFileName}</span>
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
                  onChange={(event) => onFileChange(event.target.files?.[0]?.name ?? null)}
                />
              </label>
              <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="输入消息。需要生成笔记、待办、提示词时，直接用自然语言说明。"
              />
              <button className="shrink-0 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950">发送</button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

function HomeOverviewWorkspace({
  featureCards,
  apiConnected,
  apiError,
  databaseInfo,
  chatSessions,
  onEnterProject
}: {
  featureCards: Array<{ title: string; value: string; detail: string }>;
  apiConnected: boolean;
  apiError: string | null;
  databaseInfo: MetaResponse["database"] | null;
  chatSessions: MockChatSession[];
  onEnterProject: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
        <CollectionPlaceholder
          title="全局管理入口"
          description="概览集中承载笔记、Skill、最近项目和运行中会话。"
          items={["全局笔记", "全局 Skill", "最近聊天", "运行中 Claude Code 会话"]}
          detailTitle="概览详情"
          notice="全局笔记和 Skill 后续接入真实 API；聊天会话与 Claude Code 会话保持独立。"
        />
      </div>
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-slate-100">最近聊天</div>
            <p className="mt-1 text-xs text-slate-500">这里展示聊天会话，不是 Claude Code 执行会话。</p>
          </div>
          <button onClick={onEnterProject} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
            进入项目
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {chatSessions.map((session) => (
            <div key={session.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="truncate text-slate-100">{session.title}</div>
              <div className="mt-1 text-xs text-slate-500">{formatDateTime(session.updatedAt)}</div>
            </div>
          ))}
        </div>
      </section>
      <PlaceholderWorkspace apiConnected={apiConnected} apiError={apiError} databaseInfo={databaseInfo} />
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
  localSessions,
  mockTodos,
  onCreateProject,
  onEditProject,
  onSelectProject,
  onDeleteProject,
  onCreateWorktree,
  onWorktreeSelect,
  onWorktreeDelete,
  onOpenSession
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
  localSessions: MockSession[];
  mockTodos: MockTodo[];
  onCreateProject: () => void;
  onEditProject: () => void;
  onSelectProject: (project: ProjectSummary) => void;
  onDeleteProject: () => void;
  onCreateWorktree: () => void;
  onWorktreeSelect: (worktree: WorktreeSummary) => void;
  onWorktreeDelete: (worktree: WorktreeSummary) => void;
  onOpenSession: (source: SessionLaunchSource, todo?: MockTodo, sessionId?: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="rounded-2xl border border-white/10 bg-[#151821] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="text-xs text-slate-500">项目工作台</div>
            <h1 className="mt-2 text-2xl font-semibold">{selectedProject?.name ?? "选择或创建项目"}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              项目内承载待办、笔记、Skill、会话和 Worktree。会话终端通过模态框打开，关闭后继续后台运行。
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
        localSessions={localSessions}
        mockTodos={mockTodos}
        onCreateProject={onCreateProject}
        onEditProject={onEditProject}
        onSelectProject={onSelectProject}
        onDeleteProject={onDeleteProject}
        onCreateWorktree={onCreateWorktree}
        onWorktreeSelect={onWorktreeSelect}
        onWorktreeDelete={onWorktreeDelete}
        onOpenSession={onOpenSession}
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
  localSessions,
  mockTodos,
  onCreateProject,
  onEditProject,
  onSelectProject,
  onDeleteProject,
  onCreateWorktree,
  onWorktreeSelect,
  onWorktreeDelete,
  onOpenSession
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
  localSessions: MockSession[];
  mockTodos: MockTodo[];
  onCreateProject: () => void;
  onEditProject: () => void;
  onSelectProject: (project: ProjectSummary) => void;
  onDeleteProject: () => void;
  onCreateWorktree: () => void;
  onWorktreeSelect: (worktree: WorktreeSummary) => void;
  onWorktreeDelete: (worktree: WorktreeSummary) => void;
  onOpenSession: (source: SessionLaunchSource, todo?: MockTodo, sessionId?: string) => void;
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
      <SessionsWorkspace
        selectedProject={selectedProject}
        selectedWorktree={selectedWorktree}
        sessions={localSessions}
        mockTodos={mockTodos}
        onCreateProject={onCreateProject}
        onOpenSession={onOpenSession}
      />
    );
  }

  if (activeTab === "todos") {
    return (
      <ProjectCollectionPlaceholder
        title="项目待办"
        description="待办属于具体项目，可从笔记或聊天生成，并可继续创建 Claude Code 会话。"
        items={mockTodos.map((todo) => `${todo.priority} · ${todo.title}`)}
        detailTitle="待办详情"
        selectedProject={selectedProject}
        actionLabel="从待办创建会话"
        onAction={() => onOpenSession("todo", mockTodos[0])}
      />
    );
  }

  if (activeTab === "notes") {
    return (
      <ProjectCollectionPlaceholder
        title="项目笔记"
        description="项目笔记用于沉淀当前项目上下文，可转成待办草稿。"
        items={["UI 信息架构调整", "Worktree 删除风险", "会话后台运行说明"]}
        detailTitle="项目笔记详情"
        selectedProject={selectedProject}
        actionLabel="生成待办草稿"
      />
    );
  }

  if (activeTab === "skills") {
    return (
      <ProjectCollectionPlaceholder
        title="项目 Skill"
        description="项目级 Skill 可覆盖全局 Skill，并在 prompt 或会话创建时注入。"
        items={["project/review", "project/session-bootstrap", "project/ui-check"]}
        detailTitle="项目 Skill 详情"
        selectedProject={selectedProject}
        actionLabel="注入到会话"
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
  onDelete
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

function SessionsWorkspace({
  selectedProject,
  selectedWorktree,
  sessions,
  mockTodos,
  onCreateProject,
  onOpenSession
}: {
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  sessions: MockSession[];
  mockTodos: MockTodo[];
  onCreateProject: () => void;
  onOpenSession: (source: SessionLaunchSource, todo?: MockTodo, sessionId?: string) => void;
}) {
  if (!selectedProject) {
    return <EmptyProjectNotice onCreateProject={onCreateProject} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(360px,0.7fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="text-sm font-medium text-slate-100">Claude Code 会话</div>
            <p className="mt-1 text-xs text-slate-500">当前是前端占位，尚未连接真实 Claude Code PTY / 会话后端。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onOpenSession("direct")} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
              直接创建
            </button>
            <button onClick={() => onOpenSession("todo", mockTodos[0])} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
              从待办创建
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {sessions.map((session) => (
            <button key={session.id} onClick={() => onOpenSession(session.source, undefined, session.id)} className="block w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left text-sm hover:bg-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-100">{session.name}</span>
                <SessionStatusPill status={session.status} />
              </div>
              <div className="mt-2 text-xs text-slate-500">来源：{session.source === "todo" ? `待办 · ${session.todoTitle ?? "未命名"}` : "直接创建"}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="font-medium text-slate-100">会话上下文</div>
        <div className="mt-4 space-y-2">
          <DetailRow label="项目" value={selectedProject.name} />
          <DetailRow label="Worktree" value={selectedWorktree?.name ?? "未选择"} />
          <DetailRow label="会话入口" value="直接创建 / 从待办创建" />
          <DetailRow label="关闭窗口" value="后台运行，不停止会话" />
        </div>
        <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
          后续接入真实后端后，这里会展示会话持久化、PTY 状态和历史摘要。
        </p>
      </section>
    </div>
  );
}

function SessionModal({
  sessions,
  selectedSession,
  selectedProject,
  selectedWorktree,
  apiConnected,
  source,
  view,
  mockTodos,
  onViewChange,
  onSelectSession,
  onCreateSession,
  onClose
}: {
  sessions: MockSession[];
  selectedSession: MockSession | null;
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  apiConnected: boolean;
  source: SessionLaunchSource;
  view: SessionView;
  mockTodos: MockTodo[];
  onViewChange: (view: SessionView) => void;
  onSelectSession: (session: MockSession) => void;
  onCreateSession: (source: SessionLaunchSource, todo?: MockTodo) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 md:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[#101114] shadow-2xl md:max-w-[min(96vw,1800px)] md:rounded-2xl md:border md:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">会话执行：{selectedSession?.name ?? "未选择会话"}</div>
            <div className="mt-1 text-xs text-slate-500">关闭窗口表示后台运行；当前为前端占位，尚未连接真实 PTY。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 opacity-50">
              停止会话（未接入）
            </button>
            <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
              后台运行 / 关闭
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[3fr_7fr]">
          <SessionListPane
            sessions={sessions}
            selectedSession={selectedSession}
            source={source}
            mockTodos={mockTodos}
            onSelectSession={onSelectSession}
            onCreateSession={onCreateSession}
          />
          <section className="flex min-h-0 flex-col bg-black/20">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
              <div className="flex gap-1">
                {[
                  { id: "terminal", label: "操作终端" },
                  { id: "history", label: "查看历史" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onViewChange(tab.id as SessionView)}
                    className={`rounded-md px-3 py-1.5 text-sm ${view === tab.id ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">前端占位</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {view === "terminal" ? (
                <SessionTerminalPane
                  apiConnected={apiConnected}
                  selectedProject={selectedProject}
                  selectedWorktree={selectedWorktree}
                  selectedSession={selectedSession}
                />
              ) : (
                <SessionHistoryPane selectedSession={selectedSession} selectedProject={selectedProject} selectedWorktree={selectedWorktree} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SessionListPane({
  sessions,
  selectedSession,
  source,
  mockTodos,
  onSelectSession,
  onCreateSession
}: {
  sessions: MockSession[];
  selectedSession: MockSession | null;
  source: SessionLaunchSource;
  mockTodos: MockTodo[];
  onSelectSession: (session: MockSession) => void;
  onCreateSession: (source: SessionLaunchSource, todo?: MockTodo) => void;
}) {
  return (
    <aside className="min-h-0 overflow-auto border-b border-white/10 bg-[#151821] p-4 xl:border-b-0 xl:border-r">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-100">会话列表</div>
          <div className="mt-1 text-xs text-slate-500">最近入口：{source === "todo" ? "从待办创建" : "直接创建"}</div>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">{sessions.length} 个</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => onCreateSession("direct")} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
          直接创建
        </button>
        <button onClick={() => onCreateSession("todo", mockTodos[0])} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
          从待办创建
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session)}
            className={`block w-full rounded-lg border p-3 text-left text-sm ${
              selectedSession?.id === session.id ? "border-slate-300/50 bg-white/[0.08]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-slate-100">{session.name}</span>
              <SessionStatusPill status={session.status} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{formatDateTime(session.createdAt)}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function SessionTerminalPane({
  apiConnected,
  selectedProject,
  selectedWorktree,
  selectedSession
}: {
  apiConnected: boolean;
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  selectedSession: MockSession | null;
}) {
  const cwd = selectedWorktree?.path ?? selectedProject?.path ?? "-";

  return (
    <div className="min-h-[420px] rounded-xl border border-white/10 bg-black p-4 font-mono text-sm text-emerald-200 xl:min-h-full">
      <div>$ workhorse-station session</div>
      <div className="mt-2 text-slate-500">会话模态框终端占位，后续接入 xterm.js、PTY 和 Claude Code。</div>
      <div className="mt-4">api: {apiConnected ? "connected" : "waiting"}</div>
      <div className="mt-1">session: {selectedSession?.name ?? "none"}</div>
      <div className="mt-1">project: {selectedProject?.name ?? "none"}</div>
      <div className="mt-1">worktree: {selectedWorktree?.name ?? "none"}</div>
      <div className="mt-1">branch: {selectedWorktree?.branch ?? selectedProject?.defaultBranch ?? "-"}</div>
      <div className="mt-1">status: {selectedWorktree?.status ?? "-"}</div>
      <div className="mt-1 break-all">cwd: {cwd}</div>
      <div className="mt-4 text-slate-500">prompt:</div>
      <div className="mt-1 whitespace-pre-wrap text-emerald-100">{selectedSession?.prompt ?? "尚未选择会话"}</div>
      <div className="mt-2 animate-pulse">_</div>
    </div>
  );
}

function SessionHistoryPane({
  selectedSession,
  selectedProject,
  selectedWorktree
}: {
  selectedSession: MockSession | null;
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
      <div>
        <div className="font-medium text-slate-100">会话历史</div>
        <p className="mt-2 text-slate-400">当前是前端占位，后续保存 Claude Code 输出、摘要和继续会话信息。</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DetailCard label="会话" value={selectedSession?.name ?? "未选择"} />
        <DetailCard label="来源" value={selectedSession?.source === "todo" ? `待办：${selectedSession.todoTitle ?? "未命名"}` : "直接创建"} />
        <DetailCard label="项目" value={selectedProject?.name ?? "未选择"} />
        <DetailCard label="Worktree" value={selectedWorktree?.name ?? "未选择"} />
      </div>
      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="text-xs text-slate-500">历史摘要</div>
        <p className="mt-2 text-slate-300">等待接入会话输出流和摘要生成。关闭模态框后，会话应继续在后台运行。</p>
      </div>
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
          {["首页聊天生成草稿", "进入项目选择 worktree", "从待办创建会话", "会话模态框后台运行"].map((item, index) => (
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
          <DetailRow label="当前阶段" value="Phase 1 + UI 方向调整" />
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
      <p className="mt-2">进入项目后才能查看待办、项目笔记、项目 Skill、会话和 Worktree。</p>
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

function SessionStatusPill({ status }: { status: MockSessionStatus }) {
  const styles: Record<MockSessionStatus, string> = {
    running: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    completed: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    draft: "border-amber-400/30 bg-amber-400/10 text-amber-200"
  };

  const labels: Record<MockSessionStatus, string> = {
    running: "running",
    completed: "completed",
    draft: "draft"
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

function worktreeDraftToRequest(draft: WorktreeDraft): CreateWorktreeRequest {
  return {
    name: draft.name,
    branch: draft.branch.trim() || undefined,
    baseBranch: draft.baseBranch.trim() || undefined
  };
}

function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
