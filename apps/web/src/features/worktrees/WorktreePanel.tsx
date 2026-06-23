import React from "react";
import { LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { ProjectSummary, WorktreeSummary, WorktreeStatus } from "@workhorse-station/shared";
import { formatDateTime } from "../../lib/format-utils";
import { IconButton } from "../../components/shared/IconButton";
import { WorktreeStatusPill } from "../../components/shared/StatusPills";

export function WorktreePanel({
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
    <section className="app-panel app-border space-y-4 rounded-xl border p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="app-text text-sm font-medium">Worktree 管理</div>
          <div className="app-text-faint mt-1 break-all text-xs">{project.path}/.claude/worktree/</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="app-pill-neutral rounded-full border px-2 py-1 text-xs">{worktrees.length} 个</span>
          <IconButton icon={RefreshCw} label="刷新" onClick={onRefresh} size="md" />
          <button onClick={onCreate} className="app-button-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium">
            <Plus className="h-4 w-4" aria-hidden="true" />
            创建 worktree
          </button>
        </div>
      </div>

      {error ? <p className="app-banner-danger rounded-lg border p-3 text-xs">{error}</p> : null}
      {loading ? <div className="app-border app-text-faint rounded-lg border p-3 text-xs">Worktree 加载中...</div> : null}
      {!loading && worktrees.length === 0 ? (
        <div className="app-border app-text-faint rounded-lg border border-dashed p-4 text-xs">当前项目还没有 worktree。</div>
      ) : null}

      {!loading && worktrees.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {worktrees.map((worktree) => (
            <div
              key={worktree.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                selectedWorktree?.id === worktree.id ? "app-card-selected" : "app-card"
              }`}
            >
              <button type="button" onClick={() => onSelect(worktree)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="app-text truncate font-medium">{worktree.name}</span>
                  <WorktreeStatusPill status={worktree.status} />
                </div>
                <div className="app-text-faint mt-1 truncate text-xs">{worktree.path}</div>
                <div className="app-text-faint mt-2 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate">分支：{worktree.branch}</span>
                  <span className="shrink-0">更新：{formatDateTime(worktree.updatedAt)}</span>
                </div>
              </button>
              <IconButton
                icon={deletingWorktreeId === worktree.id ? LoaderCircle : Trash2}
                label={deletingWorktreeId === worktree.id ? "删除中" : "删除"}
                variant="danger"
                size="sm"
                disabled={deletingWorktreeId !== null}
                onClick={() => onDelete(worktree)}
                className={deletingWorktreeId === worktree.id ? "[&_svg]:animate-spin" : undefined}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
