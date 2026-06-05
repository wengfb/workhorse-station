import React, { useState, useEffect } from "react";
import type { ProjectSummary } from "@workhorse-station/shared";
import { formatError } from "../../lib/format-utils";
import { getGlobalClaudeMd, updateGlobalClaudeMd } from "../../api";

export function GlobalMemoryPanel({ selectedProject, onRefresh }: { selectedProject: ProjectSummary | null; onRefresh?: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => { loadContent(); }, []);

  async function loadContent() {
    setLoading(true);
    try {
      const data = await getGlobalClaudeMd();
      setContent(data.content);
      setEditDraft(data.content);
    } catch { setContent(""); setEditDraft(""); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateGlobalClaudeMd({ content: editDraft });
      setContent(editDraft);
      setEditing(false);
    } catch (error) { console.error(formatError(error, "全局 CLAUDE.md 保存失败")); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="app-text text-sm font-medium">全局 CLAUDE.md</div>
            <div className="app-text-faint mt-1 text-xs">来源：~/.claude/CLAUDE.md，所有项目的全局指令。</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if (onRefresh) onRefresh(); else loadContent(); }} className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-sm" title="刷新">
              ⟳
            </button>
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setEditDraft(content); }} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">取消</button>
                <button onClick={handleSave} disabled={saving} className="app-button-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">{saving ? "保存中..." : "保存"}</button>
              </>
            ) : (
              <button onClick={() => { setEditDraft(content); setEditing(true); }} className="app-button-secondary rounded-lg border px-3 py-1.5 text-sm">编辑</button>
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
              placeholder="输入全局 CLAUDE.md 内容..."
            />
          ) : content ? (
            <pre className="app-text-soft whitespace-pre-wrap text-sm font-mono max-h-80 overflow-y-auto">{content}</pre>
          ) : (
            <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有全局 CLAUDE.md 文件。</div>
          )}
        </div>
      </section>

      {selectedProject ? (
        <section className="app-panel app-border rounded-xl border">
          <div className="app-border border-b px-4 py-3">
            <div className="app-text text-sm font-medium">项目记忆</div>
            <div className="app-text-faint mt-1 text-xs">进入项目「{selectedProject.name}」的记忆标签页管理 CLAUDE.md、规则和自动记忆。</div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
