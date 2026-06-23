import React from "react";
import { FilePenLine, LoaderCircle, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import type { ProjectSummary, SkillSummary, ProjectSkillSummary } from "@workhorse-station/shared";
import { IconButton } from "../../components/shared/IconButton";

export function GlobalSkillPanel({
  selectedProject,
  skills,
  projectSkills,
  loading,
  error,
  operationName,
  onCreate,
  onRename,
  onDelete,
  onCopyToProject,
  onEditDocument,
  onRefresh
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
  onEditDocument: (skill: SkillSummary) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="app-panel app-border rounded-xl border">
      <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="app-text text-sm font-medium">全局 Skill 文件夹</div>
        </div>
        <div className="flex items-center gap-2">
          <IconButton icon={RefreshCw} label="刷新" onClick={onRefresh} size="md" />
          <button onClick={onCreate} className="app-button-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium">
            <Plus className="h-4 w-4" aria-hidden="true" />
            新建
          </button>
        </div>
      </div>
      <div className="p-4">
        {error ? <p className="app-danger-soft mb-3 rounded-lg border p-3 text-xs">{error}</p> : null}
        {loading ? <div className="app-border app-text-muted rounded-lg border p-3 text-xs">全局 Skill 加载中...</div> : null}
        {!loading && skills.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-4 text-xs">还没有全局 Skill 文件夹。</div> : null}
        {!loading && skills.length > 0 ? (
          <div className="space-y-2">
            {skills.map((skill) => {
              const projectState = projectSkills.find((item) => item.name === skill.name);
              const busy = operationName === skill.name;
              return (
                <div key={skill.name} className="app-card app-border rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="app-text font-medium">{skill.name}</span>
                        {projectState?.hasOverride ? <span className="app-pill-warning rounded-full border px-2 py-0.5 text-[11px]">被项目覆盖</span> : null}
                      </div>
                      <div className="app-text-faint mt-1 break-all text-xs">{skill.path}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <IconButton icon={FilePenLine} label="编辑文档" disabled={busy} onClick={() => onEditDocument(skill)} size="sm" />
                      <IconButton icon={Send} label="发送到项目" variant="success" disabled={busy} onClick={() => onCopyToProject(skill)} size="sm" />
                      <IconButton
                        icon={busy ? LoaderCircle : Trash2}
                        label={busy ? "处理中" : "删除"}
                        variant="danger"
                        disabled={busy}
                        onClick={() => onDelete(skill)}
                        size="sm"
                        className={busy ? "[&_svg]:animate-spin" : undefined}
                      />
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
