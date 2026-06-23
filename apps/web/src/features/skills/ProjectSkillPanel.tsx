import React from "react";
import { Copy, FilePenLine, LoaderCircle, PackagePlus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { ProjectSummary, ProjectSkillSummary } from "@workhorse-station/shared";
import { EmptyProjectNotice } from "../shared/EmptyProjectNotice";
import { PathBlock } from "../shared/PathBlock";
import { DetailRow } from "../../components/shared/DetailComponents";
import { IconButton } from "../../components/shared/IconButton";

export function ProjectSkillPanel({
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
  onAddProjectSkillToStore,
  onEditDocument,
  onRefresh,
  onCreateProject
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
  onAddProjectSkillToStore: (skill: ProjectSkillSummary) => void;
  onEditDocument: (skill: ProjectSkillSummary) => void;
  onRefresh: () => void;
  onCreateProject?: () => void;
}) {
  if (!project) {
    return <EmptyProjectNotice onCreateProject={onCreateProject ?? (() => undefined)} />;
  }

  const selectedSkill = skills.find((skill) => skill.name === selectedSkillName) ?? skills[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-medium">项目 Skill 文件夹</div>
            <div className="app-text-faint mt-1 break-all text-xs">来源：{project.path}/.claude/skills/*</div>
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
          {loading ? <div className="app-border app-text-muted rounded-lg border p-3 text-xs">项目 Skill 加载中...</div> : null}
          {!loading && skills.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-4 text-xs">当前项目和全局都没有 Skill 文件夹。</div> : null}
          {!loading && skills.length > 0 ? (
            <div className="space-y-2">
              {skills.map((skill) => (
                <button
                  key={skill.name}
                  onClick={() => onSelect(skill)}
                  className={`w-full rounded-lg border p-3 text-left text-sm ${selectedSkill?.name === skill.name ? "app-card-selected" : "app-card app-card-hover"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="app-text font-medium">{skill.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${skill.effectiveSource === "project" ? "app-pill-success" : "app-pill-info"}`}>
                          {skill.effectiveSource === "project" ? "项目生效" : "全局生效"}
                        </span>
                        {skill.hasOverride ? <span className="app-pill-warning rounded-full border px-2 py-0.5 text-[11px]">覆盖全局</span> : null}
                      </div>
                      <div className="app-text-faint mt-1 truncate text-xs">{skill.effectivePath}</div>
                    </div>
                    <span className="app-text-faint shrink-0 text-xs">{skill.hasProject ? "项目" : "全局"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="app-panel app-border app-text-muted rounded-xl border p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="app-text font-medium">Skill 详情</div>
          </div>
          <span className="app-card app-border app-text-muted rounded-full border px-2 py-1 text-xs">{skills.length} 个</span>
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
            <div className="app-border flex flex-wrap gap-1.5 border-t pt-4">
              <IconButton
                icon={Pencil}
                label="重命名项目 Skill"
                disabled={!selectedSkill.hasProject || operationName === selectedSkill.name}
                onClick={() => onRename(selectedSkill)}
                size="md"
              />
              <IconButton
                icon={Copy}
                label="复制到全局"
                variant="info"
                disabled={!selectedSkill.hasProject || operationName === selectedSkill.name}
                onClick={() => onCopyToGlobal(selectedSkill)}
                size="md"
              />
              <IconButton
                icon={FilePenLine}
                label="编辑文档"
                disabled={operationName === selectedSkill.name}
                onClick={() => onEditDocument(selectedSkill)}
                size="md"
              />
              <IconButton
                icon={PackagePlus}
                label="添加到技能仓库"
                variant="success"
                disabled={!selectedSkill.hasProject || operationName === selectedSkill.name}
                onClick={() => onAddProjectSkillToStore(selectedSkill)}
                size="md"
              />
              <IconButton
                icon={operationName === selectedSkill.name ? LoaderCircle : Trash2}
                label={operationName === selectedSkill.name ? "处理中" : "删除项目 Skill"}
                variant="danger"
                disabled={!selectedSkill.hasProject || operationName === selectedSkill.name}
                onClick={() => onDelete(selectedSkill)}
                size="md"
                className={operationName === selectedSkill.name ? "[&_svg]:animate-spin" : undefined}
              />
            </div>
          </div>
        ) : (
          <div className="app-border app-text-faint mt-4 rounded-lg border border-dashed p-4 text-xs">选择或创建一个 Skill 文件夹。</div>
        )}
      </section>
    </div>
  );
}
