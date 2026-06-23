import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, MessageSquarePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { NoteSummary, ProjectSummary, SessionListItem, SessionSource, TodoStatus, TodoSummary } from "@workhorse-station/shared";
import type { TodoDraft } from "../../lib/types";
import { formatDateTime, formatTodoTime } from "../../lib/format-utils";
import { Field } from "../../components/shared/DetailComponents";
import { IconButton } from "../../components/shared/IconButton";
import { SessionStatusPill } from "../../components/shared/StatusPills";
import { Select } from "../../components/ui/Select";
import { Modal } from "../shared/Modal";
import { EmptyProjectNotice } from "../shared/EmptyProjectNotice";

const todoStatusOptions: Array<{ value: TodoStatus; label: string }> = [
  { value: "draft", label: "草稿" },
  { value: "pending", label: "待处理" },
  { value: "in_progress", label: "进行中" },
  { value: "completed", label: "已完成" }
];

export function TodoPanel({
  project,
  notes,
  todos,
  sessions,
  selectedTodo,
  loading,
  error,
  draft,
  saving,
  deletingTodoId,
  total = 0,
  page = 1,
  pageSize = 12,
  onPageChange,
  onCreate,
  onSelect,
  onDraftChange,
  onSave,
  onDelete,
  onOpenSession,
  searchQuery = "",
  filterTags = [],
  statuses = [],
  availableTags = [],
  onSearchChange,
  onFilterTagsChange,
  onStatusesChange,
  onStatusChange,
  onCreateProject
}: {
  project: ProjectSummary | null;
  notes: NoteSummary[];
  todos: TodoSummary[];
  sessions: SessionListItem[];
  selectedTodo: TodoSummary | null;
  loading: boolean;
  error: string | null;
  draft: TodoDraft;
  saving: boolean;
  deletingTodoId: string | null;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onCreate: () => void;
  onSelect: (todo: TodoSummary) => void;
  onDraftChange: (field: keyof TodoDraft, value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (todo: TodoSummary) => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
  searchQuery?: string;
  filterTags?: string[];
  statuses?: TodoStatus[];
  availableTags?: string[];
  onSearchChange?: (query: string) => void;
  onFilterTagsChange?: (tags: string[]) => void;
  onStatusesChange?: (statuses: TodoStatus[]) => void;
  onStatusChange?: (todo: TodoSummary, newStatus: TodoStatus) => void;
  onCreateProject?: () => void;
}) {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const prevSavingRef = useRef(saving);

  useEffect(() => {
    if (prevSavingRef.current && !saving && !error) {
      setFormModalOpen(false);
    }
    prevSavingRef.current = saving;
  }, [saving, error]);

  const noteOptions = notes.map((note) => ({ id: note.id, title: note.title }));
  const linkedNote = draft.sourceNoteId ? noteOptions.find((note) => note.id === draft.sourceNoteId) ?? null : null;
  const isEditing = selectedTodo !== null;
  const relatedSessionsByTodoId = useMemo(() => {
    const next = new Map<string, SessionListItem[]>();

    for (const session of sessions) {
      if (!session.todoId) {
        continue;
      }

      const current = next.get(session.todoId);
      if (current) {
        current.push(session);
      } else {
        next.set(session.todoId, [session]);
      }
    }

    return next;
  }, [sessions]);
  const relatedSessions = selectedTodo ? relatedSessionsByTodoId.get(selectedTodo.id) ?? [] : [];
  const latestRelatedSession = relatedSessions[0] ?? null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const todoFormId = "todo-form-modal";

  if (!project) {
    return <EmptyProjectNotice onCreateProject={onCreateProject ?? (() => undefined)} />;
  }

  const openCreateModal = () => {
    onCreate();
    setFormModalOpen(true);
  };

  const openEditModal = (todo: TodoSummary) => {
    onSelect(todo);
    setFormModalOpen(true);
  };

  const statusStyle = (status: TodoStatus) => {
    if (status === "completed") return "app-pill-success";
    if (status === "in_progress") return "app-pill-info";
    return "app-pill-neutral";
  };

  return (
    <>
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-medium">项目任务</div>
          </div>
          <button onClick={openCreateModal} className="app-button-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium">
            <Plus className="h-4 w-4" aria-hidden="true" />
            新建任务
          </button>
        </div>
        <div className="app-border border-b px-4 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0 app-text-faint" aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="flex-1 bg-transparent text-xs app-text-soft outline-none app-placeholder-faint"
              placeholder="搜索任务标题、描述或标签..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {todoStatusOptions.map((option) => {
              const active = statuses.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? statuses.filter((status) => status !== option.value)
                      : [...statuses, option.value];
                    onStatusesChange?.(next);
                  }}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    active ? "app-pill-info" : "app-button-secondary app-text-faint"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {availableTags.map((tag) => {
                const active = filterTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const next = active ? filterTags.filter((t) => t !== tag) : [...filterTags, tag];
                      onFilterTagsChange?.(next);
                    }}
                    className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                      active ? "app-pill-info" : "app-button-secondary app-text-faint"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
          <div className="text-[11px] app-text-faint">
            {todos.length} 条结果{(searchQuery || filterTags.length > 0 || statuses.length !== todoStatusOptions.length) ? "（已筛选）" : ""}
          </div>
        </div>
        <div className="min-h-[200px] grid grid-cols-3 gap-3 p-3 items-start">
          {loading ? <div className="col-span-3 px-4 py-6 text-sm app-text-muted">项目任务加载中...</div> : null}
          {!loading && todos.length === 0 ? <div className="col-span-3 px-4 py-8 text-sm app-text-faint">当前项目还没有任务，可以手动创建或从笔记生成。</div> : null}
          {!loading
            ? todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${selectedTodo?.id === todo.id ? "app-card-selected" : "app-panel-strong app-border app-hover-border app-hover-accent"}`}
                >
                  <div className="flex items-center justify-between">
                    <Select
                      value={todo.status}
                      onChange={(value) => {
                        onStatusChange?.(todo, value as TodoStatus);
                      }}
                      options={todoStatusOptions}
                      className="w-28"
                      size="sm"
                    />
                    <span className="text-[11px] app-text-faint">{formatTodoTime(todo)}</span>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditModal(todo)}
                    onKeyDown={(e) => { if (e.key === "Enter") openEditModal(todo); }}
                    className="mt-1.5 cursor-pointer"
                  >
                    <div className="app-text truncate font-medium">{todo.title}</div>
                    <div className="app-text-faint mt-0.5 truncate text-xs">{todo.description || "暂无描述"}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {todo.tags.length > 0 && todo.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const active = filterTags.includes(tag);
                          const next = active ? filterTags.filter((t) => t !== tag) : [...filterTags, tag];
                          onFilterTagsChange?.(next);
                        }}
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer ${
                          filterTags.includes(tag) ? "app-pill-info" : "app-button-secondary app-text-faint"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {todo.sourceNoteId && <span className="text-[10px] app-text-fainter">关联笔记</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1.5">
                    <IconButton
                      icon={MessageSquarePlus}
                      label="创建会话"
                      variant="success"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSession("todo", todo.id);
                      }}
                    />
                    <IconButton
                      icon={Pencil}
                      label="编辑"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(todo);
                      }}
                    />
                    <IconButton
                      icon={deletingTodoId === todo.id ? LoaderCircle : Trash2}
                      label={deletingTodoId === todo.id ? "删除中" : "删除"}
                      variant="danger"
                      size="xs"
                      disabled={deletingTodoId === todo.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(todo);
                      }}
                      className={deletingTodoId === todo.id ? "[&_svg]:animate-spin" : undefined}
                    />
                  </div>
                </div>
              ))
            : null}
        </div>
        <div className="app-border app-text-faint flex items-center justify-between border-t px-4 py-2.5 text-xs">
          <span>共 {total} 条，第 {page} / {totalPages} 页</span>
          <div className="flex gap-1">
            <IconButton
              icon={ChevronLeft}
              label="上一页"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              size="xs"
              className="disabled:opacity-30"
            />
            <IconButton
              icon={ChevronRight}
              label="下一页"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              size="xs"
              className="disabled:opacity-30"
            />
          </div>
        </div>
      </section>

      {formModalOpen ? (
        <Modal
          title={isEditing ? "编辑任务" : "新建任务"}
          onClose={() => setFormModalOpen(false)}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setFormModalOpen(false)} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
                  关闭
                </button>
                <button form={todoFormId} type="submit" disabled={saving} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50">
                  {saving ? "保存中..." : isEditing ? "保存修改" : "创建任务"}
                </button>
              </div>
            </div>
          }
        >
          <form id={todoFormId} onSubmit={(e) => { e.preventDefault(); onSave(e); }} className="space-y-4">
            <Field label="标题">
              <input
                value={draft.title}
                onChange={(event) => onDraftChange("title", event.target.value)}
                className="app-input-shell w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="例如：补完项目页 notes/todos 面板"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="状态">
                <Select
                  value={draft.status}
                  onChange={(value) => onDraftChange("status", value)}
                  options={todoStatusOptions}
                />
              </Field>
              <Field label="来源笔记">
                <Select
                  value={draft.sourceNoteId}
                  onChange={(value) => onDraftChange("sourceNoteId", value)}
                  options={[{ value: "", label: "不关联" }, ...noteOptions.map((n) => ({ value: n.id, label: n.title }))]}
                />
              </Field>
            </div>
            <Field label="标签">
              <input
                value={draft.tags}
                onChange={(event) => onDraftChange("tags", event.target.value)}
                className="app-input-shell w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="逗号分隔，例如：phase2, api"
              />
            </Field>
            {linkedNote ? <p className="app-card app-border app-text-muted rounded-lg border p-3 text-xs">当前关联笔记：{linkedNote.title}</p> : null}
            {selectedTodo ? (
              <div className="app-card app-border app-text-muted flex flex-wrap gap-3 rounded-lg border p-3 text-xs">
                <span>创建于：{formatDateTime(selectedTodo.createdAt)}</span>
                <span>{selectedTodo.status === "completed" ? "完成于" : "更新于"}：{formatDateTime((selectedTodo.status === "completed" ? selectedTodo.completedAt : selectedTodo.updatedAt) ?? selectedTodo.updatedAt)}</span>
              </div>
            ) : null}
            {selectedTodo ? (
              <div className="app-banner-success rounded-lg border p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="app-text font-medium">关联会话</div>
                    <div className="app-text-muted mt-1">{relatedSessions.length > 0 ? `共 ${relatedSessions.length} 个` : "当前没有关联会话"}</div>
                  </div>
                  {latestRelatedSession ? <SessionStatusPill status={latestRelatedSession.status} /> : null}
                </div>
                {latestRelatedSession ? (
                  <>
                    <div className="app-text mt-2">{latestRelatedSession.name}</div>
                    {latestRelatedSession.summary ? <div className="app-text-soft mt-1 whitespace-pre-wrap">{latestRelatedSession.summary}</div> : null}
                    <div className="app-text-muted mt-2 flex flex-wrap gap-3">
                      <span>状态：{latestRelatedSession.status}</span>
                      <span>退出码：{latestRelatedSession.exitCode ?? "无"}</span>
                      <span>更新：{formatDateTime(latestRelatedSession.updatedAt)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSession("todo", selectedTodo.id, latestRelatedSession.id)}
                        className="app-button-success rounded border px-2 py-1 text-xs"
                      >
                        打开最新会话
                      </button>
                      {relatedSessions.length > 1 ? (
                        <span className="app-text-muted self-center text-[11px]">其余会话可在会话页查看</span>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            <Field label="描述">
              <textarea
                value={draft.description}
                onChange={(event) => onDraftChange("description", event.target.value)}
                className="app-input-shell min-h-40 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="补充任务目标、验收点或限制。"
              />
            </Field>
            {error ? <p className="app-danger-soft rounded-lg border p-3 text-xs">{error}</p> : null}
          </form>
        </Modal>
      ) : null}
    </>
  );
}
