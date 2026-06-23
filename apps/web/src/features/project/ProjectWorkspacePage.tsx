import React, { type FormEvent } from "react";
import type {
  ProjectSummary,
  WorktreeSummary,
  NoteSummary,
  TodoSummary,
  TodoStatus,
  SessionListItem,
  PromptDraftSummary,
  ProjectSkillSummary,
  SessionSource
} from "@workhorse-station/shared";
import type { NoteDraft, ProjectDraft, ProjectMode, ProjectTab, TodoDraft, WorktreeDraft } from "../../lib/types";
import { formatDateTime, formatError } from "../../lib/format-utils";
import { Field, DetailRow, DetailCard, CompactMetaPill } from "../../components/shared/DetailComponents";
import { StatusPill, WorktreeStatusPill, SessionStatusPill } from "../../components/shared/StatusPills";
import { NotePanel } from "../notes/NotePanel";
import { TodoPanel } from "../todos/TodoPanel";
import { GlobalSkillPanel } from "../skills/GlobalSkillPanel";
import { ProjectSkillPanel } from "../skills/ProjectSkillPanel";
import { ProjectMemoryPanel } from "../memory/ProjectMemoryPanel";
import { EmptyProjectNotice } from "../shared/EmptyProjectNotice";
import { Modal } from "../shared/Modal";
import { SessionsWorkspace as SessionsWorkspacePanel } from "../../session-ui";
import { WorktreePanel } from "../worktrees/WorktreePanel";

const projectTabs: Array<{ id: ProjectTab; label: string }> = [
  { id: "todos", label: "任务" },
  { id: "notes", label: "笔记" },
  { id: "skills", label: "Skill" },
  { id: "sessions", label: "会话" },
  { id: "worktrees", label: "Worktree" },
  { id: "memory", label: "记忆" }
];

export function ProjectWorkspacePage({
  activeTab,
  onTabChange,
  projects,
  selectedProject,
  selectedWorktree,
  worktrees,
  projectsLoading,
  worktreesLoading,
  deletingProject,
  deletingWorktreeId,
  projectError,
  worktreeError,
  notes,
  notesTotal = 0,
  notesPage = 1,
  selectedNote,
  notesLoading,
  notesError,
  noteDraft,
  savingNote,
  deletingNoteId,
  noteSettingsOpen,
  todos,
  todosTotal = 0,
  todosPage = 1,
  selectedTodo,
  todosLoading,
  todosError,
  todoDraft,
  savingTodo,
  deletingTodoId,
  sessions,
  promptDrafts,
  sessionsLoading,
  sessionsError,
  projectSkills,
  selectedProjectSkillName,
  projectSkillsLoading,
  projectSkillsError,
  skillOperationName,
  onCreateProject,
  onEditProject,
  onSelectProject,
  onDeleteProject,
  onCreateWorktree,
  onWorktreeSelect,
  onWorktreeDelete,
  onCreateNote,
  onSelectNote,
  onNoteDraftChange,
  onSaveNote,
  onDeleteNote,
  onOpenNoteSettings,
  onCloseNoteSettings,
  onCreateTodoFromNote,
  onCreateTodo,
  onSelectTodo,
  onTodoDraftChange,
  onSaveTodo,
  onDeleteTodo,
  onSelectProjectSkill,
  onCreateProjectSkill,
  onRenameProjectSkill,
  onDeleteProjectSkill,
  onCopyProjectSkillToGlobal,
  onAddProjectSkillToStore,
  onEditProjectSkillDocument,
  onOpenSession,
  onOpenWorkspaceTerminal,
  noteSearchQuery = "",
  noteFilterTags = [],
  availableNoteTags = [],
  onNoteSearchChange,
  onNoteFilterTagsChange,
  onNotesPageChange,
  onTodosPageChange,
  todoSearchQuery = "",
  todoFilterTags = [],
  todoStatuses = [],
  availableTodoTags = [],
  onTodoSearchChange,
  onTodoFilterTagsChange,
  onTodoStatusesChange,
  onTodoStatusChange,
  onRefreshWorktrees,
  onRefreshProjectSkills
}: {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  worktrees: WorktreeSummary[];
  projectsLoading: boolean;
  worktreesLoading: boolean;
  deletingProject: boolean;
  deletingWorktreeId: string | null;
  projectError: string | null;
  worktreeError: string | null;
  notes: NoteSummary[];
  notesTotal?: number;
  notesPage?: number;
  selectedNote: NoteSummary | null;
  notesLoading: boolean;
  notesError: string | null;
  noteDraft: NoteDraft;
  savingNote: boolean;
  deletingNoteId: string | null;
  noteSettingsOpen: boolean;
  todos: TodoSummary[];
  todosTotal?: number;
  todosPage?: number;
  selectedTodo: TodoSummary | null;
  todosLoading: boolean;
  todosError: string | null;
  todoDraft: TodoDraft;
  savingTodo: boolean;
  deletingTodoId: string | null;
  sessions: SessionListItem[];
  promptDrafts: PromptDraftSummary[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  projectSkills: ProjectSkillSummary[];
  selectedProjectSkillName: string | null;
  projectSkillsLoading: boolean;
  projectSkillsError: string | null;
  skillOperationName: string | null;
  onCreateProject: () => void;
  onEditProject: () => void;
  onSelectProject: (project: ProjectSummary) => void;
  onDeleteProject: () => void;
  onCreateWorktree: () => void;
  onWorktreeSelect: (worktree: WorktreeSummary) => void;
  onWorktreeDelete: (worktree: WorktreeSummary) => void;
  onCreateNote: () => void;
  onSelectNote: (note: NoteSummary) => void;
  onNoteDraftChange: (field: keyof NoteDraft, value: string) => void;
  onSaveNote: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteNote: (note: NoteSummary) => void;
  onOpenNoteSettings: () => void;
  onCloseNoteSettings: () => void;
  onCreateTodoFromNote: () => void;
  onCreateTodo: () => void;
  onSelectTodo: (todo: TodoSummary) => void;
  onTodoDraftChange: (field: keyof TodoDraft, value: string) => void;
  onSaveTodo: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteTodo: (todo: TodoSummary) => void;
  onSelectProjectSkill: (skill: ProjectSkillSummary) => void;
  onCreateProjectSkill: () => void;
  onRenameProjectSkill: (skill: ProjectSkillSummary) => void;
  onDeleteProjectSkill: (skill: ProjectSkillSummary) => void;
  onCopyProjectSkillToGlobal: (skill: ProjectSkillSummary) => void;
  onAddProjectSkillToStore: (skill: ProjectSkillSummary) => void;
  onEditProjectSkillDocument: (skill: ProjectSkillSummary) => void;
  onOpenSession: (source: SessionSource, todoId?: string, sessionId?: string) => void;
  onOpenWorkspaceTerminal: () => void;
  noteSearchQuery?: string;
  noteFilterTags?: string[];
  availableNoteTags?: string[];
  onNoteSearchChange?: (query: string) => void;
  onNoteFilterTagsChange?: (tags: string[]) => void;
  onNotesPageChange?: (page: number) => void;
  onTodosPageChange?: (page: number) => void;
  todoSearchQuery?: string;
  todoFilterTags?: string[];
  todoStatuses?: TodoStatus[];
  availableTodoTags?: string[];
  onTodoSearchChange?: (query: string) => void;
  onTodoFilterTagsChange?: (tags: string[]) => void;
  onTodoStatusesChange?: (statuses: TodoStatus[]) => void;
  onTodoStatusChange?: (todo: TodoSummary, newStatus: TodoStatus) => void;
  onRefreshWorktrees?: () => void;
  onRefreshProjectSkills?: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="app-panel app-border rounded-2xl border p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div className="app-text-faint text-xs">项目工作台</div>
              <h1 className="mt-2 text-2xl font-semibold">{selectedProject?.name ?? "选择或创建项目"}</h1>
              <p className="app-text-muted mt-2 max-w-2xl text-sm">
                项目内承载任务、笔记、Skill、会话和 Worktree。会话终端通过模态框打开，关闭后继续后台运行。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!selectedProject}
                onClick={onOpenWorkspaceTerminal}
                className="app-button-secondary rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                打开终端
              </button>
              <button
                disabled={!selectedProject}
                onClick={() => onOpenSession("direct")}
                className="app-button-success rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                创建会话
              </button>
            </div>
          </div>
          {selectedProject ? (
            <div className="app-card app-border app-text-muted rounded-xl border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <CompactMetaPill label="目录" value={selectedProject.path} wide />
                <CompactMetaPill label="分支" value={selectedProject.defaultBranch} />
                <CompactMetaPill label="Worktree" value={selectedWorktree?.name ?? "未选择"} />
                <CompactMetaPill label="更新时间" value={formatDateTime(selectedProject.updatedAt)} />
                <button onClick={onEditProject} className="app-button-secondary shrink-0 rounded-md border px-3 py-1.5 text-xs">
                  编辑
                </button>
              </div>
              {selectedProject.description ? <p className="app-text-muted mt-3 line-clamp-2 text-xs">{selectedProject.description}</p> : null}
            </div>
          ) : null}
        </div>
        <ProjectTopNav activeTab={activeTab} onTabChange={onTabChange} />
      </section>

      {activeTab === "worktrees" ? (
        selectedProject ? (
          <WorktreePanel
            project={selectedProject}
            worktrees={worktrees}
            selectedWorktree={selectedWorktree}
            loading={worktreesLoading}
            deletingWorktreeId={deletingWorktreeId}
            error={worktreeError}
            onCreate={onCreateWorktree}
            onSelect={onWorktreeSelect}
            onDelete={onWorktreeDelete}
            onRefresh={onRefreshWorktrees ?? (() => {})}
          />
        ) : (
          <EmptyProjectNotice onCreateProject={onCreateProject} />
        )
      ) : null}

      {activeTab === "sessions" ? (
        <SessionsWorkspacePanel
          selectedProject={selectedProject}
          selectedWorktree={selectedWorktree}
          sessions={sessions}
          promptDrafts={promptDrafts}
          todos={todos}
          loading={sessionsLoading}
          error={sessionsError}
          onOpenSession={onOpenSession}
        />
      ) : null}

      {activeTab === "todos" ? (
        <TodoPanel
          project={selectedProject}
          notes={notes}
          todos={todos}
          sessions={sessions}
          selectedTodo={selectedTodo}
          loading={todosLoading}
          error={todosError}
          draft={todoDraft}
          saving={savingTodo}
          deletingTodoId={deletingTodoId}
          total={todosTotal}
          page={todosPage}
          onPageChange={onTodosPageChange}
          onCreate={onCreateTodo}
          onSelect={onSelectTodo}
          onDraftChange={onTodoDraftChange}
          onSave={onSaveTodo}
          onDelete={onDeleteTodo}
          onOpenSession={onOpenSession}
          searchQuery={todoSearchQuery}
          filterTags={todoFilterTags}
          statuses={todoStatuses}
          availableTags={availableTodoTags}
          onSearchChange={onTodoSearchChange}
          onFilterTagsChange={onTodoFilterTagsChange}
          onStatusesChange={onTodoStatusesChange}
          onStatusChange={onTodoStatusChange}
          onCreateProject={onCreateProject}
        />
      ) : null}

      {activeTab === "notes" ? (
        <NotePanel
          project={selectedProject}
          notes={notes}
          selectedNote={selectedNote}
          loading={notesLoading}
          error={notesError}
          draft={noteDraft}
          saving={savingNote}
          creatingTodo={savingTodo}
          deletingNoteId={deletingNoteId}
          settingsOpen={noteSettingsOpen}
          searchQuery={noteSearchQuery}
          filterTags={noteFilterTags}
          availableTags={availableNoteTags}
          total={notesTotal}
          page={notesPage}
          onPageChange={onNotesPageChange}
          onCreate={onCreateNote}
          onSelect={onSelectNote}
          onDraftChange={onNoteDraftChange}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
          onCreateTodo={onCreateTodoFromNote}
          onOpenSettings={onOpenNoteSettings}
          onCloseSettings={onCloseNoteSettings}
          onSearchChange={onNoteSearchChange}
          onFilterTagsChange={onNoteFilterTagsChange}
          onCreateProject={onCreateProject}
        />
      ) : null}

      {activeTab === "skills" ? (
        <ProjectSkillPanel
          project={selectedProject}
          skills={projectSkills}
          selectedSkillName={selectedProjectSkillName}
          loading={projectSkillsLoading}
          error={projectSkillsError}
          operationName={skillOperationName}
          onSelect={onSelectProjectSkill}
          onCreate={onCreateProjectSkill}
          onRename={onRenameProjectSkill}
          onDelete={onDeleteProjectSkill}
          onCopyToGlobal={onCopyProjectSkillToGlobal}
          onAddProjectSkillToStore={onAddProjectSkillToStore}
          onEditDocument={onEditProjectSkillDocument}
          onRefresh={onRefreshProjectSkills ?? (() => {})}
          onCreateProject={onCreateProject}
        />
      ) : null}

      {activeTab === "memory" ? (selectedProject ? <ProjectMemoryPanel projectId={selectedProject.id} /> : <EmptyProjectNotice onCreateProject={onCreateProject} />) : null}

      {!projectTabs.some((tab) => tab.id === activeTab) ? <EmptyProjectNotice onCreateProject={onCreateProject} /> : null}
    </div>
  );
}

export function ProjectTopNav({ activeTab, onTabChange }: { activeTab: ProjectTab; onTabChange: (tab: ProjectTab) => void }) {
  return (
    <nav className="app-border mt-5 flex gap-1 overflow-x-auto border-t pt-4">
      {projectTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${
            activeTab === tab.id ? "app-button-primary" : "app-text-faint app-hover-accent app-hover-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function ProjectFormModal({
  mode,
  draft,
  saving,
  error,
  onChange,
  onSubmit,
  onClose
}: {
  mode: ProjectMode;
  draft: ProjectDraft;
  saving: boolean;
  error: string | null;
  onChange: (field: keyof ProjectDraft, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const formId = "project-form-modal";

  return (
    <Modal
      title={mode === "create" ? "新建项目" : "编辑项目"}
      description="项目表单使用模态框承载，避免占用详情区域。"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
            取消
          </button>
          <button form={formId} disabled={saving} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60">
            {saving ? "保存中..." : mode === "create" ? "创建项目" : "保存修改"}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4">
        <Field label="名称">
          <input
            value={draft.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="app-input-shell w-full rounded-lg border px-3 py-2 outline-none"
            placeholder="workhorse-station"
          />
        </Field>
        <Field label="代码目录">
          <input
            value={draft.path}
            onChange={(event) => onChange("path", event.target.value)}
            className="app-input-shell w-full rounded-lg border px-3 py-2 outline-none"
            placeholder="/home/wengfb/projects/workhorse-station"
          />
        </Field>
        <Field label="默认分支">
          <input
            value={draft.defaultBranch}
            onChange={(event) => onChange("defaultBranch", event.target.value)}
            className="app-input-shell w-full rounded-lg border px-3 py-2 outline-none"
            placeholder="main"
          />
        </Field>
        <Field label="备注">
          <textarea
            value={draft.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="app-input-shell min-h-24 w-full resize-none rounded-lg border px-3 py-2 outline-none"
            placeholder="记录项目用途、约束或当前阶段"
          />
        </Field>
        {error ? <p className="app-danger-soft rounded-lg border p-3 text-xs">{error}</p> : null}
      </form>
    </Modal>
  );
}

export function WorktreeCreateModal({
  project,
  draft,
  saving,
  error,
  onChange,
  onSubmit,
  onClose
}: {
  project: ProjectSummary;
  draft: WorktreeDraft;
  saving: boolean;
  error: string | null;
  onChange: (field: keyof WorktreeDraft, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const formId = "worktree-create-modal";

  return (
    <Modal
      title="创建 worktree"
      description={`${project.path}/.claude/worktree/`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
            取消
          </button>
          <button form={formId} disabled={saving} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60">
            {saving ? "创建中..." : "创建 worktree"}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="名称">
            <input
              value={draft.name}
              onChange={(event) => onChange("name", event.target.value)}
              className="app-input-shell w-full rounded-lg border px-3 py-2 outline-none"
              placeholder="phase-1-task"
            />
          </Field>
          <Field label="分支（可选）">
            <input
              value={draft.branch}
              onChange={(event) => onChange("branch", event.target.value)}
              className="app-input-shell w-full rounded-lg border px-3 py-2 outline-none"
              placeholder="workhorse/name"
            />
          </Field>
          <Field label="基准（可选）">
            <input
              value={draft.baseBranch}
              onChange={(event) => onChange("baseBranch", event.target.value)}
              className="app-input-shell w-full rounded-lg border px-3 py-2 outline-none"
              placeholder={project.defaultBranch}
            />
          </Field>
        </div>
        {error ? <p className="app-danger-soft rounded-lg border p-3 text-xs">{error}</p> : null}
      </form>
    </Modal>
  );
}
