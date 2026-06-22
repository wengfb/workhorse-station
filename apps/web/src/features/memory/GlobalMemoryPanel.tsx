import React, { useEffect, useState } from "react";
import type { AgentDocResponse, AgentProvider, ProjectSummary } from "@workhorse-station/shared";
import { Select } from "../../components/ui/Select";
import { getGlobalAgentDoc, updateGlobalAgentDoc } from "../../api";
import { formatError } from "../../lib/format-utils";

const providerOptions: Array<{ value: AgentProvider; label: string }> = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" }
];

export function GlobalMemoryPanel({ selectedProject, onRefresh }: { selectedProject: ProjectSummary | null; onRefresh?: () => void }) {
  const [provider, setProvider] = useState<AgentProvider>("claude");
  const [doc, setDoc] = useState<AgentDocResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    void loadContent(provider);
  }, [provider]);

  async function loadContent(nextProvider: AgentProvider = provider) {
    setLoading(true);
    try {
      const data = await getGlobalAgentDoc(nextProvider);
      setDoc(data);
      setEditDraft(data.content);
    } catch {
      setDoc(null);
      setEditDraft("");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = await updateGlobalAgentDoc(provider, { content: editDraft });
      setDoc(data);
      setEditDraft(data.content);
      setEditing(false);
    } catch (error) {
      console.error(formatError(error, `全局 ${provider === "codex" ? "AGENTS.md" : "CLAUDE.md"} 保存失败`));
    } finally {
      setSaving(false);
    }
  }

  const title = doc?.title ?? (provider === "codex" ? "AGENTS.md" : "CLAUDE.md");
  const sourceHint = doc?.path ?? (provider === "codex" ? "~/.codex/AGENTS.md" : "~/.claude/CLAUDE.md");

  return (
    <div className="space-y-5">
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-medium">全局指令文件</div>
            <div className="app-text-faint mt-1 text-xs">{title}，来源：{sourceHint}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-32">
              <Select
                value={provider}
                onChange={(value) => {
                  if (value === "claude" || value === "codex") {
                    setProvider(value);
                    setEditing(false);
                  }
                }}
                options={providerOptions}
              />
            </div>
            <button
              onClick={() => {
                if (onRefresh) {
                  onRefresh();
                }
                void loadContent();
              }}
              className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-sm"
              title="刷新"
            >
              ⟳
            </button>
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditDraft(doc?.content ?? "");
                  }}
                  className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm"
                >
                  取消
                </button>
                <button onClick={handleSave} disabled={saving} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                  {saving ? "保存中..." : "保存"}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setEditDraft(doc?.content ?? "");
                  setEditing(true);
                }}
                className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm"
              >
                编辑
              </button>
            )}
          </div>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="app-text-fainter py-8 text-center text-sm">加载中...</div>
          ) : editing ? (
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={12}
              className="app-input-shell-strong w-full resize-y rounded-lg border p-3 text-sm font-mono outline-none"
              placeholder={`输入全局 ${title} 内容...`}
            />
          ) : doc?.content ? (
            <pre className="app-text-soft max-h-80 overflow-y-auto whitespace-pre-wrap text-sm font-mono">{doc.content}</pre>
          ) : (
            <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有全局 {title} 文件。</div>
          )}
        </div>
      </section>

      {selectedProject ? (
        <section className="app-panel app-border rounded-xl border">
          <div className="app-border border-b px-4 py-3">
            <div className="app-text text-sm font-medium">项目级指令与记忆</div>
            <div className="app-text-faint mt-1 text-xs">进入项目「{selectedProject.name}」的记忆标签页管理项目级 {provider === "codex" ? "AGENTS.md" : "CLAUDE.md"}、规则和自动记忆。</div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
