import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { HealthResponse, MetaResponse, ProjectSummary } from "@workhorse-station/shared";
import { createProject, deleteProject, getHealth, getMeta, getProjects, updateProject } from "./api";

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

type ProjectMode = "create" | "edit";

const mainTabs = ["总览", "项目", "笔记", "待办", "Skill", "会话", "历史"];
const sideTabs = ["终端", "AI 聊天", "会话输出"];

export function App() {
  const [activeMainTab, setActiveMainTab] = useState(mainTabs[0]);
  const [activeSideTab, setActiveSideTab] = useState(sideTabs[0]);
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
            error: error instanceof Error ? error.message : "API 连接失败"
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

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const apiConnected = apiState.health?.status === "ok";
  const databaseInfo = apiState.meta?.database ?? null;
  const featureCards = [
    { title: "项目", value: String(projects.length), detail: "已接入项目 CRUD 和目录绑定" },
    { title: "Worktree", value: "0", detail: "下一步接入项目级 worktree" },
    { title: "待办", value: "0", detail: "Phase 2 支持笔记转待办" },
    { title: "会话", value: "0", detail: "Phase 5 接入 Claude Code" }
  ];

  const sideContent = useMemo(() => {
    if (activeSideTab === "AI 聊天") {
      return <ChatPlaceholder />;
    }

    if (activeSideTab === "会话输出") {
      return <SessionPlaceholder />;
    }

    return <TerminalPlaceholder apiConnected={apiConnected} selectedProject={selectedProject} />;
  }, [activeSideTab, apiConnected, selectedProject]);

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
        setSelectedProjectId(nextProject.id);
        setProjectMode("edit");
        setProjectDraft(projectToDraft(nextProject));
      } else {
        setSelectedProjectId(null);
        setProjectMode("create");
        setProjectDraft(emptyProjectDraft());
      }
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "项目列表加载失败");
    } finally {
      setProjectsLoading(false);
    }
  }

  function startCreateProject() {
    setActiveMainTab("项目");
    setSelectedProjectId(null);
    setProjectMode("create");
    setProjectDraft(emptyProjectDraft());
    setProjectError(null);
  }

  function selectProject(project: ProjectSummary) {
    setSelectedProjectId(project.id);
    setProjectMode("edit");
    setProjectDraft(projectToDraft(project));
    setProjectError(null);
  }

  function updateProjectDraft(field: keyof ProjectDraft, value: string) {
    setProjectDraft((current) => ({
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
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "项目保存失败");
    } finally {
      setSavingProject(false);
    }
  }

  async function handleProjectDelete() {
    if (!selectedProject) {
      return;
    }

    const confirmed = window.confirm("删除项目只会移除 Workhorse Station 中的记录，不会删除本地代码目录。确认删除？");

    if (!confirmed) {
      return;
    }

    setDeletingProject(true);
    setProjectError(null);

    try {
      await deleteProject(selectedProject.id);
      await reloadProjects(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "项目删除失败");
    } finally {
      setDeletingProject(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0c10] text-slate-100">
      <header className="flex h-16 items-center gap-3 border-b border-white/10 bg-[#111318] px-5">
        <div className="mr-2">
          <div className="text-sm font-semibold tracking-wide">Workhorse Station</div>
          <div className="text-xs text-slate-400">Phase 1 项目管理</div>
        </div>
        <button
          onClick={() => setActiveMainTab("项目")}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          项目：{selectedProject?.name ?? "未选择"}
        </button>
        <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
          默认分支：{selectedProject?.defaultBranch ?? "main"}
        </button>
        <input
          className="min-w-72 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-slate-400"
          placeholder="搜索项目、笔记、待办、Skill"
        />
        <button onClick={startCreateProject} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
          新建项目
        </button>
        <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">新建待办</button>
        <button className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">新建会话</button>
      </header>

      <main className="grid flex-1 grid-cols-[minmax(0,1fr)_420px] overflow-hidden">
        <section className="flex min-w-0 flex-col border-r border-white/10 bg-[#0f1117]">
          <nav className="flex gap-1 border-b border-white/10 px-5 py-3">
            {mainTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveMainTab(tab)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  activeMainTab === tab ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-auto p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">{activeMainTab}</h1>
                <p className="mt-1 text-sm text-slate-400">
                  {activeMainTab === "项目"
                    ? "绑定本机 Git 仓库目录，作为 worktree、待办和会话的父级上下文。"
                    : "Notion 风格的列表 / 详情联动区域，当前保留后续模块占位。"}
                </p>
              </div>
              <StatusPill connected={apiConnected} loading={apiState.loading} />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {featureCards.map((card) => (
                <article key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs text-slate-500">{card.title}</div>
                  <div className="mt-2 text-2xl font-semibold">{card.value}</div>
                  <div className="mt-2 text-xs text-slate-400">{card.detail}</div>
                </article>
              ))}
            </div>

            {activeMainTab === "项目" ? (
              <ProjectWorkspace
                projects={projects}
                selectedProject={selectedProject}
                mode={projectMode}
                draft={projectDraft}
                loading={projectsLoading}
                saving={savingProject}
                deleting={deletingProject}
                error={projectError}
                onCreate={startCreateProject}
                onSelect={selectProject}
                onDraftChange={updateProjectDraft}
                onSubmit={handleProjectSubmit}
                onDelete={handleProjectDelete}
              />
            ) : (
              <PlaceholderWorkspace apiConnected={apiConnected} apiError={apiState.error} databaseInfo={databaseInfo} />
            )}
          </div>
        </section>

        <aside className="flex min-w-0 flex-col bg-[#101114]">
          <div className="flex border-b border-white/10 p-3">
            {sideTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSideTab(tab)}
                className={`flex-1 rounded-md px-3 py-2 text-sm ${
                  activeSideTab === tab ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-4">{sideContent}</div>
        </aside>
      </main>
    </div>
  );
}

function ProjectWorkspace({
  projects,
  selectedProject,
  mode,
  draft,
  loading,
  saving,
  deleting,
  error,
  onCreate,
  onSelect,
  onDraftChange,
  onSubmit,
  onDelete
}: {
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  mode: ProjectMode;
  draft: ProjectDraft;
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onCreate: () => void;
  onSelect: (project: ProjectSummary) => void;
  onDraftChange: (field: keyof ProjectDraft, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-5 grid grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)] gap-4">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm font-medium">项目列表</div>
          <button onClick={onCreate} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-950">
            新建项目
          </button>
        </div>
        <div className="min-h-[360px] divide-y divide-white/10">
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
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">
          {mode === "create" ? "新建项目" : "项目详情 / 属性"}
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-4 text-sm text-slate-300">
          <Field label="名称">
            <input
              value={draft.name}
              onChange={(event) => onDraftChange("name", event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
              placeholder="workhorse-station"
            />
          </Field>
          <Field label="代码目录">
            <input
              value={draft.path}
              onChange={(event) => onDraftChange("path", event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
              placeholder="/home/wengfb/projects/workhorse-station"
            />
          </Field>
          <Field label="默认分支">
            <input
              value={draft.defaultBranch}
              onChange={(event) => onDraftChange("defaultBranch", event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
              placeholder="main"
            />
          </Field>
          <Field label="备注">
            <textarea
              value={draft.description}
              onChange={(event) => onDraftChange("description", event.target.value)}
              className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
              placeholder="记录项目用途、约束或当前阶段"
            />
          </Field>

          {selectedProject && mode === "edit" ? (
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <DetailRow label="创建时间" value={formatDateTime(selectedProject.createdAt)} />
              <DetailRow label="更新时间" value={formatDateTime(selectedProject.updatedAt)} />
              <DetailRow label="Worktree 目录" value={`${selectedProject.path}/.claude/worktree/`} />
            </div>
          ) : null}

          {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}

          <div className="flex gap-2">
            <button disabled={saving} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-60">
              {saving ? "保存中..." : mode === "create" ? "创建项目" : "保存修改"}
            </button>
            {mode === "edit" ? (
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-60"
              >
                {deleting ? "删除中..." : "删除项目"}
              </button>
            ) : null}
          </div>
        </form>
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
    <div className="mt-5 grid grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)] gap-4">
      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">列表视图</div>
        <div className="divide-y divide-white/10">
          {["绑定第一个项目", "创建项目级 worktree", "记录随手记", "生成 Claude Code prompt"].map((item, index) => (
            <div key={item} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="text-slate-200">{item}</div>
                <div className="text-xs text-slate-500">MVP 闭环步骤 {index + 1}</div>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">待实现</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#151821]">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">详情 / 属性</div>
        <div className="space-y-4 p-4 text-sm text-slate-300">
          <DetailRow label="当前阶段" value="Phase 1" />
          <DetailRow label="API 状态" value={apiConnected ? "已连接" : "未连接"} />
          <DetailRow label="SQLite" value={databaseInfo?.connected ? "已初始化" : "等待后端"} />
          <DetailRow label="FTS5" value={databaseInfo ? (databaseInfo.fts5 ? "可用" : "不可用") : "未知"} />
          {apiError ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{apiError}</p> : null}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right text-slate-100">{value}</span>
    </div>
  );
}

function TerminalPlaceholder({ apiConnected, selectedProject }: { apiConnected: boolean; selectedProject: ProjectSummary | null }) {
  return (
    <div className="h-full rounded-xl border border-white/10 bg-black p-4 font-mono text-sm text-emerald-200">
      <div>$ workhorse-station</div>
      <div className="mt-2 text-slate-500">右侧默认终端占位，后续接入 xterm.js 与 PTY。</div>
      <div className="mt-4">API: {apiConnected ? "connected" : "waiting"}</div>
      <div className="mt-1">phase: 1</div>
      <div className="mt-1">project: {selectedProject?.name ?? "none"}</div>
      <div className="mt-1 truncate">path: {selectedProject?.path ?? "-"}</div>
      <div className="mt-1 animate-pulse">_</div>
    </div>
  );
}

function ChatPlaceholder() {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="rounded-lg bg-white/10 p-3 text-slate-200">AI 聊天窗口占位</div>
      <div className="rounded-lg border border-white/10 p-3 text-slate-400">后续接入 Claude SDK、工具调用和草稿确认。</div>
      <input className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="输入任务、笔记或 prompt 需求" />
    </div>
  );
}

function SessionPlaceholder() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
      <div className="font-medium text-slate-100">Claude Code 会话输出</div>
      <p className="mt-2 text-slate-400">Phase 5 将绑定项目、worktree、prompt 和待办，并保存会话摘要。</p>
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

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
