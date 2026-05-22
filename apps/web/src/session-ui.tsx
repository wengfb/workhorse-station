import type { FormEvent, ReactNode } from "react";
import type { ProjectSummary, PromptDraftSummary, SessionSource, SessionStatus, SessionSummary, TodoSummary, WorktreeSummary } from "@workhorse-station/shared";

export type SessionEditorDraft = {
  sessionName: string;
  promptTitle: string;
  prompt: string;
  todoId: string;
  worktreeId: string;
  requestedWorktreeName: string;
  promptDraftId: string;
};

type SessionView = "terminal" | "history";

export function SessionsWorkspace({
  selectedProject,
  selectedWorktree,
  sessions,
  promptDrafts,
  todos,
  loading,
  error,
  onCreateProject,
  onOpenSession
}: {
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  sessions: SessionSummary[];
  promptDrafts: PromptDraftSummary[];
  todos: TodoSummary[];
  loading: boolean;
  error: string | null;
  onCreateProject: () => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
}) {
  if (!selectedProject) {
    return <EmptyProjectNotice onCreateProject={onCreateProject} />;
  }

  const firstTodo = todos[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(360px,0.7fr)]">
      <section className="rounded-xl border border-white/10 bg-[#151821] p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="text-sm font-medium text-slate-100">Claude Code 会话</div>
            <p className="mt-1 text-xs text-slate-500">会话记录已持久化，PTY / Claude Code 运行还未接入。</p>
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
              从待办创建
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
                <div className="mt-2 text-xs text-slate-500">来源：{session.source === "todo" ? "待办" : "直接创建"}</div>
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
        <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">当前版本只保存 prompt 草稿和会话元数据，真实终端执行会在下一阶段接入。</p>
      </section>
    </div>
  );
}

export function CreateSessionModal({
  todos,
  worktrees,
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
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  source: SessionSource;
  draft: SessionEditorDraft;
  error: string | null;
  loading: boolean;
  previewingPrompt: boolean;
  savingPromptDraft: boolean;
  creatingSession: boolean;
  onDraftChange: (field: keyof SessionEditorDraft, value: string) => void;
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
            <div className="mt-1 text-xs text-slate-500">先确认 prompt 草稿，再创建会话记录；创建成功后进入会话窗口。</div>
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
                <p className="mt-1 text-xs text-slate-500">入口：{source === "todo" ? "从待办创建" : "直接创建"}</p>
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
                  placeholder="例如：待办会话 / 直接会话"
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
              <Field label="关联待办">
                <select
                  value={draft.todoId}
                  onChange={(event) => onDraftChange("todoId", event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                >
                  <option value="">不关联</option>
                  {todos.map((todo) => (
                    <option key={todo.id} value={todo.id}>
                      {todo.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="选择已有 Worktree">
                <select
                  value={draft.worktreeId}
                  onChange={(event) => onDraftChange("worktreeId", event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
                >
                  <option value="">不绑定</option>
                  {worktrees.map((worktree) => (
                    <option key={worktree.id} value={worktree.id}>
                      {worktree.name}
                    </option>
                  ))}
                </select>
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
                {creatingSession ? "创建中..." : "创建会话并打开"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SessionModal({
  sessions,
  selectedSession,
  selectedPromptDraft,
  selectedProject,
  selectedWorktree,
  todos,
  worktrees,
  apiConnected,
  source,
  view,
  draft,
  error,
  loading,
  updatingSessionId,
  deletingSessionId,
  onViewChange,
  onSelectSession,
  onStopSession,
  onDeleteSession,
  onClose
}: {
  sessions: SessionSummary[];
  selectedSession: SessionSummary | null;
  selectedPromptDraft: PromptDraftSummary | null;
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  todos: TodoSummary[];
  worktrees: WorktreeSummary[];
  apiConnected: boolean;
  source: SessionSource;
  view: SessionView;
  draft: SessionEditorDraft;
  error: string | null;
  loading: boolean;
  updatingSessionId: string | null;
  deletingSessionId: string | null;
  onViewChange: (view: SessionView) => void;
  onSelectSession: (session: SessionSummary) => void;
  onStopSession: (session: SessionSummary) => void;
  onDeleteSession: (session: SessionSummary) => void;
  onClose: () => void;
}) {
  const sessionWorktree = selectedSession?.worktreeId ? worktrees.find((worktree) => worktree.id === selectedSession.worktreeId) ?? null : null;
  const sessionSource = selectedSession?.source ?? source;
  const sessionStatus = selectedSession?.status ?? "draft";
  const selectedSessionTodo = selectedSession?.todoId ? todos.find((todo) => todo.id === selectedSession.todoId) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 md:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[#101114] shadow-2xl md:max-w-[min(96vw,1800px)] md:rounded-2xl md:border md:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">会话执行：{selectedSession?.name || draft.sessionName || "新会话"}</div>
            <div className="mt-1 text-xs text-slate-500">这里只展示已创建会话的记录和占位终端，真实 PTY 尚未接入。</div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            关闭
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[3fr_7fr]">
          <aside className="min-h-0 overflow-auto border-b border-white/10 bg-[#151821] p-4 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-100">会话列表</div>
                <div className="mt-1 text-xs text-slate-500">最近入口：{sessionSource === "todo" ? "从待办创建" : "直接创建"}</div>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">{sessions.length} 个</span>
            </div>
            {error ? <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
            {loading ? <div className="mt-4 rounded-lg border border-white/10 p-3 text-xs text-slate-400">会话加载中...</div> : null}
            <div className="mt-4 space-y-2">
              {sessions.map((session) => {
                const todo = session.todoId ? todos.find((item) => item.id === session.todoId) ?? null : null;
                const worktree = session.worktreeId ? worktrees.find((item) => item.id === session.worktreeId) ?? null : null;

                return (
                  <div
                    key={session.id}
                    className={`rounded-lg border p-3 text-left text-sm ${
                      selectedSession?.id === session.id ? "border-slate-300/50 bg-white/[0.08]" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => onSelectSession(session)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 truncate font-medium text-slate-100">{session.name}</div>
                          <SessionStatusPill status={session.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-300">
                          <MetaTag label="项目" value={selectedProject?.name ?? "未选择"} />
                          <MetaTag label="待办" value={todo?.title ?? "未关联"} />
                          <MetaTag label="Worktree" value={worktree?.name ?? session.requestedWorktreeName ?? "未选择"} />
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">{formatDateTime(session.createdAt)}</div>
                      </button>
                      <div className="flex shrink-0 gap-1">
                        <button
                          disabled={updatingSessionId === session.id || session.status === "completed"}
                          onClick={() => onStopSession(session)}
                          className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updatingSessionId === session.id ? "停止中" : "停止"}
                        </button>
                        <button
                          disabled={deletingSessionId === session.id}
                          onClick={() => onDeleteSession(session)}
                          className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingSessionId === session.id ? "删除中" : "删除"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!loading && sessions.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">还没有保存的会话。</div> : null}
            </div>
          </aside>

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
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">会话记录已保存 / PTY 未接入</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {view === "terminal" ? (
                <section className="rounded-xl border border-white/10 bg-black p-4 font-mono text-sm text-emerald-200">
                  <div>$ workhorse-station session</div>
                  <div className="mt-2 text-slate-500">会话终端占位，后续接入 xterm.js、PTY 和 Claude Code。</div>
                  <div className="mt-4">api: {apiConnected ? "connected" : "waiting"}</div>
                  <div className="mt-1">project: {selectedProject?.name ?? "none"}</div>
                  <div className="mt-1">todo: {selectedSessionTodo?.title ?? "none"}</div>
                  <div className="mt-1">worktree: {sessionWorktree?.name || selectedWorktree?.name || draft.requestedWorktreeName || "none"}</div>
                  <div className="mt-1">session: {selectedSession?.name || draft.sessionName || "new"}</div>
                  <div className="mt-1">status: {sessionStatus}</div>
                  <div className="mt-2 animate-pulse">_</div>
                </section>
              ) : (
                <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                  <div>
                    <div className="font-medium text-slate-100">会话历史</div>
                    <p className="mt-2 text-slate-400">当前保存的是会话元数据和 prompt 快照，后续再补真实输出流和摘要。</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <DetailCard label="会话" value={selectedSession?.name || draft.sessionName || "未选择"} />
                    <DetailCard label="来源" value={sessionSource === "todo" ? "待办" : "直接创建"} />
                    <DetailCard label="项目" value={selectedProject?.name ?? "未选择"} />
                    <DetailCard label="待办" value={selectedSessionTodo?.title ?? "未关联"} />
                    <DetailCard label="Worktree" value={sessionWorktree?.name || selectedWorktree?.name || draft.requestedWorktreeName || "未选择"} />
                    <DetailCard label="状态" value={sessionStatus} />
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-slate-500">Prompt 快照</div>
                    <div className="mt-2 whitespace-pre-wrap text-slate-200">{selectedSession?.prompt || draft.prompt || "暂无 prompt"}</div>
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>
      </div>
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

function SessionStatusPill({ status }: { status: SessionStatus }) {
  const styles: Record<SessionStatus, string> = {
    draft: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    queued: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    running: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    completed: "border-slate-400/30 bg-slate-400/10 text-slate-300"
  };

  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${styles[status]}`}>{status}</span>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="truncate text-right text-slate-100">{value}</span>
    </div>
  );
}

function MetaTag({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-300">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="truncate text-slate-100">{value}</span>
    </span>
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
