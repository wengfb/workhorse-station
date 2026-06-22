import React, { useState, type FormEvent } from "react";
import type { InstallTarget, StoreSkillStatus, ChatSkill } from "@workhorse-station/shared";

export function SkillStorePanel({
  skills,
  loading,
  error,
  operationName,
  onCreate,
  onRename,
  onDelete,
  onInstall,
  onSendToProject,
  onEditDocument,
  onRefreshStore,
  hasProjectContext,
  chatSkills,
  chatSkillsLoading,
  chatSkillsError,
  deletingChatSkillName,
  onDeleteChatSkill,
  onRefreshChatSkills
}: {
  skills: StoreSkillStatus[];
  loading: boolean;
  error: string | null;
  operationName: string | null;
  onCreate: (name: string, description: string) => void;
  onRename: (skill: StoreSkillStatus) => void;
  onDelete: (skill: StoreSkillStatus) => void;
  onInstall: (skill: StoreSkillStatus, target: InstallTarget) => void;
  onSendToProject: (skill: StoreSkillStatus) => void;
  onEditDocument: (skill: StoreSkillStatus) => void;
  onRefreshStore: () => void;
  hasProjectContext: boolean;
  chatSkills: ChatSkill[];
  chatSkillsLoading: boolean;
  chatSkillsError: string | null;
  deletingChatSkillName: string | null;
  onDeleteChatSkill: (skill: ChatSkill) => void;
  onRefreshChatSkills: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");

  function handleSubmitCreate(e: FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    onCreate(name, createDesc.trim());
    setShowCreate(false);
    setCreateName("");
    setCreateDesc("");
  }

  function openCreate() {
    setCreateName("");
    setCreateDesc("");
    setShowCreate(true);
  }

  const installTargets: Array<{
    key: InstallTarget;
    label: string;
    title: string;
    installedKey: keyof StoreSkillStatus["installed"];
    requiresProject?: boolean;
  }> = [
    { key: "claude-global", label: "装到 Claude", title: "安装到全局 Claude Skills", installedKey: "claudeGlobal" },
    { key: "codex-global", label: "装到 Codex", title: "安装到全局 Codex Skills", installedKey: "codexGlobal" },
    { key: "chat", label: "装到 Chat", title: "安装到 AI Chat", installedKey: "chat" },
    { key: "claude-project", label: "项目 Claude", title: "安装到当前项目的 Claude Skills", installedKey: "claudeProject", requiresProject: true },
    { key: "codex-project", label: "项目 Codex", title: "安装到当前项目的 Codex Skills", installedKey: "codexProject", requiresProject: true }
  ];

  return (
    <section className="app-panel app-border rounded-xl border">
      <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="app-text text-sm font-medium">技能仓库</div>
          <div className="app-text-faint mt-1 text-xs">来源：~/.workhorse/skills/*，统一管理并安装到各目标。</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefreshStore} className="app-border app-text-muted app-hover-accent app-hover-border app-hover-text rounded-lg border px-2.5 py-2 text-sm" title="刷新">
            ⟳
          </button>
          <button onClick={openCreate} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium">
            新建
          </button>
        </div>
      </div>
      <div className="p-4">
        {error ? <p className="app-danger-soft mb-3 rounded-lg border p-3 text-xs">{error}</p> : null}
        {loading ? <div className="app-border app-text-muted rounded-lg border p-3 text-xs">技能仓库加载中...</div> : null}
        {!loading && skills.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-4 text-xs">还没有 Skill，先新建一个。</div> : null}
        {!loading && skills.length > 0 ? (
          <div className="space-y-2">
            {skills.map((item) => {
              const busy = operationName === item.skill.name;
              return (
                <div key={item.skill.name} className="app-card app-border rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="app-text font-medium">{item.skill.name}</span>
                        {item.skill.description ? <span className="app-text-faint text-xs">{item.skill.description}</span> : null}
                      </div>
                      <div className="app-text-fainter mt-1 break-all text-xs">{item.skill.path}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${item.installed.claudeGlobal ? "app-pill-success" : "app-card app-border app-text-fainter"}`}>
                          Claude 全局
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${item.installed.codexGlobal ? "app-pill-success" : "app-card app-border app-text-fainter"}`}>
                          Codex 全局
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${item.installed.chat ? "app-pill-success" : "app-card app-border app-text-fainter"}`}>
                          Chat
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${item.installed.claudeProject ? "app-pill-success" : "app-card app-border app-text-fainter"}`}>
                          Claude 项目
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${item.installed.codexProject ? "app-pill-success" : "app-card app-border app-text-fainter"}`}>
                          Codex 项目
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {installTargets.map((target) => {
                        const disabled = busy || item.installed[target.installedKey] || (target.requiresProject ? !hasProjectContext : false);
                        return (
                          <button
                            key={target.key}
                            disabled={disabled}
                            onClick={() => onInstall(item, target.key)}
                            className="app-border app-text-soft app-hover-accent app-hover-border app-hover-text rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                            title={target.requiresProject && !hasProjectContext ? "请先选择一个项目" : target.title}
                          >
                            {target.label}
                          </button>
                        );
                      })}
                      <button disabled={busy} onClick={() => onSendToProject(item)} className="app-button-success rounded-md border px-2 py-1 text-xs disabled:opacity-50" title="发送到指定项目">
                        发送到项目
                      </button>
                      <button disabled={busy} onClick={() => onRename(item)} className="app-border app-text-soft app-hover-accent app-hover-border app-hover-text rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                        重命名
                      </button>
                      <button disabled={busy} onClick={() => onEditDocument(item)} className="app-border app-text-soft app-hover-accent app-hover-border app-hover-text rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                        编辑文档
                      </button>
                      <button disabled={busy} onClick={() => onDelete(item)} className="app-button-danger rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                        {busy ? "处理中" : "删除"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {showCreate ? (
        <>
          <div className="app-backdrop fixed inset-0 z-50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="app-panel-strong app-border w-full max-w-sm rounded-xl border shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmitCreate}>
                <div className="p-4 pb-0">
                  <h3 className="app-text text-sm font-medium">新建 Skill</h3>
                  <p className="app-text-faint mt-1 text-xs">在 ~/.workhorse/skills/ 下创建新的 Skill 文件夹。</p>
                </div>
                <div className="space-y-3 px-4 pt-4">
                  <div>
                    <label className="app-text-muted mb-1 block text-xs">名称</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="app-input-shell-strong w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      placeholder="Skill 名称"
                    />
                  </div>
                  <div>
                    <label className="app-text-muted mb-1 block text-xs">描述（可选）</label>
                    <input
                      type="text"
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      className="app-input-shell-strong w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      placeholder="简要描述 Skill 用途"
                    />
                  </div>
                </div>
                <div className="app-border-soft mt-4 flex justify-end gap-2 border-t p-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="app-border app-text-muted app-hover-accent app-hover-border app-hover-text rounded-lg border px-3 py-1.5 text-sm transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  >
                    创建
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}

      <div className="app-border border-t px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="app-text text-sm font-medium">Chat Skills</div>
            <div className="app-text-faint mt-0.5 text-xs">AI Chat 运行时加载的 Skill，来源：~/.workhorse/chat-skills/*</div>
          </div>
          <button onClick={onRefreshChatSkills} className="app-border app-text-muted app-hover-accent app-hover-border app-hover-text rounded-lg border px-2.5 py-2 text-sm" title="刷新">
            ⟳
          </button>
        </div>
        {chatSkillsError ? <p className="app-danger-soft mb-3 rounded-lg border p-3 text-xs">{chatSkillsError}</p> : null}
        {chatSkillsLoading ? <div className="app-border app-text-muted rounded-lg border p-3 text-xs">Chat Skills 加载中...</div> : null}
        {!chatSkillsLoading && chatSkills.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-3 text-xs">还没有安装 Chat Skill，可在上方仓库中安装。</div> : null}
        {!chatSkillsLoading && chatSkills.length > 0 ? (
          <div className="space-y-2">
            {chatSkills.map((skill) => {
              const busy = deletingChatSkillName === skill.name;
              return (
                <div key={skill.name} className="app-card app-border rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="app-text font-medium">{skill.name}</span>
                        {skill.description ? <span className="app-text-faint text-xs">{skill.description}</span> : null}
                      </div>
                      <div className="app-text-fainter mt-1 break-all text-xs">{skill.path}</div>
                    </div>
                    <button disabled={busy} onClick={() => onDeleteChatSkill(skill)} className="app-button-danger shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                      {busy ? "处理中" : "移除"}
                    </button>
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
