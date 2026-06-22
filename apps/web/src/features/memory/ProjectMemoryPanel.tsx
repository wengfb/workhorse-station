import React, { useEffect, useState, type FormEvent } from "react";
import type {
  AgentDocResponse,
  AgentProvider,
  MemoryDetail,
  MemorySummary,
  MemoryType,
  RuleSummary
} from "@workhorse-station/shared";
import { Select } from "../../components/ui/Select";
import { formatError } from "../../lib/format-utils";
import { Modal } from "../shared/Modal";
import {
  createMemory,
  createRule,
  deleteMemory,
  deleteRule,
  getMemories,
  getMemory,
  getProjectAgentDoc,
  getRule,
  getRules,
  updateMemory,
  updateProjectAgentDoc,
  updateRule
} from "../../api";
import { useConfirmDialog } from "../../components/DialogContext";

const providerOptions: Array<{ value: AgentProvider; label: string }> = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" }
];

export const memoryTypeLabels: Record<MemoryType, string> = {
  user: "用户",
  feedback: "反馈",
  project: "项目",
  reference: "参考"
};

export const memoryTypeClasses: Record<MemoryType, string> = {
  user: "memory-chip-user",
  feedback: "memory-chip-feedback",
  project: "memory-chip-project",
  reference: "memory-chip-reference"
};

export function ProjectMemoryPanel({ projectId }: { projectId: string }) {
  const [provider, setProvider] = useState<AgentProvider>("claude");
  const [agentDoc, setAgentDoc] = useState<AgentDocResponse | null>(null);
  const [agentDocLoading, setAgentDocLoading] = useState(true);
  const [savingAgentDoc, setSavingAgentDoc] = useState(false);
  const [agentDocEditing, setAgentDocEditing] = useState(false);
  const [agentDocDraft, setAgentDocDraft] = useState("");

  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesNotice, setRulesNotice] = useState<string | null>(null);
  const [rulesAvailable, setRulesAvailable] = useState(true);
  const [ruleOperationName, setRuleOperationName] = useState<string | null>(null);

  const [memories, setMemories] = useState<MemorySummary[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [memoriesNotice, setMemoriesNotice] = useState<string | null>(null);
  const [memoriesAvailable, setMemoriesAvailable] = useState(true);
  const [memoryOperationName, setMemoryOperationName] = useState<string | null>(null);

  const [memoryFormOpen, setMemoryFormOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryDetail | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<{ name: string; type: MemoryType; description: string; content: string }>({
    name: "",
    type: "reference",
    description: "",
    content: ""
  });
  const [savingMemory, setSavingMemory] = useState(false);

  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleSummary | null>(null);
  const [ruleContentDraft, setRuleContentDraft] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  const { confirm, prompt } = useConfirmDialog();

  useEffect(() => {
    void Promise.all([loadAgentDoc(provider), loadRules(provider), loadMemories(provider)]);
  }, [projectId, provider]);

  async function loadAgentDoc(nextProvider: AgentProvider = provider) {
    setAgentDocLoading(true);
    try {
      const data = await getProjectAgentDoc(projectId, nextProvider);
      setAgentDoc(data);
      setAgentDocDraft(data.content);
    } catch {
      setAgentDoc(null);
      setAgentDocDraft("");
    } finally {
      setAgentDocLoading(false);
    }
  }

  async function loadRules(nextProvider: AgentProvider = provider) {
    setRulesLoading(true);
    try {
      const data = await getRules(projectId, nextProvider);
      setRules(data.rules);
      setRulesAvailable(data.available !== false);
      setRulesNotice(data.notice ?? null);
      setRulesError(null);
    } catch (error) {
      setRulesError(formatError(error, "规则加载失败"));
      setRules([]);
      setRulesAvailable(false);
      setRulesNotice(null);
    } finally {
      setRulesLoading(false);
    }
  }

  async function loadMemories(nextProvider: AgentProvider = provider) {
    setMemoriesLoading(true);
    try {
      const data = await getMemories(projectId, nextProvider);
      setMemories(data.memories);
      setMemoriesAvailable(data.available !== false);
      setMemoriesNotice(data.notice ?? null);
      setMemoriesError(null);
    } catch (error) {
      setMemoriesError(formatError(error, "记忆加载失败"));
      setMemories([]);
      setMemoriesAvailable(false);
      setMemoriesNotice(null);
    } finally {
      setMemoriesLoading(false);
    }
  }

  async function handleSaveAgentDoc() {
    setSavingAgentDoc(true);
    try {
      const data = await updateProjectAgentDoc(projectId, provider, { content: agentDocDraft });
      setAgentDoc(data);
      setAgentDocDraft(data.content);
      setAgentDocEditing(false);
    } catch (error) {
      console.error(formatError(error, `${provider === "codex" ? "AGENTS.md" : "CLAUDE.md"} 保存失败`));
    } finally {
      setSavingAgentDoc(false);
    }
  }

  // ─── Rule handlers ───

  async function handleCreateRule() {
    if (!rulesAvailable) return;
    const name = await prompt("请输入规则文件名（不含 .md 后缀）");
    if (!name) return;
    const trimmedName = name.trim();
    setRuleOperationName(trimmedName);
    setRulesError(null);
    try {
      await createRule(projectId, { name: trimmedName }, provider);
      await loadRules();
    } catch (error) {
      setRulesError(formatError(error, "规则创建失败"));
    } finally {
      setRuleOperationName(null);
    }
  }

  function openEditRule(rule: RuleSummary) {
    setEditingRule(rule);
    setRuleContentDraft("");
    setRuleFormOpen(true);
    getRule(projectId, rule.name, provider)
      .then((data) => {
        setRuleContentDraft(data.rule.content);
      })
      .catch(() => {});
  }

  async function handleSaveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRule) return;
    setSavingRule(true);
    try {
      await updateRule(projectId, editingRule.name, { content: ruleContentDraft }, provider);
      setRuleFormOpen(false);
      setEditingRule(null);
      await loadRules();
    } catch (error) {
      setRulesError(formatError(error, "规则保存失败"));
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeleteRule(rule: RuleSummary) {
    const confirmed = await confirm(`确认删除规则「${rule.name}」？`, { danger: true });
    if (!confirmed) return;
    setRuleOperationName(rule.name);
    setRulesError(null);
    try {
      await deleteRule(projectId, rule.name, { confirmName: rule.name }, provider);
      await loadRules();
    } catch (error) {
      setRulesError(formatError(error, "规则删除失败"));
    } finally {
      setRuleOperationName(null);
    }
  }

  // ─── Memory handlers ───

  function openCreateMemory() {
    if (!memoriesAvailable) return;
    setEditingMemory(null);
    setMemoryDraft({ name: "", type: "reference", description: "", content: "" });
    setMemoryFormOpen(true);
  }

  async function openEditMemory(memory: MemorySummary) {
    try {
      const data = await getMemory(projectId, memory.name, provider);
      setEditingMemory(data.memory);
      setMemoryDraft({
        name: data.memory.name,
        type: data.memory.type,
        description: data.memory.description,
        content: data.memory.content
      });
      setMemoryFormOpen(true);
    } catch (error) {
      setMemoriesError(formatError(error, "记忆读取失败"));
    }
  }

  async function handleSaveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memoryDraft.name.trim()) return;
    setSavingMemory(true);
    try {
      if (editingMemory) {
        await updateMemory(
          projectId,
          editingMemory.name,
          {
            name: memoryDraft.name.trim(),
            type: memoryDraft.type,
            description: memoryDraft.description.trim(),
            content: memoryDraft.content
          },
          provider
        );
      } else {
        await createMemory(
          projectId,
          {
            name: memoryDraft.name.trim(),
            type: memoryDraft.type,
            description: memoryDraft.description.trim(),
            content: memoryDraft.content
          },
          provider
        );
      }
      setMemoryFormOpen(false);
      setEditingMemory(null);
      await loadMemories();
    } catch (error) {
      setMemoriesError(formatError(error, "记忆保存失败"));
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleDeleteMemory(memory: MemorySummary) {
    const confirmed = await confirm(`确认删除记忆「${memory.name}」？`, { danger: true });
    if (!confirmed) return;
    setMemoryOperationName(memory.name);
    setMemoriesError(null);
    try {
      await deleteMemory(projectId, memory.name, { confirmName: memory.name }, provider);
      await loadMemories();
    } catch (error) {
      setMemoriesError(formatError(error, "记忆删除失败"));
    } finally {
      setMemoryOperationName(null);
    }
  }

  const docTitle = agentDoc?.title ?? (provider === "codex" ? "AGENTS.md" : "CLAUDE.md");
  const docHint = agentDoc?.path ?? (provider === "codex" ? "项目根目录/AGENTS.md" : "项目根目录/CLAUDE.md");

  return (
    <div className="space-y-5">
      {/* CLAUDE.md section */}
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-medium">项目指令文件</div>
            <div className="app-text-faint mt-1 text-xs">{docTitle}，来源：{docHint}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="w-32">
              <Select
                value={provider}
                onChange={(value) => {
                  if (value === "claude" || value === "codex") {
                    setProvider(value);
                    setAgentDocEditing(false);
                  }
                }}
                options={providerOptions}
              />
            </div>
            <button onClick={() => void loadAgentDoc()} className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-sm" title="刷新">
              ⟳
            </button>
            {agentDocEditing ? (
              <>
                <button
                  onClick={() => {
                    setAgentDocEditing(false);
                    setAgentDocDraft(agentDoc?.content ?? "");
                  }}
                  className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm"
                >
                  取消
                </button>
                <button onClick={handleSaveAgentDoc} disabled={savingAgentDoc} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                  {savingAgentDoc ? "保存中..." : "保存"}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setAgentDocDraft(agentDoc?.content ?? "");
                  setAgentDocEditing(true);
                }}
                className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm"
              >
                编辑
              </button>
            )}
          </div>
        </div>
        <div className="p-4">
          {agentDocLoading ? (
            <div className="app-text-fainter py-8 text-center text-sm">加载中...</div>
          ) : agentDocEditing ? (
            <textarea
              value={agentDocDraft}
              onChange={(e) => setAgentDocDraft(e.target.value)}
              rows={16}
              className="app-input-shell-strong w-full resize-y rounded-lg border p-3 text-sm font-mono outline-none"
              placeholder={`输入 ${docTitle} 内容...`}
            />
          ) : agentDoc?.content ? (
            <pre className="app-text-soft max-h-96 overflow-y-auto whitespace-pre-wrap text-sm font-mono">{agentDoc.content}</pre>
          ) : (
            <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有 {docTitle} 文件。</div>
          )}
        </div>
      </section>
      {/* Rules section */}
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-medium">规则文件</div>
            <div className="app-text-faint mt-1 text-xs">{provider === "claude" ? "来源：项目 .claude/rules/*.md，签入代码库。" : "Codex 当前没有独立规则目录映射。"} </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadRules()} className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-sm" title="刷新">
              ⟳
            </button>
            <button onClick={() => void handleCreateRule()} disabled={!rulesAvailable} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              新建
            </button>
          </div>
        </div>
        <div className="p-4">
          {rulesNotice ? <p className="app-border app-text-faint mb-2 rounded-lg border border-dashed p-3 text-xs">{rulesNotice}</p> : null}
          {rulesError ? <p className="app-danger-soft mb-2 rounded-lg border p-2 text-xs">{rulesError}</p> : null}
          {rulesLoading ? <div className="app-text-fainter py-8 text-center text-sm">规则加载中...</div> : null}
          {!rulesLoading && rulesAvailable && rules.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有规则文件。</div> : null}
          {!rulesLoading && rulesAvailable && rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((rule) => {
                const busy = ruleOperationName === rule.name;
                return (
                  <div key={rule.name} className="app-card app-border flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <span className="app-text font-medium">{rule.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditRule(rule)} disabled={busy} className="app-button-secondary rounded border px-2 py-0.5 text-xs disabled:opacity-50">
                        编辑
                      </button>
                      <button onClick={() => void handleDeleteRule(rule)} disabled={busy} className="app-button-danger rounded border px-2 py-0.5 text-xs disabled:opacity-50">
                        {busy ? "删除中..." : "删除"}
                      </button>
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
            <div className="app-text-faint mt-1 text-xs">{provider === "claude" ? "来源：~/.claude/projects/<project>/memory/，Claude Code 自动生成。" : "Codex 当前没有等价的自动记忆目录映射。"} </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadMemories()} className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-sm" title="刷新">
              ⟳
            </button>
            <button onClick={openCreateMemory} disabled={!memoriesAvailable} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              新建
            </button>
          </div>
        </div>
        <div className="p-4">
          {memoriesNotice ? <p className="app-border app-text-faint mb-2 rounded-lg border border-dashed p-3 text-xs">{memoriesNotice}</p> : null}
          {memoriesError ? <p className="app-danger-soft mb-2 rounded-lg border p-2 text-xs">{memoriesError}</p> : null}
          {memoriesLoading ? <div className="app-text-fainter py-8 text-center text-sm">记忆加载中...</div> : null}
          {!memoriesLoading && memoriesAvailable && memories.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有自动记忆文件。</div> : null}
          {!memoriesLoading && memoriesAvailable && memories.length > 0 ? (
            <div className="space-y-2">
              {memories.map((memory) => {
                const busy = memoryOperationName === memory.name;
                return (
                  <div key={memory.name} className="app-card app-border rounded-lg border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="app-text font-medium">{memory.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] ${memoryTypeClasses[memory.type]}`}>{memoryTypeLabels[memory.type]}</span>
                          {memory.description ? <span className="app-text-faint text-xs">{memory.description}</span> : null}
                        </div>
                        <div className="app-text-fainter mt-1 break-all text-xs">{memory.path}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => void openEditMemory(memory)} disabled={busy} className="app-button-secondary rounded border px-2 py-0.5 text-xs disabled:opacity-50">
                          编辑
                        </button>
                        <button onClick={() => void handleDeleteMemory(memory)} disabled={busy} className="app-button-danger rounded border px-2 py-0.5 text-xs disabled:opacity-50">
                          {busy ? "删除中..." : "删除"}
                        </button>
                      </div>
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
        <Modal onClose={() => { if (!savingRule) setRuleFormOpen(false); }} title={editingRule ? `编辑规则：${editingRule.name}` : "编辑规则"}>
          <form onSubmit={handleSaveRule} className="space-y-4">
            <textarea
              value={ruleContentDraft}
              onChange={(e) => setRuleContentDraft(e.target.value)}
              rows={18}
              className="app-input-shell-strong w-full resize-y rounded-lg border p-3 text-sm font-mono outline-none"
              placeholder="输入规则内容..."
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRuleFormOpen(false)} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">
                取消
              </button>
              <button type="submit" disabled={savingRule} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                {savingRule ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {/* Memory form modal */}
      {memoryFormOpen ? (
        <Modal onClose={() => { if (!savingMemory) setMemoryFormOpen(false); }} title={editingMemory ? `编辑记忆：${editingMemory.name}` : "新建记忆"}>
          <form onSubmit={handleSaveMemory} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="app-text-muted mb-1 block text-xs">名称</label>
                <input
                  value={memoryDraft.name}
                  onChange={(e) => setMemoryDraft((current) => ({ ...current, name: e.target.value }))}
                  className="app-input-shell-strong w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="memory-name"
                />
              </div>
              <div>
                <label className="app-text-muted mb-1 block text-xs">类型</label>
                <Select
                  value={memoryDraft.type}
                  onChange={(value) => {
                    if (value === "user" || value === "feedback" || value === "project" || value === "reference") {
                      setMemoryDraft((current) => ({ ...current, type: value }));
                    }
                  }}
                  options={[
                    { value: "reference", label: "参考" },
                    { value: "project", label: "项目" },
                    { value: "user", label: "用户" },
                    { value: "feedback", label: "反馈" }
                  ]}
                />
              </div>
            </div>
            <div>
              <label className="app-text-muted mb-1 block text-xs">描述</label>
              <input
                value={memoryDraft.description}
                onChange={(e) => setMemoryDraft((current) => ({ ...current, description: e.target.value }))}
                className="app-input-shell-strong w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="简要描述这条记忆"
              />
            </div>
            <div>
              <label className="app-text-muted mb-1 block text-xs">内容</label>
              <textarea
                value={memoryDraft.content}
                onChange={(e) => setMemoryDraft((current) => ({ ...current, content: e.target.value }))}
                rows={16}
                className="app-input-shell-strong w-full resize-y rounded-lg border p-3 text-sm font-mono outline-none"
                placeholder="输入记忆内容..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMemoryFormOpen(false)} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">
                取消
              </button>
              <button type="submit" disabled={savingMemory} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                {savingMemory ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
