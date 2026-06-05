import React from "react";
import type { ProjectSummary } from "@workhorse-station/shared";
import type { SkillTransferTarget, SkillTransferMode } from "../../lib/types";
import { Modal } from "../shared/Modal";
import { Field } from "../../components/shared/DetailComponents";
import { Select } from "../../components/ui/Select";

export function SkillTransferModal({
  target,
  projects,
  selectedProjectId,
  mode,
  error,
  onProjectChange,
  onModeChange,
  onSubmit,
  onClose
}: {
  target: SkillTransferTarget;
  projects: ProjectSummary[];
  selectedProjectId: string;
  mode: SkillTransferMode;
  error: string | null;
  onProjectChange: (projectId: string) => void;
  onModeChange: (mode: SkillTransferMode) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const needsProject = target.kind === "global-to-project" || target.kind === "store-to-project";
  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));
  const modeOptions = [
    { value: "copy", label: "复制" },
    { value: "move", label: "转移" }
  ];
  const sourceName = target.kind === "store-to-project" ? target.skill.skill.name : target.skill.name;
  const title = needsProject ? `发送 Skill「${sourceName}」` : `添加 Skill「${sourceName}」到仓库`;
  const description = needsProject
    ? "选择目标项目，并决定保留源 Skill 还是在成功后移走源 Skill。"
    : "选择复制或转移模式，将现有 Skill 放入技能仓库。";

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {needsProject ? (
            <Field label="目标项目">
              <Select options={projectOptions} value={selectedProjectId} onChange={onProjectChange} placeholder="请选择目标项目" />
            </Field>
          ) : null}
          <Field label="传输模式">
            <Select options={modeOptions} value={mode} onChange={(value) => onModeChange(value === "move" ? "move" : "copy")} placeholder="请选择模式" />
          </Field>
        </div>

        <div className="app-input app-border app-text-faint rounded-lg border p-3 text-xs">
          <div>复制：保留源 Skill，目标新增或覆盖。</div>
          <div className="mt-1">转移：目标创建成功后删除源 Skill。</div>
        </div>

        {error ? <p className="app-danger-soft rounded-lg border p-3 text-xs">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
            取消
          </button>
          <button type="button" onClick={onSubmit} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium">
            确认
          </button>
        </div>
      </div>
    </Modal>
  );
}
