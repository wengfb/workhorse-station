import type { WorktreeStatus } from "@workhorse-station/shared";

export function StatusPill({ connected, loading }: { connected: boolean; loading: boolean }) {
  const label = loading ? "API 连接中" : connected ? "API 已连接" : "API 未连接";
  const className = connected ? "app-pill-success" : "app-pill-warning";

  return <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>{label}</span>;
}

export function WorktreeStatusPill({ status }: { status: WorktreeStatus }) {
  const styles: Record<WorktreeStatus, string> = {
    clean: "app-pill-success",
    dirty: "app-pill-warning",
    missing: "app-pill-danger",
    unknown: "app-pill-neutral",
  };

  const labels: Record<WorktreeStatus, string> = {
    clean: "clean",
    dirty: "dirty",
    missing: "missing",
    unknown: "unknown",
  };

  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${styles[status]}`}>{labels[status]}</span>;
}

export function SessionStatusPill({ status }: { status: "draft" | "queued" | "running" | "completed" | "failed" }) {
  const styles: Record<string, string> = {
    draft: "app-pill-warning",
    queued: "app-pill-info",
    running: "app-pill-success",
    completed: "app-pill-neutral",
    failed: "app-pill-danger",
  };

  const labels: Record<string, string> = {
    draft: "draft",
    queued: "queued",
    running: "running",
    completed: "completed",
    failed: "failed",
  };

  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${styles[status]}`}>{labels[status]}</span>;
}
