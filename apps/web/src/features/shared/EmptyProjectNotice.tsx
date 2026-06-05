import type { ReactNode } from "react";
import type { ProjectSummary } from "@workhorse-station/shared";

export function EmptyProjectNotice({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <section className="app-panel app-border app-text-faint rounded-xl border border-dashed p-6 text-sm">
      <div className="app-text text-base font-medium">还没有选择项目</div>
      <p className="mt-2">进入项目后才能查看任务、项目笔记、项目 Skill、会话和 Worktree。</p>
      <button onClick={onCreateProject} className="app-button-primary mt-4 rounded-lg px-3 py-2 text-sm font-medium">
        新建项目
      </button>
    </section>
  );
}
