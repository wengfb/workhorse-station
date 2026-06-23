import { Monitor, Moon, Plus, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  AgentProvider,
  ExecutionListItem,
  ProjectSummary,
  PromptDraftSummary,
  SessionHistoryMessage,
  SessionListItem,
  SessionRuntimeStatus,
  SessionSource,
  SessionStatus,
  SessionStreamEvent,
  SessionSummary,
  TodoSummary,
  WorktreeSummary,
  WorkspaceTerminalStreamEvent,
  WorkspaceTerminalSummary
} from "@workhorse-station/shared";
import {
  createSessionWebSocket,
  createWorkspaceTerminalWebSocket,
  getSessionHistory,
  getSessionTerminal,
  getWorkspaceTerminal
} from "./api";
import { PtyTerminal, type PtyTerminalSnapshot } from "./pty-terminal";
import { useThemeSettings, type TerminalThemeMode } from "./theme";
import { WorkspaceTerminal } from "./workspace-terminal";
import { Select } from "./components/ui/Select";

export type SessionEditorDraft = {
  provider: AgentProvider;
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
type SessionModalTerminalSource = {
  executionKey: string;
  runtimeStatus: SessionRuntimeStatus | null;
  loadSnapshot: () => Promise<PtyTerminalSnapshot>;
  createSocket: () => WebSocket;
  onSessionRuntimeEvent?: (event: SessionStreamEvent) => void;
  onWorkspaceTerminalRuntimeEvent?: (event: WorkspaceTerminalStreamEvent) => void;
} | null;

type TerminalThemeOption = {
  mode: TerminalThemeMode;
  label: string;
  icon: typeof Monitor;
};

const terminalThemeOptions: TerminalThemeOption[] = [
  { mode: "follow", label: "跟随界面", icon: Monitor },
  { mode: "dark", label: "暗色终端", icon: Moon },
  { mode: "light", label: "亮色终端", icon: Sun }
];

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
  sessions: SessionListItem[];
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
      <section className="app-panel app-border rounded-xl border p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
            <div className="app-text text-sm font-medium">代码会话</div>
            <p className="app-text-faint mt-1 text-xs">支持 Claude 与 Codex 两种执行器，可绑定已有 Worktree 或在启动时自动创建新 Worktree。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onOpenSession("direct")} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium">
              直接创建
            </button>
            <button
              disabled={!firstTodo}
              onClick={() => onOpenSession("todo", firstTodo?.id)}
              className="app-button-secondary rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              从任务创建
            </button>
          </div>
        </div>

        <div className="app-text-faint mt-4 flex flex-wrap gap-2 text-xs">
          <span className="app-pill-neutral rounded-full border px-2 py-1">会话 {sessions.length}</span>
          <span className="app-pill-neutral rounded-full border px-2 py-1">Prompt 草稿 {promptDrafts.length}</span>
          <span className="app-pill-neutral rounded-full border px-2 py-1">当前 Worktree：{selectedWorktree?.name ?? "未选择"}</span>
        </div>

        {error ? <p className="app-banner-danger mt-4 rounded-lg border p-3 text-xs">{error}</p> : null}
        {loading ? <div className="app-border app-text-faint mt-4 rounded-lg border p-3 text-xs">会话加载中...</div> : null}
        {!loading && sessions.length === 0 ? <div className="app-border app-text-faint mt-4 rounded-lg border border-dashed p-4 text-xs">当前项目还没有保存的会话记录。</div> : null}

        {!loading && sessions.length > 0 ? (
          <div className="mt-4 space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onOpenSession(session.source, session.todoId ?? undefined, session.id)}
                className="app-card app-card-hover app-hover-border block w-full rounded-lg border p-3 text-left text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="app-text font-medium">{session.name}</span>
                  <SessionStatusPill status={session.status} />
                </div>
                <div className="app-text-faint mt-2 text-xs">执行器：{formatProviderLabel(session.provider)} / 来源：{session.source === "todo" ? "任务" : "直接创建"}</div>
                {session.summary ? <div className="app-text-muted mt-1 line-clamp-2 text-xs">结果：{session.summary}</div> : null}
                <div className="app-text-faint mt-1 text-xs">更新：{formatDateTime(session.updatedAt)}</div>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="app-panel app-border app-text-muted rounded-xl border p-4 text-sm">
        <div className="app-text font-medium">会话上下文</div>
        <div className="mt-4 space-y-2">
          <DetailRow label="项目" value={selectedProject.name} />
          <DetailRow label="Worktree" value={selectedWorktree?.name ?? "未选择"} />
          <DetailRow label="Prompt 草稿" value={String(promptDrafts.length)} />
          <DetailRow label="关闭窗口" value="后台运行，不停止会话" />
        </div>
        <p className="app-banner-success mt-4 rounded-lg border p-3 text-xs">当前版本支持真实会话启动、终端输出和停止操作；删除会话不会自动删除关联 Worktree。</p>
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
  sessions: SessionListItem[];
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
    <div className="app-overlay fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div className="app-panel app-border flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl">
        <div className="app-border flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-semibold">创建代码会话</div>
            <div className="app-text-faint mt-1 text-xs">先确认 prompt 草稿，再真实启动所选执行器会话并打开终端。</div>
          </div>
          <button onClick={onClose} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-5">
          <section className="app-panel-strong app-border app-text-muted rounded-xl border p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="app-text font-medium">会话创建表单</div>
                <p className="app-text-faint mt-1 text-xs">入口：{source === "todo" ? "从任务创建" : "直接创建"}</p>
              </div>
              <div className="app-text-faint text-right text-xs">
                <div>项目：{selectedProject?.name ?? "未选择"}</div>
                <div className="mt-1">当前 Worktree：{selectedWorktree?.name ?? "未选择"}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Field label="执行器">
                <Select
                  value={draft.provider}
                  onChange={(value) => onDraftChange("provider", value)}
                  options={[
                    { value: "claude", label: "Claude" },
                    { value: "codex", label: "Codex" }
                  ]}
                />
              </Field>
              <Field label="会话名称">
                <input
                  value={draft.sessionName}
                  onChange={(event) => onDraftChange("sessionName", event.target.value)}
                  className="app-input-shell w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="例如：任务会话 / 直接会话"
                />
              </Field>
              <Field label="Prompt 标题">
                <input
                  value={draft.promptTitle}
                  onChange={(event) => onDraftChange("promptTitle", event.target.value)}
                  className="app-input-shell w-full rounded-lg border px-3 py-2 text-sm outline-none"
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
                  className="app-input-shell w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="例如：phase-2-session-flow"
                />
              </Field>
            </div>
            <p className="app-text-faint mt-2 text-xs">已有 Worktree 和新 Worktree 名称二选一；填写新名称时会在启动会话时自动创建。</p>
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
                    <label className="app-text-faint mt-2 flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={draft.forkSession}
                        onChange={(event) => onDraftChange("forkSession", event.target.checked)}
                        className="app-input-shell rounded border"
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
                  className="app-input-shell min-h-56 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="先生成 prompt 草稿，或直接手动编辑。"
                />
              </Field>
            </div>
            {error ? <p className="app-banner-danger mt-4 rounded-lg border p-3 text-xs">{error}</p> : null}
          </section>
        </div>
        <div className="app-border flex shrink-0 flex-wrap justify-end gap-2 border-t px-4 py-3 md:px-5">
          <button
            type="button"
            disabled={loading || previewingPrompt}
            onClick={onPreviewPrompt}
            className="app-button-secondary rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {previewingPrompt ? "生成中..." : "生成 Prompt 草稿"}
          </button>
          <button
            type="button"
            disabled={loading || savingPromptDraft}
            onClick={onSavePromptDraft}
            className="app-button-success rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingPromptDraft ? "保存中..." : draft.promptDraftId ? "更新草稿" : "保存草稿"}
          </button>
          <button
            type="button"
            disabled={loading || creatingSession}
            onClick={onCreateSession}
            className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingSession ? "启动中..." : "启动会话并打开"}
          </button>
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
    <div className="app-overlay fixed inset-0 z-50 flex items-stretch justify-center p-0 md:p-6">
      <div className="app-panel app-border flex h-full w-full flex-col overflow-hidden shadow-2xl md:max-w-[min(96vw,1800px)] md:rounded-2xl md:border">
        <div className="app-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="app-text truncate text-sm font-semibold">{title}</div>
            <div className="app-text-faint mt-1 text-xs">{subtitle}</div>
          </div>
          <button onClick={onClose} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
            关闭
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="app-panel-strong app-border min-h-0 overflow-auto border-b p-3 xl:border-b-0 xl:border-r">{sidebar}</aside>
          <section className="app-input flex min-h-0 flex-col overflow-hidden">{content}</section>
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
  sessionProjectId,
  draft,
  error,
  loading,
  updatingSessionId,
  renamingSessionId,
  deletingSessionId,
  deletingWorkspaceTerminalId,
  continuingSessionId,
  onSelectExecution,
  onCreateWorkspaceTerminal,
  onRenameSession,
  onStopSession,
  onDeleteSession,
  onRenameWorkspaceTerminal,
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
  sessions: SessionListItem[];
  selectedSession: SessionSummary | null;
  selectedProject: ProjectSummary | null;
  projects: ProjectSummary[];
  todos: TodoSummary[];
  worktrees: WorktreeSummary[];
  workspaceTerminal: WorkspaceTerminalSummary | null;
  workspaceTerminalError: string | null;
  openingWorkspaceTerminal: boolean;
  stoppingWorkspaceTerminal: boolean;
  sessionProjectId: string | null;
  draft: SessionEditorDraft;
  error: string | null;
  loading: boolean;
  updatingSessionId: string | null;
  renamingSessionId: string | null;
  deletingSessionId: string | null;
  deletingWorkspaceTerminalId: string | null;
  continuingSessionId: string | null;
  onSelectExecution: (execution: ExecutionListItem) => void;
  onCreateWorkspaceTerminal: () => void;
  onRenameSession: (session: SessionListItem | Extract<ExecutionListItem, { kind: "session" }>) => void;
  onStopSession: (session: SessionListItem | Extract<ExecutionListItem, { kind: "session" }>) => void;
  onDeleteSession: (session: SessionListItem | Extract<ExecutionListItem, { kind: "session" }>) => void;
  onRenameWorkspaceTerminal: (execution: Extract<ExecutionListItem, { kind: "workspace-terminal" }>) => void;
  onDeleteWorkspaceTerminal: (execution: Extract<ExecutionListItem, { kind: "workspace-terminal" }>) => void;
  onContinueSession: (session: SessionListItem | Extract<ExecutionListItem, { kind: "session" }>) => void;
  onRuntimeEvent: (event: SessionStreamEvent) => void;
  onRestartWorkspaceTerminal: () => void;
  onStopWorkspaceTerminal: () => void;
  onWorkspaceTerminalRuntimeEvent: (event: WorkspaceTerminalStreamEvent) => void;
  onClose: () => void;
}) {
  const { terminalTheme, terminalThemeMode, setTerminalThemeMode } = useThemeSettings();
  const isWorkspaceTerminalSelected = selectedExecution?.kind === "workspace-terminal";
  const resolvedSessionId = selectedExecution?.kind === "session" ? selectedExecution.id : selectedSession?.id ?? null;
  const runtimeStatus =
    selectedExecution?.kind === "session"
      ? (selectedExecution.runtimeStatus ?? selectedSession?.runtimeStatus ?? null)
      : selectedSession?.runtimeStatus ?? null;
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
    const resolvedProjectId = sessionProjectId ?? selectedProject?.id;
    if (view !== "history" || !selectedSession || !resolvedProjectId || !resolvedSessionId || isWorkspaceTerminalSelected) {
      return;
    }

    let disposed = false;
    setHistoryLoading(true);

    getSessionHistory(resolvedProjectId, resolvedSessionId)
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
  }, [isWorkspaceTerminalSelected, selectedProject, selectedSession, view, sessionProjectId, resolvedSessionId]);

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

  const terminalSource = useMemo<SessionModalTerminalSource>(() => {
    if (!selectedExecution) {
      return null;
    }

    if (selectedExecution.kind === "workspace-terminal" && workspaceTerminal) {
      return {
        executionKey: `workspace-terminal:${workspaceTerminal.id}`,
        runtimeStatus: workspaceTerminal.runtimeStatus,
        loadSnapshot: () => getWorkspaceTerminal(workspaceTerminal.id),
        createSocket: () => createWorkspaceTerminalWebSocket(workspaceTerminal.id),
        onWorkspaceTerminalRuntimeEvent
      };
    }

    if (!selectedSession || !selectedProject || !resolvedSessionId) {
      return null;
    }

    const resolvedProjectId = sessionProjectId ?? selectedProject.id;

    return {
      executionKey: `session:${resolvedSessionId}`,
      runtimeStatus,
      loadSnapshot: () => getSessionTerminal(resolvedProjectId, resolvedSessionId),
      createSocket: () => createSessionWebSocket(resolvedProjectId, resolvedSessionId),
      onSessionRuntimeEvent: onRuntimeEvent
    };
  }, [onRuntimeEvent, onWorkspaceTerminalRuntimeEvent, runtimeStatus, selectedExecution, selectedProject, selectedSession, workspaceTerminal, sessionProjectId, resolvedSessionId]);

  const handleTerminalRuntimeEvent = useCallback(
    (event: SessionStreamEvent | WorkspaceTerminalStreamEvent) => {
      if ("sessionId" in event) {
        terminalSource?.onSessionRuntimeEvent?.(event);
        return;
      }

      terminalSource?.onWorkspaceTerminalRuntimeEvent?.(event);
    },
    [terminalSource]
  );

  return (
    <ExecutionModalFrame
      title={`会话执行：${selectedExecution?.name || selectedSession?.name || draft.sessionName || "新会话"}`}
      subtitle="代码会话与普通终端共用同一个全局执行列表。"
      onClose={onClose}
      sidebar={
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="app-input-shell min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="搜索会话、终端、项目或 worktree"
              />
              <button
                type="button"
                onClick={onCreateWorkspaceTerminal}
                disabled={openingWorkspaceTerminal}
                className="app-button-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="新建普通终端"
                title="新建普通终端"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="app-input-shell min-w-0 rounded-lg border px-3 py-2 text-xs outline-none"
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
                className="app-input-shell min-w-0 rounded-lg border px-3 py-2 text-xs outline-none"
              >
                <option value="all">全部状态</option>
                <option value="active">运行中</option>
                <option value="stopped">已停止</option>
                <option value="failed">失败</option>
              </select>
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as ExecutionKindFilter)}
                className="app-input-shell min-w-0 rounded-lg border px-3 py-2 text-xs outline-none"
              >
                <option value="all">全部类型</option>
                <option value="session">代码会话</option>
                <option value="workspace-terminal">普通终端</option>
              </select>
            </div>
          </div>
          {error ? <p className="app-banner-danger mt-4 rounded-lg border p-3 text-xs">{error}</p> : null}
          {workspaceTerminalError && isWorkspaceTerminalSelected ? <p className="app-banner-danger mt-4 rounded-lg border p-3 text-xs">{workspaceTerminalError}</p> : null}
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
                <div key={executionKey} className={`group rounded-lg border px-3 py-2 text-left text-sm transition ${isSelected ? "app-card-selected" : "app-card app-card-hover app-hover-border"}`}>
                  <div className="flex items-start gap-2">
                    <button onClick={() => onSelectExecution(execution)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${getExecutionStatusDotClass(execution)}`} />
                        <div className="app-text min-w-0 flex-1 truncate font-medium">{execution.name}</div>
                            <span className="app-text-faint shrink-0 text-[10px] uppercase tracking-[0.12em]">{isSession ? formatProviderLabel(execution.provider) : "Shell"}</span>
                      </div>
                      <div className="app-text-faint mt-1 flex items-center gap-2 text-[11px]">
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
                                  className="app-button-success rounded-md border px-1.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {continuingSessionId === sessionRecord.id ? "继续中" : "继续"}
                                </button>
                              ) : (
                                <button
                                  disabled={updatingSessionId === sessionRecord.id || sessionRecord.runtimeStatus === "stopping" || sessionRecord.runtimeStatus === "stopped" || sessionRecord.runtimeStatus === "failed"}
                                  onClick={() => onStopSession(sessionRecord)}
                                  className="app-button-warning rounded-md border px-1.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {updatingSessionId === sessionRecord.id || sessionRecord.runtimeStatus === "stopping" ? "停止中" : "停止"}
                                </button>
                              )
                            ) : null}
                            <button
                              disabled={renamingSessionId === sessionRecord.id}
                              onClick={() => onRenameSession(sessionRecord)}
                              className="app-button-info rounded-md border px-1.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {renamingSessionId === sessionRecord.id ? "重命名中" : "重命名"}
                            </button>
                            <button
                              disabled={deletingSessionId === sessionRecord.id}
                              onClick={() => onDeleteSession(sessionRecord)}
                              className="app-button-danger rounded-md border px-1.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingSessionId === sessionRecord.id ? "删除中" : "删除"}
                            </button>
                            {!isSelected ? (
                              <button
                                type="button"
                                onClick={() => setExpandedActionKey(null)}
                                className="app-text-faint app-hover-text -mr-1 flex h-6 shrink-0 items-center px-1 text-[12px] leading-none"
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
                            className="app-text-faint app-hover-text -mr-1 flex h-6 shrink-0 items-center self-center px-1 text-[12px] leading-none"
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
                            disabled={renamingSessionId === execution.id}
                            onClick={() => onRenameWorkspaceTerminal(execution)}
                            className="app-button-info rounded-md border px-1.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {renamingSessionId === execution.id ? "重命名中" : "重命名"}
                          </button>
                          <button
                            disabled={deletingWorkspaceTerminalId === execution.id}
                            onClick={() => onDeleteWorkspaceTerminal(execution)}
                            className="app-button-danger rounded-md border px-1.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingWorkspaceTerminalId === execution.id ? "删除中" : "删除"}
                          </button>
                          {!isSelected ? (
                            <button
                              type="button"
                              onClick={() => setExpandedActionKey(null)}
                              className="app-text-faint app-hover-text -mr-1 flex h-6 shrink-0 items-center px-1 text-[12px] leading-none"
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
                          className="app-text-faint app-hover-text -mr-1 flex h-6 shrink-0 items-center self-center px-1 text-[12px] leading-none"
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
            {!loading && executionItems.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-3 text-xs">还没有执行项。</div> : null}
            {!loading && executionItems.length > 0 && filteredExecutionItems.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-3 text-xs">没有匹配的执行项。</div> : null}
          </div>
        </>
      }
      content={
        <>
          <div className="app-border flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div className="flex items-center gap-2">
              {isWorkspaceTerminalSelected ? (
                <div className="app-text-muted text-sm">普通终端</div>
              ) : (
                [
                  { id: "terminal", label: "操作终端" },
                  { id: "history", label: "会话历史" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setView(tab.id as SessionView)}
                    className={`rounded-md px-3 py-1.5 text-sm ${view === tab.id ? "app-button-primary" : "app-button-secondary border"}`}
                  >
                    {tab.label}
                  </button>
                ))
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="app-panel-strong app-border flex items-center gap-1 rounded-lg border p-1">
                {terminalThemeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = terminalThemeMode === option.mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => setTerminalThemeMode(option.mode)}
                      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${active ? "app-button-primary" : "app-button-secondary border"}`}
                      aria-label={option.label}
                      title={option.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
              <span className="app-pill-success rounded-full border px-2 py-1 text-xs">{terminalSource?.runtimeStatus ?? runtimeStatus ?? workspaceTerminal?.runtimeStatus ?? "stopped"}</span>
              {isWorkspaceTerminalSelected && workspaceTerminal ? (
                workspaceTerminal.runtimeStatus === "starting" || workspaceTerminal.runtimeStatus === "running" || workspaceTerminal.runtimeStatus === "stopping" ? (
                  <button
                    onClick={onStopWorkspaceTerminal}
                    disabled={stoppingWorkspaceTerminal}
                    className="app-button-warning rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {stoppingWorkspaceTerminal ? "停止中..." : "停止终端"}
                  </button>
                ) : (
                  <button
                    onClick={onRestartWorkspaceTerminal}
                    disabled={openingWorkspaceTerminal}
                    className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {openingWorkspaceTerminal ? "打开中..." : "重新打开终端"}
                  </button>
                )
              ) : null}
            </div>
          </div>
          <div className="relative min-h-0 flex-1 p-3">
            {terminalSource ? (
              <div className={view === "history" && !isWorkspaceTerminalSelected ? "pointer-events-none invisible absolute inset-3" : "h-full"}>
                <PtyTerminal<SessionStreamEvent | WorkspaceTerminalStreamEvent>
                  key={terminalSource.executionKey}
                  sourceKey={terminalSource.executionKey}
                  runtimeStatus={terminalSource.runtimeStatus}
                  loadSnapshot={terminalSource.loadSnapshot}
                  createSocket={terminalSource.createSocket}
                  onRuntimeEvent={handleTerminalRuntimeEvent}
                  className="terminal-surface app-border h-full min-h-[320px] w-full rounded-xl border"
                  visible={view === "terminal" || isWorkspaceTerminalSelected}
                />
              </div>
            ) : (
              <section className="terminal-surface app-border app-text-faint flex h-full min-h-[320px] items-center justify-center rounded-xl border p-4 font-mono text-sm">
                请先选择一个代码会话。
              </section>
            )}

            {!isWorkspaceTerminalSelected && view === "history" ? (
              selectedSession ? (
                <section className="app-input-shell-strong app-border h-full min-h-[320px] overflow-auto rounded-xl border p-4">
                  {historyLoading ? (
                    <div className="app-text-faint text-sm">会话历史加载中...</div>
                  ) : historyMessages.length === 0 ? (
                    <div className="app-text-faint text-sm">当前会话还没有可展示的历史记录。</div>
                  ) : (
                    <div className="space-y-3">
                      {historyMessages.map((message, index) => (
                        <div key={`${message.timestamp ?? "no-ts"}-${index}`} className="app-input-shell-strong app-border rounded-xl border p-3">
                          <div className="app-text-faint flex flex-wrap items-center gap-2 text-xs">
                            <span className="app-pill-neutral rounded-full border px-2 py-0.5">{message.role === "assistant" ? "Claude" : "User"}</span>
                            {message.isSidechain ? <span className="app-pill-warning rounded-full border px-2 py-0.5">Sidechain</span> : null}
                            <span>{message.timestamp ? formatDateTime(message.timestamp) : "无时间"}</span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {message.content.map((block, blockIndex) => (
                              <div key={blockIndex} className="app-card app-border-soft app-text-soft whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs">
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
                <section className="terminal-surface app-border app-text-faint flex h-full min-h-[320px] items-center justify-center rounded-xl border p-4 font-mono text-sm">
                  请先选择一个代码会话。
                </section>
              )
            ) : null}
          </div>
        </>
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
      subtitle="普通 shell 终端，不会创建代码会话记录。"
      onClose={onClose}
      sidebar={
        <>
          <div>
            <div className="app-text text-sm font-medium">终端上下文</div>
            <div className="app-text-faint mt-1 text-xs">关闭窗口只会隐藏终端，不会停止后台进程。</div>
          </div>

          <div className="app-text-muted mt-4 space-y-2 text-sm">
            <DetailCard label="项目" value={context?.projectName ?? "工作台根目录"} />
            <DetailCard label="Worktree" value={context?.worktreeName ?? terminal.requestedWorktreeName ?? "未绑定"} />
            <DetailCard label="状态" value={terminal.runtimeStatus} />
            <DetailCard label="PID" value={terminal.pid ? String(terminal.pid) : "-"} />
            <DetailCard label="目录" value={terminal.cwd} />
          </div>

          {error ? <p className="app-banner-danger mt-4 rounded-lg border p-3 text-xs">{error}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {isRunning ? (
              <button
                onClick={onStop}
                disabled={stopping}
                className="app-button-warning rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stopping ? "停止中..." : "停止终端"}
              </button>
            ) : (
              <button
                onClick={onRestart}
                disabled={opening}
                className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {opening ? "打开中..." : "重新打开终端"}
              </button>
            )}
          </div>
        </>
      }
      content={
        <>
          <div className="app-border flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div className="app-text-muted text-sm">操作终端</div>
            <span className="app-pill-success rounded-full border px-2 py-1 text-xs">{terminal.runtimeStatus}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="space-y-3">
              <WorkspaceTerminal terminalId={terminal.id} runtimeStatus={terminal.runtimeStatus} onRuntimeEvent={onRuntimeEvent} />
              <div className="app-input app-border app-text-muted rounded-xl border p-3 font-mono text-xs">
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
    <section className="app-panel app-border app-text-faint rounded-xl border border-dashed p-6 text-sm">
      <div className="app-text text-base font-medium">还没有选择项目</div>
      <p className="mt-2">请在工作台页面选择或创建项目后，再查看任务、项目笔记、项目 Skill、会话和 Worktree。</p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="app-text-faint text-xs">{label}</span>
      {children}
    </label>
  );
}

function RuntimeStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    starting: "app-pill-info",
    running: "app-pill-success",
    stopping: "app-pill-warning",
    stopped: "app-pill-neutral",
    failed: "app-pill-danger"
  };

  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${styles[status] ?? styles.stopped}`}>{status}</span>;
}

function SessionStatusPill({ status }: { status: SessionStatus }) {
  const styles: Record<SessionStatus, string> = {
    draft: "app-pill-warning",
    queued: "app-pill-info",
    running: "app-pill-success",
    completed: "app-pill-neutral",
    failed: "app-pill-danger"
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

function formatProviderLabel(provider: AgentProvider) {
  return provider === "codex" ? "Codex" : "Claude";
}

function getExecutionStatusDotClass(execution: ExecutionListItem) {
  const runtimeStatus = execution.runtimeStatus ?? "stopped";

  if (runtimeStatus === "running" || runtimeStatus === "starting" || runtimeStatus === "stopping") {
    return "app-dot-success";
  }

  if (runtimeStatus === "failed" || execution.status === "failed") {
    return "app-dot-danger";
  }

  return "app-dot-neutral";
}

function getSessionPrimaryAction(session: Pick<SessionSummary, "status" | "runtimeStatus">): "continue" | "stop" | null {
  if (session.runtimeStatus === "starting" || session.runtimeStatus === "running" || session.runtimeStatus === "stopping") {
    return "stop";
  }

  if (session.status === "completed" || session.status === "failed") {
    return "continue";
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
      <span className="app-text-faint shrink-0">{label}</span>
      <span className="app-text truncate text-right">{value}</span>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-input app-border rounded-lg border p-3">
      <div className="app-text-faint text-xs">{label}</div>
      <div className="app-text mt-2 truncate">{value}</div>
    </div>
  );
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
