import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  ExecutionListItem,
  ProjectSummary,
  PromptDraftSummary,
  SessionSource,
  SessionHistoryMessage,
  SessionStatus,
  SessionStreamEvent,
  SessionSummary,
  TodoSummary,
  WorktreeSummary,
  WorkspaceTerminalStreamEvent,
  WorkspaceTerminalSummary
} from "@workhorse-station/shared";
import { getSessionHistory } from "./api";
import { SessionTerminal } from "./session-terminal";
import { WorkspaceTerminal } from "./workspace-terminal";
import { Select } from "./components/ui/Select";

export type SessionEditorDraft = {
  sessionName: string;
  promptTitle: string;
  prompt: string;
  todoId: string;
  worktreeId: string;
  requestedWorktreeName: string;
  promptDraftId: string;
  resumeSessionId: string;
  forkSession: boolean;
};

type ExecutionKindFilter = "all" | ExecutionListItem["kind"];
type ExecutionStatusFilter = "all" | "active" | "stopped" | "failed";
type SessionView = "terminal" | "history";

export function SessionsWorkspace({
  selectedProject,
  selectedWorktree,
  sessions,
  promptDrafts,
  todos,
  loading,
  error,
  onOpenSession
}: {
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  sessions: SessionSummary[];
  promptDrafts: PromptDraftSummary[];
  todos: TodoSummary[];
  loading: boolean;
  error: string | null;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
}) {
  if (!selectedProject) {
    return <EmptyProjectNotice />;
  }

  const firstTodo = todos[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(360px,0.7fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="text-sm font-medium text-slate-100">Claude Code 会话</div>
            <p className="mt-1 text-xs text-slate-500">会话已接入真实启动，可绑定已有 Worktree 或在启动时自动创建新 Worktree。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onOpenSession("direct")} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">
              直接创建
            </button>
            <button
              disabled={!firstTodo}
              onClick={() => onOpenSession("todo", firstTodo?.id)}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              从任务创建
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-white/10 px-2 py-1">会话 {sessions.length}</span>
          <span className="rounded-full border border-white/10 px-2 py-1">Prompt 草稿 {promptDrafts.length}</span>
          <span className="rounded-full border border-white/10 px-2 py-1">当前 Worktree：{selectedWorktree?.name ?? "未选择"}</span>
        </div>

        {error ? <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
        {loading ? <div className="mt-4 rounded-lg border border-white/10 p-3 text-xs text-slate-400">会话加载中...</div> : null}
        {!loading && sessions.length === 0 ? <div className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-xs text-slate-500">当前项目还没有保存的会话记录。</div> : null}

        {!loading && sessions.length > 0 ? (
          <div className="mt-4 space-y-2">
            {sessions.map((session) => (
              <button key={session.id} onClick={() => onOpenSession(session.source, session.todoId ?? undefined, session.id)} className="block w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left text-sm hover:bg-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">{session.name}</span>
                  <SessionStatusPill status={session.status} />
                </div>
                <div className="mt-2 text-xs text-slate-500">来源：{session.source === "todo" ? "任务" : "直接创建"}</div>
                {session.summary ? <div className="mt-1 line-clamp-2 text-xs text-slate-400">结果：{session.summary}</div> : null}
                <div className="mt-1 text-xs text-slate-500">更新：{formatDateTime(session.updatedAt)}</div>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
        <div className="font-medium text-slate-100">会话上下文</div>
        <div className="mt-4 space-y-2">
          <DetailRow label="项目" value={selectedProject.name} />
          <DetailRow label="Worktree" value={selectedWorktree?.name ?? "未选择"} />
          <DetailRow label="Prompt 草稿" value={String(promptDrafts.length)} />
          <DetailRow label="关闭窗口" value="后台运行，不停止会话" />
        </div>
        <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-100">当前版本支持真实 Claude Code 会话启动、终端输出和停止操作；删除会话不会自动删除关联 Worktree。</p>
      </section>
    </div>
  );
}

export function CreateSessionModal({
  todos,
  worktrees,
  sessions,
  selectedProject,
  selectedWorktree,
  source,
  draft,
  error,
  loading,
  previewingPrompt,
  savingPromptDraft,
  creatingSession,
  onDraftChange,
  onPreviewPrompt,
  onSavePromptDraft,
  onCreateSession,
  onClose
}: {
  todos: TodoSummary[];
  worktrees: WorktreeSummary[];
  sessions: SessionSummary[];
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  source: SessionSource;
  draft: SessionEditorDraft;
  error: string | null;
  loading: boolean;
  previewingPrompt: boolean;
  savingPromptDraft: boolean;
  creatingSession: boolean;
  onDraftChange: (field: keyof SessionEditorDraft, value: string | boolean) => void;
  onPreviewPrompt: () => void;
  onSavePromptDraft: () => void;
  onCreateSession: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 md:p-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#101114] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">创建 Claude Code 会话</div>
            <div className="mt-1 text-xs text-slate-500">先确认 prompt 草稿，再真实启动 Claude Code 会话并打开终端。</div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            关闭
          </button>
        </div>

        <div className="max-h-[calc(100vh-120px)] overflow-auto p-4 md:p-5">
          <section className="rounded-xl border border-white/10 bg-[#151821] p-4 text-sm text-slate-300">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-100">会话创建表单</div>
                <p className="mt-1 text-xs text-slate-500">入口：{source === "todo" ? "从任务创建" : "直接创建"}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>项目：{selectedProject?.name ?? "未选择"}</div>
                <div className="mt-1">当前 Worktree：{selectedWorktree?.name ?? "未选择"}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Field label="会话名称">
                <input
                  value={draft.sessionName}
                  onChange={(event) => onDraftChange("sessionName", event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                  placeholder="例如：任务会话 / 直接会话"
                />
              </Field>
              <Field label="Prompt 标题">
                <input
                  value={draft.promptTitle}
                  onChange={(event) => onDraftChange("promptTitle", event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                  placeholder="例如：Prompt 草稿：会话入口改造"
                />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Field label="关联任务">
                <Select
                  value={draft.todoId}
                  onChange={(value) => onDraftChange("todoId", value)}
                  options={[{ value: "", label: "不关联" }, ...todos.map((t) => ({ value: t.id, label: t.title }))]}
                />
              </Field>
              <Field label="选择已有 Worktree">
                <Select
                  value={draft.worktreeId}
                  onChange={(value) => onDraftChange("worktreeId", value)}
                  options={[{ value: "", label: "不绑定" }, ...worktrees.map((w) => ({ value: w.id, label: w.name }))]}
                />
              </Field>
              <Field label="或填写新 Worktree 名称">
                <input
                  value={draft.requestedWorktreeName}
                  onChange={(event) => onDraftChange("requestedWorktreeName", event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                  placeholder="例如：phase-2-session-flow"
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-slate-500">已有 Worktree 和新 Worktree 名称二选一；填写新名称时会在启动会话时自动创建。</p>
            {sessions.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Field label="续接历史会话（可选）">
                  <Select
                    value={draft.resumeSessionId}
                    onChange={(value) => onDraftChange("resumeSessionId", value)}
                    options={[
                      { value: "", label: "不续接，全新会话" },
                      ...sessions
                        .filter((s) => s.status === "completed" || s.status === "failed")
                        .map((s) => ({ value: s.id, label: `${s.name} (${s.status})` }))
                    ]}
                  />
                </Field>
                {draft.resumeSessionId ? (
                  <Field label="分叉模式">
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={draft.forkSession}
                        onChange={(event) => onDraftChange("forkSession", event.target.checked)}
                        className="rounded border-white/10 bg-black/20"
                      />
                      分叉会话（保留原会话历史，在新分支中继续）
                    </label>
                  </Field>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4">
              <Field label="Prompt 正文">
                <textarea
                  value={draft.prompt}
                  onChange={(event) => onDraftChange("prompt", event.target.value)}
                  className="min-h-56 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                  placeholder="先生成 prompt 草稿，或直接手动编辑。"
                />
              </Field>
            </div>
            {error ? <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || previewingPrompt}
                onClick={onPreviewPrompt}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {previewingPrompt ? "生成中..." : "生成 Prompt 草稿"}
              </button>
              <button
                type="button"
                disabled={loading || savingPromptDraft}
                onClick={onSavePromptDraft}
                className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPromptDraft ? "保存中..." : draft.promptDraftId ? "更新草稿" : "保存草稿"}
              </button>
              <button
                type="button"
                disabled={loading || creatingSession}
                onClick={onCreateSession}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingSession ? "启动中..." : "启动会话并打开"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function ExecutionModalFrame({
  title,
  subtitle,
  sidebar,
  content,
  onClose
}: {
  title: string;
  subtitle: string;
  sidebar: ReactNode;
  content: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 md:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[#101114] shadow-2xl md:max-w-[min(96vw,1800px)] md:rounded-2xl md:border md:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">{title}</div>
            <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            关闭
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-auto border-b border-white/10 bg-[#151821] p-3 xl:border-b-0 xl:border-r">{sidebar}</aside>
          <section className="flex min-h-0 flex-col overflow-hidden bg-black/20">{content}</section>
        </div>
      </div>
    </div>
  );
}

export function SessionModal({
  executionItems,
  selectedExecution,
  sessions,
  selectedSession,
  selectedProject,
  projects,
  todos,
  worktrees,
  workspaceTerminal,
  workspaceTerminalError,
  openingWorkspaceTerminal,
  stoppingWorkspaceTerminal,
  draft,
  error,
  loading,
  updatingSessionId,
  renamingSessionId,
  deletingSessionId,
  deletingWorkspaceTerminalId,
  continuingSessionId,
  onSelectExecution,
  onRenameSession,
  onStopSession,
  onDeleteSession,
  onDeleteWorkspaceTerminal,
  onContinueSession,
  onRuntimeEvent,
  onRestartWorkspaceTerminal,
  onStopWorkspaceTerminal,
  onWorkspaceTerminalRuntimeEvent,
  onClose
}: {
  executionItems: ExecutionListItem[];
  selectedExecution: ExecutionListItem | null;
  sessions: SessionSummary[];
  selectedSession: SessionSummary | null;
  selectedProject: ProjectSummary | null;
  projects: ProjectSummary[];
  todos: TodoSummary[];
  worktrees: WorktreeSummary[];
  workspaceTerminal: WorkspaceTerminalSummary | null;
  workspaceTerminalError: string | null;
  openingWorkspaceTerminal: boolean;
  stoppingWorkspaceTerminal: boolean;
  draft: SessionEditorDraft;
  error: string | null;
  loading: boolean;
  updatingSessionId: string | null;
  renamingSessionId: string | null;
  deletingSessionId: string | null;
  deletingWorkspaceTerminalId: string | null;
  continuingSessionId: string | null;
  onSelectExecution: (execution: ExecutionListItem) => void;
  onRenameSession: (session: SessionSummary | Extract<ExecutionListItem, { kind: "session" }>) => void;
  onStopSession: (session: SessionSummary | Extract<ExecutionListItem, { kind: "session" }>) => void;
  onDeleteSession: (session: SessionSummary | Extract<ExecutionListItem, { kind: "session" }>) => void;
  onDeleteWorkspaceTerminal: (execution: Extract<ExecutionListItem, { kind: "workspace-terminal" }>) => void;
  onContinueSession: (session: SessionSummary | Extract<ExecutionListItem, { kind: "session" }>) => void;
  onRuntimeEvent: (event: SessionStreamEvent) => void;
  onRestartWorkspaceTerminal: () => void;
  onStopWorkspaceTerminal: () => void;
  onWorkspaceTerminalRuntimeEvent: (event: WorkspaceTerminalStreamEvent) => void;
  onClose: () => void;
}) {
  const runtimeStatus = selectedSession?.runtimeStatus ?? null;
  const isWorkspaceTerminalSelected = selectedExecution?.kind === "workspace-terminal";
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<ExecutionKindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ExecutionStatusFilter>("active");
  const [expandedActionKey, setExpandedActionKey] = useState<string | null>(null);
  const [view, setView] = useState<SessionView>("terminal");
  const [historyMessages, setHistoryMessages] = useState<SessionHistoryMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (isWorkspaceTerminalSelected) {
      setView("terminal");
    }
  }, [isWorkspaceTerminalSelected]);

  useEffect(() => {
    if (view !== "history" || !selectedSession || !selectedProject || isWorkspaceTerminalSelected) {
      return;
    }

    let disposed = false;
    setHistoryLoading(true);

    getSessionHistory(selectedProject.id, selectedSession.id)
      .then((response) => {
        if (!disposed) {
          setHistoryMessages(response.messages);
        }
      })
      .catch(() => {
        if (!disposed) {
          setHistoryMessages([]);
        }
      })
      .finally(() => {
        if (!disposed) {
          setHistoryLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [isWorkspaceTerminalSelected, selectedProject, selectedSession, view]);

  const filteredExecutionItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return executionItems.filter((execution) => {
      if (projectFilter !== "all" && execution.projectId !== projectFilter) {
        return false;
      }

      if (kindFilter !== "all" && execution.kind !== kindFilter) {
        return false;
      }

      if (!matchesExecutionStatus(execution, statusFilter)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const session = execution.kind === "session" ? sessions.find((item) => item.id === execution.id) ?? null : null;
      const worktree = session?.worktreeId ? worktrees.find((item) => item.id === session.worktreeId) ?? null : null;
      const todoTitle = session?.todoId ? todos.find((item) => item.id === session.todoId)?.title ?? null : null;
      const haystack = [execution.name, execution.projectName, execution.requestedWorktreeName, execution.cwd, execution.summary, worktree?.name, todoTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [executionItems, kindFilter, projectFilter, searchQuery, sessions, statusFilter, todos, worktrees]);

  return (
    <ExecutionModalFrame
      title={`会话执行：${selectedExecution?.name || selectedSession?.name || draft.sessionName || "新会话"}`}
      subtitle="Claude Code 会话与普通终端共用同一个全局执行列表。"
      onClose={onClose}
      sidebar={
        <>
          <div className="space-y-2">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-slate-400"
              placeholder="搜索会话、终端、项目或 worktree"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-400"
              >
                <option value="all">全部项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ExecutionStatusFilter)}
                className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-400"
              >
                <option value="all">全部状态</option>
                <option value="active">运行中</option>
                <option value="stopped">已停止</option>
                <option value="failed">失败</option>
              </select>
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as ExecutionKindFilter)}
                className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-400"
              >
                <option value="all">全部类型</option>
                <option value="session">Claude 会话</option>
                <option value="workspace-terminal">普通终端</option>
              </select>
            </div>
          </div>
          {error ? <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
          {workspaceTerminalError && isWorkspaceTerminalSelected ? <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{workspaceTerminalError}</p> : null}
          <div className="mt-3 space-y-1.5">
            {filteredExecutionItems.map((execution) => {
              const isSelected = selectedExecution?.kind === execution.kind && selectedExecution.id === execution.id;
              const isSession = execution.kind === "session";
              const session = isSession ? sessions.find((item) => item.id === execution.id) ?? null : null;
              const sessionRecord = isSession ? session ?? execution : null;
              const worktree = session?.worktreeId ? worktrees.find((item) => item.id === session.worktreeId) ?? null : null;
              const secondaryText = isSession
                ? [execution.projectName ?? "工作台根目录", worktree?.name ?? execution.requestedWorktreeName ?? "未绑定 Worktree"].join(" · ")
                : [execution.projectName ?? "工作台根目录", execution.cwd ?? "普通终端"].join(" · ");
              const sessionPrimaryAction = sessionRecord ? getSessionPrimaryAction(sessionRecord) : null;
              const executionKey = `${execution.kind}:${execution.id}`;
              const isActionMenuOpen = expandedActionKey === executionKey;

              return (
                <div
                  key={executionKey}
                  className={`group rounded-lg border px-3 py-2 text-left text-sm transition ${
                    isSelected ? "border-slate-300/50 bg-white/[0.08]" : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button onClick={() => onSelectExecution(execution)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${getExecutionStatusDotClass(execution)}`} />
                        <div className="min-w-0 flex-1 truncate font-medium text-slate-100">{execution.name}</div>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-slate-500">{isSession ? "Claude" : "Shell"}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="min-w-0 flex-1 truncate">{secondaryText}</span>
                        <span className="shrink-0">{formatDateTime(execution.updatedAt)}</span>
                      </div>
                    </button>
                    {isSession && sessionRecord ? (
                      <div className="flex min-h-6 shrink-0 items-center gap-1 self-center">
                        {isSelected || isActionMenuOpen ? (
                          <>
                            {sessionPrimaryAction ? (
                              sessionPrimaryAction === "continue" ? (
                                <button
                                  disabled={continuingSessionId === sessionRecord.id}
                                  onClick={() => onContinueSession(sessionRecord)}
                                  className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-1 text-[10px] text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {continuingSessionId === sessionRecord.id ? "继续中" : "继续"}
                                </button>
                              ) : (
                                <button
                                  disabled={updatingSessionId === sessionRecord.id || sessionRecord.runtimeStatus === "stopped" || sessionRecord.runtimeStatus === "failed"}
                                  onClick={() => onStopSession(sessionRecord)}
                                  className="rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-1 text-[10px] text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {updatingSessionId === sessionRecord.id ? "停止中" : "停止"}
                                </button>
                              )
                            ) : null}
                            <button
                              disabled={renamingSessionId === sessionRecord.id}
                              onClick={() => onRenameSession(sessionRecord)}
                              className="rounded-md border border-sky-400/30 bg-sky-400/10 px-1.5 py-1 text-[10px] text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {renamingSessionId === sessionRecord.id ? "重命名中" : "重命名"}
                            </button>
                            <button
                              disabled={deletingSessionId === sessionRecord.id}
                              onClick={() => onDeleteSession(sessionRecord)}
                              className="rounded-md border border-red-400/30 bg-red-500/10 px-1.5 py-1 text-[10px] text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingSessionId === sessionRecord.id ? "删除中" : "删除"}
                            </button>
                            {!isSelected ? (
                              <button
                                type="button"
                                onClick={() => setExpandedActionKey(null)}
                                className="-mr-1 flex h-6 shrink-0 items-center px-1 text-[12px] leading-none text-slate-400 hover:text-slate-200"
                                aria-label="收起操作"
                              >
                                ⋮
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedActionKey(executionKey)}
                            className="-mr-1 flex h-6 shrink-0 items-center self-center px-1 text-[12px] leading-none text-slate-400 hover:text-slate-200"
                            aria-label="展开操作"
                          >
                            ⋮
                          </button>
                        )}
                      </div>
                    ) : null}
                    {!isSession ? (
                      isSelected || isActionMenuOpen ? (
                        <div className="flex min-h-6 shrink-0 items-center gap-1 self-center">
                          <button
                            disabled={deletingWorkspaceTerminalId === execution.id}
                            onClick={() => onDeleteWorkspaceTerminal(execution)}
                            className="rounded-md border border-red-400/30 bg-red-500/10 px-1.5 py-1 text-[10px] text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingWorkspaceTerminalId === execution.id ? "删除中" : "删除"}
                          </button>
                          {!isSelected ? (
                            <button
                              type="button"
                              onClick={() => setExpandedActionKey(null)}
                              className="-mr-1 flex h-6 shrink-0 items-center px-1 text-[12px] leading-none text-slate-400 hover:text-slate-200"
                              aria-label="收起操作"
                            >
                              ⋮
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedActionKey(executionKey)}
                          className="-mr-1 flex h-6 shrink-0 items-center self-center px-1 text-[12px] leading-none text-slate-400 hover:text-slate-200"
                          aria-label="展开操作"
                        >
                          ⋮
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!loading && executionItems.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">还没有执行项。</div> : null}
            {!loading && executionItems.length > 0 && filteredExecutionItems.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">没有匹配的执行项。</div> : null}
          </div>
        </>
      }
      content={
        isWorkspaceTerminalSelected && workspaceTerminal ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
              <div className="text-sm text-slate-300">普通终端</div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100">{workspaceTerminal.runtimeStatus}</span>
                {workspaceTerminal.runtimeStatus === "starting" || workspaceTerminal.runtimeStatus === "running" || workspaceTerminal.runtimeStatus === "stopping" ? (
                  <button
                    onClick={onStopWorkspaceTerminal}
                    disabled={stoppingWorkspaceTerminal}
                    className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {stoppingWorkspaceTerminal ? "停止中..." : "停止终端"}
                  </button>
                ) : (
                  <button
                    onClick={onRestartWorkspaceTerminal}
                    disabled={openingWorkspaceTerminal}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {openingWorkspaceTerminal ? "打开中..." : "重新打开终端"}
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 p-3">
              <WorkspaceTerminal
                terminalId={workspaceTerminal.id}
                runtimeStatus={workspaceTerminal.runtimeStatus}
                onRuntimeEvent={onWorkspaceTerminalRuntimeEvent}
                className="h-full min-h-[320px] w-full rounded-xl border border-white/10 bg-black"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
              <div className="flex items-center gap-2">
                {[
                  { id: "terminal", label: "操作终端" },
                  { id: "history", label: "会话历史" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setView(tab.id as SessionView)}
                    className={`rounded-md px-3 py-1.5 text-sm ${view === tab.id ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100">{runtimeStatus ?? "stopped"}</span>
            </div>
            <div className="min-h-0 flex-1 p-3">
              {view === "terminal" ? (
                selectedSession && selectedProject ? (
                  <SessionTerminal
                    projectId={selectedProject.id}
                    sessionId={selectedSession.id}
                    runtimeStatus={runtimeStatus}
                    onRuntimeEvent={onRuntimeEvent}
                    className="h-full min-h-[320px] w-full rounded-xl border border-white/10 bg-black"
                  />
                ) : (
                  <section className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-white/10 bg-black p-4 font-mono text-sm text-slate-400">
                    请先选择一个 Claude 会话。
                  </section>
                )
              ) : selectedSession ? (
                <section className="h-full min-h-[320px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4">
                  {historyLoading ? (
                    <div className="text-sm text-slate-400">会话历史加载中...</div>
                  ) : historyMessages.length === 0 ? (
                    <div className="text-sm text-slate-500">当前会话还没有可展示的历史记录。</div>
                  ) : (
                    <div className="space-y-3">
                      {historyMessages.map((message, index) => (
                        <div key={`${message.timestamp ?? "no-ts"}-${index}`} className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-slate-300">{message.role === "assistant" ? "Claude" : "User"}</span>
                            {message.isSidechain ? <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-200">Sidechain</span> : null}
                            <span>{message.timestamp ? formatDateTime(message.timestamp) : "无时间"}</span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {message.content.map((block, blockIndex) => (
                              <div key={blockIndex} className="whitespace-pre-wrap break-words rounded-lg border border-white/5 bg-white/[0.03] p-3 font-mono text-xs text-slate-200">
                                {formatSessionHistoryBlock(block)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <section className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-white/10 bg-black p-4 font-mono text-sm text-slate-400">
                  请先选择一个 Claude 会话。
                </section>
              )}
            </div>
          </>
        )
      }
    />
  );
}

export function WorkspaceExecutionModal({
  terminal,
  context,
  error,
  opening,
  stopping,
  onRestart,
  onStop,
  onRuntimeEvent,
  onClose
}: {
  terminal: WorkspaceTerminalSummary;
  context: {
    projectName: string | null;
    worktreeName: string | null;
  } | null;
  error: string | null;
  opening: boolean;
  stopping: boolean;
  onRestart: () => void;
  onStop: () => void;
  onRuntimeEvent: (event: WorkspaceTerminalStreamEvent) => void;
  onClose: () => void;
}) {
  const isRunning = terminal.runtimeStatus === "starting" || terminal.runtimeStatus === "running" || terminal.runtimeStatus === "stopping";

  return (
    <ExecutionModalFrame
      title="会话执行：工作台终端"
      subtitle="普通 shell 终端，不会创建 Claude Code 会话记录。"
      onClose={onClose}
      sidebar={
        <>
          <div>
            <div className="text-sm font-medium text-slate-100">终端上下文</div>
            <div className="mt-1 text-xs text-slate-500">关闭窗口只会隐藏终端，不会停止后台进程。</div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <DetailCard label="项目" value={context?.projectName ?? "工作台根目录"} />
            <DetailCard label="Worktree" value={context?.worktreeName ?? terminal.requestedWorktreeName ?? "未绑定"} />
            <DetailCard label="状态" value={terminal.runtimeStatus} />
            <DetailCard label="PID" value={terminal.pid ? String(terminal.pid) : "-"} />
            <DetailCard label="目录" value={terminal.cwd} />
          </div>

          {error ? <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {isRunning ? (
              <button
                onClick={onStop}
                disabled={stopping}
                className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stopping ? "停止中..." : "停止终端"}
              </button>
            ) : (
              <button
                onClick={onRestart}
                disabled={opening}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {opening ? "打开中..." : "重新打开终端"}
              </button>
            )}
          </div>
        </>
      }
      content={
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
            <div className="text-sm text-slate-300">操作终端</div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100">{terminal.runtimeStatus}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="space-y-3">
              <WorkspaceTerminal terminalId={terminal.id} runtimeStatus={terminal.runtimeStatus} onRuntimeEvent={onRuntimeEvent} />
              <div className="rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-slate-300">
                <div>project: {context?.projectName ?? "none"}</div>
                <div className="mt-1">worktree: {context?.worktreeName ?? terminal.requestedWorktreeName ?? "none"}</div>
                <div className="mt-1">cwd: {terminal.cwd}</div>
                <div className="mt-1">pid: {terminal.pid ?? "none"}</div>
                <div className="mt-1">runtime: {terminal.runtimeStatus}</div>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
}

function EmptyProjectNotice() {
  return (
    <section className="rounded-xl border border-dashed border-white/10 bg-[#151821] p-6 text-sm text-slate-400">
      <div className="text-base font-medium text-slate-100">还没有选择项目</div>
      <p className="mt-2">请在工作台页面选择或创建项目后，再查看任务、项目笔记、项目 Skill、会话和 Worktree。</p>
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

function RuntimeStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    starting: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    running: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    stopping: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    stopped: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    failed: "border-red-400/30 bg-red-500/10 text-red-200"
  };

  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${styles[status] ?? styles.stopped}`}>{status}</span>;
}

function SessionStatusPill({ status }: { status: SessionStatus }) {
  const styles: Record<SessionStatus, string> = {
    draft: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    queued: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    running: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    completed: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    failed: "border-red-400/30 bg-red-500/10 text-red-200"
  };

  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${styles[status]}`}>{status}</span>;
}

function matchesExecutionStatus(execution: ExecutionListItem, statusFilter: ExecutionStatusFilter) {
  if (statusFilter === "all") {
    return true;
  }

  const runtimeStatus = execution.runtimeStatus ?? "stopped";

  if (statusFilter === "active") {
    return runtimeStatus === "starting" || runtimeStatus === "running" || runtimeStatus === "stopping";
  }

  if (statusFilter === "failed") {
    return runtimeStatus === "failed" || execution.status === "failed";
  }

  return runtimeStatus === "stopped" || execution.status === "completed";
}

function getExecutionStatusDotClass(execution: ExecutionListItem) {
  const runtimeStatus = execution.runtimeStatus ?? "stopped";

  if (runtimeStatus === "running" || runtimeStatus === "starting" || runtimeStatus === "stopping") {
    return "bg-emerald-400";
  }

  if (runtimeStatus === "failed" || execution.status === "failed") {
    return "bg-red-400";
  }

  return "bg-slate-500";
}

function getSessionPrimaryAction(session: Pick<SessionSummary, "status" | "runtimeStatus">): "continue" | "stop" | null {
  if (session.status === "completed" || session.status === "failed") {
    return "continue";
  }

  if (session.runtimeStatus === "starting" || session.runtimeStatus === "running" || session.runtimeStatus === "stopping") {
    return "stop";
  }

  return null;
}

function formatSessionHistoryBlock(block: SessionHistoryMessage["content"][number]) {
  if (block.type === "text") {
    return block.text?.trim() || "[空文本]";
  }

  if (block.type === "tool_use") {
    const input = block.toolInput ? `\n${JSON.stringify(block.toolInput, null, 2)}` : "";
    return `[Tool Use] ${block.toolName ?? "unknown"}${input}`;
  }

  if (block.type === "tool_result") {
    return `[Tool Result]\n${block.toolResult?.trim() || "[空结果]"}`;
  }

  return "[未知内容块]";
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

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
