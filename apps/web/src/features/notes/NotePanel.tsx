import React, { useState, type FormEvent } from "react";
import type { NoteSummary, ProjectSummary } from "@workhorse-station/shared";
import type { NoteDraft } from "../../lib/types";
import { formatDateTime } from "../../lib/format-utils";
import { Field } from "../../components/shared/DetailComponents";
import { Modal } from "../shared/Modal";
import { EmptyProjectNotice } from "../shared/EmptyProjectNotice";

export function NotePanel({
  project,
  title = "项目笔记",
  description = "点击后直接进入 markdown 编辑器，正文首行默认作为标题。",
  emptyText = "当前项目还没有笔记，先创建一条上下文记录。",
  notes,
  selectedNote,
  loading,
  error,
  draft,
  saving,
  creatingTodo,
  deletingNoteId,
  settingsOpen,
  showCreateTodo = true,
  searchQuery = "",
  filterTags = [],
  availableTags = [],
  showSearch = true,
  total = 0,
  page = 1,
  pageSize = 12,
  onPageChange,
  onCreate,
  onSelect,
  onDraftChange,
  onSave,
  onDelete,
  onCreateTodo,
  onOpenSettings,
  onCloseSettings,
  onSearchChange,
  onFilterTagsChange,
  onCreateProject
}: {
  project: ProjectSummary | null;
  title?: string;
  description?: string;
  emptyText?: string;
  notes: NoteSummary[];
  selectedNote: NoteSummary | null;
  loading: boolean;
  error: string | null;
  draft: NoteDraft;
  saving: boolean;
  creatingTodo: boolean;
  deletingNoteId: string | null;
  settingsOpen: boolean;
  showCreateTodo?: boolean;
  searchQuery?: string;
  filterTags?: string[];
  availableTags?: string[];
  showSearch?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onCreate: () => void;
  onSelect: (note: NoteSummary) => void;
  onDraftChange: (field: keyof NoteDraft, value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (note: NoteSummary) => void;
  onCreateTodo: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onSearchChange?: (query: string) => void;
  onFilterTagsChange?: (tags: string[]) => void;
  onCreateProject?: () => void;
}) {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const isEditing = selectedNote !== null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!project && showCreateTodo) {
    return <EmptyProjectNotice onCreateProject={onCreateProject ?? (() => undefined)} />;
  }

  const openCreateModal = () => {
    onCreate();
    setFormModalOpen(true);
  };

  const openEditModal = (note: NoteSummary) => {
    onDraftChange("title", note.title);
    onDraftChange("content", note.content);
    onDraftChange("tags", note.tags.join(", "));
    onSelect(note);
    setFormModalOpen(true);
  };

  return (
    <>
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="app-text-faint mt-1 text-xs">{description}</div>
          </div>
          <button onClick={openCreateModal} className="app-button-primary rounded-md px-3 py-1.5 text-xs font-medium">
            新建笔记
          </button>
        </div>

        {showSearch ? (
          <div className="app-border border-b px-4 py-2 space-y-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 app-text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="搜索笔记标题、内容、标签..."
                className="app-input-shell w-full rounded-md border pl-8 pr-3 py-1.5 text-xs outline-none"
              />
            </div>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const next = filterTags.includes(tag)
                        ? filterTags.filter((t) => t !== tag)
                        : [...filterTags, tag];
                      onFilterTagsChange?.(next);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                      filterTags.includes(tag)
                        ? "app-pill-info"
                        : "app-button-secondary border app-text-faint"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[11px] app-text-faint">
              {notes.length} 条结果
              {(searchQuery || filterTags.length > 0) ? "（已筛选）" : ""}
            </div>
          </div>
        ) : null}

        <div className="min-h-[200px] grid grid-cols-3 gap-3 p-3 items-start">
          {loading ? <div className="col-span-3 px-4 py-6 text-sm app-text-muted">{title}加载中...</div> : null}
          {!loading && notes.length === 0 ? <div className="col-span-3 px-4 py-8 text-sm app-text-faint">{emptyText}</div> : null}
          {!loading
            ? notes.map((note) => (
                <div
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditModal(note)}
                  onKeyDown={(e) => { if (e.key === "Enter") openEditModal(note); }}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors cursor-pointer ${selectedNote?.id === note.id ? "app-card-selected" : "app-panel-strong app-border app-hover-border app-hover-accent"}`}
                >
                  <div className="app-text truncate font-medium">{note.title}</div>
                  <div className="mt-1 truncate text-xs app-text-faint">{note.content || "暂无正文"}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {note.tags.length > 0 ? note.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!onFilterTagsChange) return;
                          const next = filterTags.includes(tag)
                            ? filterTags.filter((t) => t !== tag)
                            : [...filterTags, tag];
                          onFilterTagsChange(next);
                        }}
                        className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                          filterTags.includes(tag)
                            ? "app-pill-info"
                            : "app-button-secondary app-text-soft"
                        }`}
                      >
                        {tag}
                      </button>
                    )) : <span className="text-[11px] app-text-fainter">无标签</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] app-text-faint">{formatDateTime(note.updatedAt)}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEditModal(note); }}
                      className="app-button-secondary rounded border px-2 py-0.5 text-xs"
                    >
                      编辑
                    </button>
                  </div>
                </div>
              ))
            : null}
        </div>
        <div className="app-border app-text-faint flex items-center justify-between border-t px-4 py-2.5 text-xs">
          <span>共 {total} 条，第 {page} / {totalPages} 页</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="app-button-secondary rounded border px-2 py-1 text-xs disabled:opacity-30"
            >
              上一页
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className="app-button-secondary rounded border px-2 py-1 text-xs disabled:opacity-30"
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      {formModalOpen ? (
        <Modal
          title={isEditing ? "编辑笔记" : "新建笔记"}
          description="支持 Markdown，正文首行默认作为标题，自动保存已开启。"
          onClose={() => setFormModalOpen(false)}
        >
          <form onSubmit={(e) => { e.preventDefault(); onSave(e); }} className="space-y-4">
            <Field label="标题">
              <input
                value={draft.title}
                onChange={(event) => onDraftChange("title", event.target.value)}
                className="app-input-shell w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="默认取正文第一行，也可以手动修改"
              />
            </Field>
            <Field label="Markdown 正文">
              <textarea
                value={draft.content}
                onChange={(event) => onDraftChange("content", event.target.value)}
                className="app-input-shell min-h-[380px] w-full rounded-lg border px-3 py-3 font-mono text-sm leading-6 outline-none"
                placeholder="# 会话入口梳理&#10;&#10;直接开始写，系统会自动保存。"
              />
            </Field>
            <Field label="标签">
              <input
                value={draft.tags}
                onChange={(event) => onDraftChange("tags", event.target.value)}
                className="app-input-shell w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="逗号分隔，例如：ui, session"
              />
            </Field>
            <div className="app-text-faint flex items-center gap-3 text-xs">
              <span>{saving ? "自动保存中..." : "已开启自动保存"}</span>
            </div>
            {error ? <p className="app-danger-soft rounded-lg border p-3 text-xs">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {showCreateTodo && isEditing && selectedNote ? (
                  <button
                    type="button"
                    disabled={creatingTodo}
                    onClick={onCreateTodo}
                    className="app-button-success rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {creatingTodo ? "创建中..." : "创建任务"}
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2">
                {isEditing && selectedNote ? (
                  <button
                    type="button"
                    disabled={deletingNoteId === selectedNote.id}
                    onClick={() => onDelete(selectedNote)}
                    className="app-button-danger rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {deletingNoteId === selectedNote.id ? "删除中..." : "删除笔记"}
                  </button>
                ) : null}
                <button type="button" onClick={() => setFormModalOpen(false)} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
                  关闭
                </button>
                <button type="submit" disabled={saving} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50">
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
