import React, { useState, useEffect, type FormEvent } from "react";
import type {
  MemoryType,
  MemorySummary,
  MemoryDetail,
  RuleSummary,
} from "@workhorse-station/shared";
import { formatError } from "../../lib/format-utils";
import { Field } from "../../components/shared/DetailComponents";
import { Modal } from "../shared/Modal";
import {
  getProjectClaudeMd,
  updateProjectClaudeMd,
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  getMemories,
  getMemory,
  createMemory,
  updateMemory,
  deleteMemory,
} from "../../api";
import { useConfirmDialog } from "../../components/DialogContext";

export const memoryTypeLabels: Record<MemoryType, string> = {
  user: "用户",
  feedback: "反馈",
  project: "项目",
  reference: "参考",
};

export const memoryTypeClasses: Record<MemoryType, string> = {
  user: "memory-chip-user",
  feedback: "memory-chip-feedback",
  project: "memory-chip-project",
  reference: "memory-chip-reference",
};

export function ProjectMemoryPanel({ projectId }: { projectId: string }) {
  const [claudeMd, setClaudeMd] = useState("");
  const [claudeMdLoading, setClaudeMdLoading] = useState(true);
  const [savingClaudeMd, setSavingClaudeMd] = useState(false);
  const [claudeMdEditing, setClaudeMdEditing] = useState(false);
  const [claudeMdDraft, setClaudeMdDraft] = useState("");

  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [ruleOperationName, setRuleOperationName] = useState<string | null>(null);

  const [memories, setMemories] = useState<MemorySummary[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [memoryOperationName, setMemoryOperationName] = useState<string | null>(null);

  const [memoryFormOpen, setMemoryFormOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryDetail | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<{ name: string; type: MemoryType; description: string; content: string }>({
    name: "", type: "reference", description: "", content: "",
  });
  const [savingMemory, setSavingMemory] = useState(false);

  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleSummary | null>(null);
  const [ruleContentDraft, setRuleContentDraft] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  const { confirm, prompt } = useConfirmDialog();

  useEffect(() => {
    loadClaudeMd();
    loadRules();
    loadMemories();
  }, [projectId]);

  async function loadClaudeMd() {
    setClaudeMdLoading(true);
    try {
      const data = await getProjectClaudeMd(projectId);
      setClaudeMd(data.content);
      setClaudeMdDraft(data.content);
    } catch { setClaudeMd(""); setClaudeMdDraft(""); }
    finally { setClaudeMdLoading(false); }
  }

  async function loadRules() {
    setRulesLoading(true);
    try {
      const data = await getRules(projectId);
      setRules(data.rules);
      setRulesError(null);
    } catch (error) { setRulesError(formatError(error, "规则加载失败")); }
    finally { setRulesLoading(false); }
  }

  async function loadMemories() {
    setMemoriesLoading(true);
    try {
      const data = await getMemories(projectId);
      setMemories(data.memories);
      setMemoriesError(null);
    } catch (error) { setMemoriesError(formatError(error, "记忆加载失败")); }
    finally { setMemoriesLoading(false); }
  }

  async function handleSaveClaudeMd() {
    setSavingClaudeMd(true);
    try {
      await updateProjectClaudeMd(projectId, { content: claudeMdDraft });
      setClaudeMd(claudeMdDraft);
      setClaudeMdEditing(false);
    } catch (error) { console.error(formatError(error, "CLAUDE.md 保存失败")); }
    finally { setSavingClaudeMd(false); }
  }

  function startEditClaudeMd() {
    setClaudeMdDraft(claudeMd);
    setClaudeMdEditing(true);
  }

  // ─── Rule handlers ───

  async function handleCreateRule() {
    const name = await prompt("请输入规则文件名（不含 .md 后缀）");
    if (!name) return;
    const trimmedName = name.trim();
    setRuleOperationName(trimmedName);
    setRulesError(null);
    try {
      await createRule(projectId, { name: trimmedName });
      await loadRules();
    } catch (error) { setRulesError(formatError(error, "规则创建失败")); }
    finally { setRuleOperationName(null); }
  }

  function openEditRule(rule: RuleSummary) {
    setEditingRule(rule);
    setRuleContentDraft("");
    setRuleFormOpen(true);
    getRule(projectId, rule.name).then((data) => {
      setRuleContentDraft(data.rule.content);
    }).catch(() => {});
  }

  function openCreateRule() {
    handleCreateRule();
  }

  async function handleSaveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRule) return;
    setSavingRule(true);
    try {
      await updateRule(projectId, editingRule.name, { content: ruleContentDraft });
      setRuleFormOpen(false);
      setEditingRule(null);
      await loadRules();
    } catch (error) { setRulesError(formatError(error, "规则保存失败")); }
    finally { setSavingRule(false); }
  }

  async function handleDeleteRule(rule: RuleSummary) {
    const confirmed = await confirm(`确认删除规则「${rule.name}」？`, { danger: true });
    if (!confirmed) return;
    setRuleOperationName(rule.name);
    setRulesError(null);
    try {
      await deleteRule(projectId, rule.name, { confirmName: rule.name });
      await loadRules();
    } catch (error) { setRulesError(formatError(error, "规则删除失败")); }
    finally { setRuleOperationName(null); }
  }

  // ─── Memory handlers ───

  function openCreateMemory() {
    setEditingMemory(null);
    setMemoryDraft({ name: "", type: "reference", description: "", content: "" });
    setMemoryFormOpen(true);
  }

  async function openEditMemory(memory: MemorySummary) {
    try {
      const data = await getMemory(projectId, memory.name);
      setEditingMemory(data.memory);
      setMemoryDraft({
        name: data.memory.name,
        type: data.memory.type,
        description: data.memory.description,
        content: data.memory.content,
      });
      setMemoryFormOpen(true);
    } catch (error) { setMemoriesError(formatError(error, "记忆读取失败")); }
  }

  async function handleSaveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memoryDraft.name.trim()) return;
    setSavingMemory(true);
    try {
      if (editingMemory) {
        await updateMemory(projectId, editingMemory.name, {
          name: memoryDraft.name.trim(),
          type: memoryDraft.type,
          description: memoryDraft.description.trim(),
          content: memoryDraft.content,
        });
      } else {
        await createMemory(projectId, {
          name: memoryDraft.name.trim(),
          type: memoryDraft.type,
          description: memoryDraft.description.trim(),
          content: memoryDraft.content,
        });
      }
      setMemoryFormOpen(false);
      setEditingMemory(null);
      await loadMemories();
    } catch (error) { setMemoriesError(formatError(error, "记忆保存失败")); }
    finally { setSavingMemory(false); }
  }

  async function handleDeleteMemory(memory: MemorySummary) {
    const confirmed = await confirm(`确认删除记忆「${memory.name}」？`, { danger: true });
    if (!confirmed) return;
    setMemoryOperationName(memory.name);
    setMemoriesError(null);
    try {
      await deleteMemory(projectId, memory.name, { confirmName: memory.name });
      await loadMemories();
    } catch (error) { setMemoriesError(formatError(error, "记忆删除失败")); }
    finally { setMemoryOperationName(null); }
  }

  return (
    <div className="space-y-5">
      {/* CLAUDE.md section */}
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-medium">CLAUDE.md</div>
            <div className="app-text-faint mt-1 text-xs">项目根目录的 CLAUDE.md 指令文件，签入代码库。</div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadClaudeMd} className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-sm" title="刷新">
              ⟳
            </button>
            {claudeMdEditing ? (
              <>
                <button onClick={() => { setClaudeMdEditing(false); setClaudeMdDraft(claudeMd); }} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">取消</button>
                <button onClick={handleSaveClaudeMd} disabled={savingClaudeMd} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                  {savingClaudeMd ? "保存中..." : "保存"}
                </button>
              </>
            ) : (
              <button onClick={startEditClaudeMd} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">编辑</button>
            )}
          </div>
        </div>
        <div className="p-4">
          {claudeMdLoading ? (
            <div className="app-text-fainter py-8 text-center text-sm">加载中...</div>
          ) : claudeMdEditing ? (
            <textarea
              value={claudeMdDraft}
              onChange={(e) => setClaudeMdDraft(e.target.value)}
              rows={16}
              className="app-input-shell-strong w-full resize-y rounded-lg border p-3 text-sm font-mono outline-none"
              placeholder="输入 CLAUDE.md 内容..."
            />
          ) : claudeMd ? (
            <pre className="app-text-soft whitespace-pre-wrap text-sm font-mono max-h-96 overflow-y-auto">{claudeMd}</pre>
          ) : (
            <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有 CLAUDE.md 文件。</div>
          )}
        </div>
      </section>

      {/* Rules section */}
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-medium">规则文件</div>
            <div className="app-text-faint mt-1 text-xs">来源：项目 .claude/rules/*.md，签入代码库。</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadRules} className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-sm" title="刷新">
              ⟳
            </button>
            <button onClick={openCreateRule} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium">新建</button>
          </div>
        </div>
        <div className="p-4">
          {rulesError ? <p className="app-danger-soft mb-2 rounded-lg border p-2 text-xs">{rulesError}</p> : null}
          {rulesLoading ? <div className="app-text-fainter py-8 text-center text-sm">规则加载中...</div> : null}
          {!rulesLoading && rules.length === 0 ? (
            <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有规则文件。</div>
          ) : null}
          {!rulesLoading && rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((rule) => {
                const busy = ruleOperationName === rule.name;
                return (
                  <div key={rule.name} className="app-card app-border flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <span className="app-text font-medium">{rule.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditRule(rule)} disabled={busy} className="app-button-secondary rounded border px-2 py-0.5 text-xs disabled:opacity-50">编辑</button>
                      <button onClick={() => handleDeleteRule(rule)} disabled={busy} className="app-button-danger rounded border px-2 py-0.5 text-xs disabled:opacity-50">{busy ? "删除中..." : "删除"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* Auto memory section */}
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-medium">自动记忆</div>
            <div className="app-text-faint mt-1 text-xs">来源：~/.claude/projects/&lt;project&gt;/memory/，Claude Code 自动生成。</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadMemories} className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-sm" title="刷新">
              ⟳
            </button>
            <button onClick={openCreateMemory} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium">新建</button>
          </div>
        </div>
        <div className="p-4">
          {memoriesError ? <p className="app-danger-soft mb-2 rounded-lg border p-2 text-xs">{memoriesError}</p> : null}
          {memoriesLoading ? <div className="app-text-fainter py-8 text-center text-sm">记忆加载中...</div> : null}
          {!memoriesLoading && memories.length === 0 ? (
            <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有自动记忆文件。</div>
          ) : null}
          {!memoriesLoading && memories.length > 0 ? (
            <div className="space-y-2">
              {memories.map((memory) => {
                const busy = memoryOperationName === memory.name;
                return (
                  <div key={memory.name} className="app-card app-border flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="app-text font-medium truncate">{memory.name}</span>
                        <span className={`memory-chip shrink-0 rounded px-1.5 py-0.5 text-xs ${memoryTypeClasses[memory.type]}`}>
                          {memoryTypeLabels[memory.type]}
                        </span>
                      </div>
                      <div className="app-text-faint mt-0.5 truncate text-xs">{memory.description}</div>
                    </div>
                    <div className="ml-3 flex shrink-0 gap-1">
                      <button onClick={() => openEditMemory(memory)} disabled={busy} className="app-button-secondary rounded border px-2 py-0.5 text-xs disabled:opacity-50">编辑</button>
                      <button onClick={() => handleDeleteMemory(memory)} disabled={busy} className="app-button-danger rounded border px-2 py-0.5 text-xs disabled:opacity-50">{busy ? "删除中..." : "删除"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* Rule edit modal */}
      {ruleFormOpen ? (
        <Modal title={`编辑规则：${editingRule?.name ?? ""}`} onClose={() => { setRuleFormOpen(false); setEditingRule(null); }}>
          <form onSubmit={handleSaveRule} className="space-y-4">
            <Field label="Markdown 内容">
              <textarea
                value={ruleContentDraft}
                onChange={(e) => setRuleContentDraft(e.target.value)}
                rows={16}
                className="app-input-shell-strong w-full resize-y rounded-lg border p-3 text-sm font-mono outline-none"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setRuleFormOpen(false); setEditingRule(null); }} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">取消</button>
              <button type="submit" disabled={savingRule} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">{savingRule ? "保存中..." : "保存"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Memory form modal */}
      {memoryFormOpen ? (
        <Modal title={editingMemory ? "编辑记忆" : "新建记忆"} description="编辑 frontmatter 字段和正文内容" onClose={() => { setMemoryFormOpen(false); setEditingMemory(null); }}>
          <form onSubmit={handleSaveMemory} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="文件名（不含 .md）">
                <input
                  value={memoryDraft.name}
                  onChange={(e) => setMemoryDraft((d) => ({ ...d, name: e.target.value }))}
                  className="app-input-shell-strong w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="my-memory"
                />
              </Field>
              <Field label="类型">
                <select
                  value={memoryDraft.type}
                  onChange={(e) => setMemoryDraft((d) => ({ ...d, type: e.target.value as MemoryType }))}
                  className="app-input-shell-strong w-full rounded-lg border px-3 py-2 text-sm outline-none"
                >
                  <option value="user">用户 (user)</option>
                  <option value="feedback">反馈 (feedback)</option>
                  <option value="project">项目 (project)</option>
                  <option value="reference">参考 (reference)</option>
                </select>
              </Field>
              <Field label="描述">
                <input
                  value={memoryDraft.description}
                  onChange={(e) => setMemoryDraft((d) => ({ ...d, description: e.target.value }))}
                  className="app-input-shell-strong w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="简要描述"
                />
              </Field>
            </div>
            <Field label="Markdown 正文">
              <textarea
                value={memoryDraft.content}
                onChange={(e) => setMemoryDraft((d) => ({ ...d, content: e.target.value }))}
                rows={14}
                className="app-input-shell-strong w-full resize-y rounded-lg border p-3 text-sm font-mono outline-none"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setMemoryFormOpen(false); setEditingMemory(null); }} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">取消</button>
              <button type="submit" disabled={savingMemory} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">{savingMemory ? "保存中..." : "保存"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
