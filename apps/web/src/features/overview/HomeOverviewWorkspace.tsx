import React, { useEffect, useState, type FormEvent } from "react";
import type {
  ChatSkill,
  ChatSessionSummary,
  ExecutionListItem,
  MetaResponse,
  NoteSummary,
  ProjectSkillSummary,
  ProjectSummary,
  SkillSummary,
  StoreSkillStatus
} from "@workhorse-station/shared";
import type { NoteDraft, WorkbenchTab } from "../../lib/types";
import { formatDateTime, formatError } from "../../lib/format-utils";
import { NotePanel } from "../notes/NotePanel";
import { getGlobalClaudeMd, updateGlobalClaudeMd } from "../../api";

const workbenchTabs: Array<{ id: WorkbenchTab; label: string }> = [
  { id: "notes", label: "笔记" },
  { id: "skills", label: "Skill" },
  { id: "skill-store", label: "技能仓库" },
  { id: "projects", label: "项目" },
  { id: "chats", label: "聊天" },
  { id: "sessions", label: "会话" },
  { id: "memory", label: "记忆" }
];

export function HomeOverviewWorkspace({
  apiConnected,
  apiError,
  databaseInfo,
  selectedProject,
  globalNotes,
  selectedGlobalNote,
  globalNotesLoading,
  globalNotesError,
  globalNoteDraft,
  savingGlobalNote,
  deletingGlobalNoteId,
  globalNoteSettingsOpen,
  globalSkills,
  loading,
  error,
  projectSkills,
  operationName,
  chatSessions,
  projects,
  recentProjects,
  runningSessions,
  onEnterProject,
  onCreateProject,
  onOpenWorkspaceTerminal,
  onOpenExecution,
  onSelectChat,
  onCreateNote,
  onSelectNote,
  onNoteDraftChange,
  onSaveNote,
  onDeleteNote,
  onOpenNoteSettings,
  onCloseNoteSettings,
  onCreateSkill,
  onRenameSkill,
  onDeleteSkill,
  onCopyToProject,
  onEditDocument,
  storeSkills = [],
  storeSkillsLoading = false,
  storeSkillsError = null,
  storeSkillOperationName = null,
  onCreateStoreSkill,
  onRenameStoreSkill,
  onDeleteStoreSkill,
  onInstallStoreSkill,
  onSendStoreSkillToProject,
  onEditStoreSkillDocument,
  chatSkillsData = [],
  chatSkillsLoadingData = false,
  chatSkillsErrorData = null,
  deletingChatSkillNameData = null,
  onDeleteChatSkillData,
  globalNoteSearchQuery = "",
  globalNoteFilterTags = [],
  availableGlobalNoteTags = [],
  onGlobalNoteSearchChange,
  onGlobalNoteFilterTagsChange,
  globalNotesTotal = 0,
  globalNotesPage = 1,
  onGlobalNotesPageChange,
  onRefreshGlobalSkills,
  onRefreshStoreSkills,
  onRefreshChatSkills
}: {
  apiConnected: boolean;
  apiError: string | null;
  databaseInfo: MetaResponse["database"] | null;
  selectedProject: ProjectSummary | null;
  globalNotes: NoteSummary[];
  selectedGlobalNote: NoteSummary | null;
  globalNotesLoading: boolean;
  globalNotesError: string | null;
  globalNoteDraft: NoteDraft;
  savingGlobalNote: boolean;
  deletingGlobalNoteId: string | null;
  globalNoteSettingsOpen: boolean;
  globalSkills: SkillSummary[];
  loading: boolean;
  error: string | null;
  projectSkills: ProjectSkillSummary[];
  operationName: string | null;
  chatSessions: ChatSessionSummary[];
  projects: ProjectSummary[];
  recentProjects: ProjectSummary[];
  runningSessions: ExecutionListItem[];
  onEnterProject: (projectId?: string) => void;
  onCreateProject: () => void;
  onOpenWorkspaceTerminal: () => void;
  onOpenExecution: (execution: ExecutionListItem) => void;
  onSelectChat: (session: ChatSessionSummary) => void;
  onCreateNote: () => void;
  onSelectNote: (note: NoteSummary) => void;
  onNoteDraftChange: (field: keyof NoteDraft, value: string) => void;
  onSaveNote: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteNote: (note: NoteSummary) => void;
  onOpenNoteSettings: () => void;
  onCloseNoteSettings: () => void;
  onCreateSkill: () => void;
  onRenameSkill: (skill: SkillSummary) => void;
  onDeleteSkill: (skill: SkillSummary) => void;
  onCopyToProject: (skill: SkillSummary) => void;
  onEditDocument: (skill: SkillSummary) => void;
  storeSkills?: StoreSkillStatus[];
  storeSkillsLoading?: boolean;
  storeSkillsError?: string | null;
  storeSkillOperationName?: string | null;
  onCreateStoreSkill?: (name: string, description: string) => void;
  onRenameStoreSkill?: (skill: StoreSkillStatus) => void;
  onDeleteStoreSkill?: (skill: StoreSkillStatus) => void;
  onInstallStoreSkill?: (skill: StoreSkillStatus, target: "claude-code" | "chat") => void;
  onSendStoreSkillToProject?: (skill: StoreSkillStatus) => void;
  onEditStoreSkillDocument: (skill: StoreSkillStatus) => void;
  chatSkillsData?: ChatSkill[];
  chatSkillsLoadingData?: boolean;
  chatSkillsErrorData?: string | null;
  deletingChatSkillNameData?: string | null;
  onDeleteChatSkillData?: (skill: ChatSkill) => void;
  globalNoteSearchQuery?: string;
  globalNoteFilterTags?: string[];
  availableGlobalNoteTags?: string[];
  onGlobalNoteSearchChange?: (query: string) => void;
  onGlobalNoteFilterTagsChange?: (tags: string[]) => void;
  globalNotesTotal?: number;
  globalNotesPage?: number;
  onGlobalNotesPageChange?: (page: number) => void;
  onRefreshGlobalSkills?: () => void;
  onRefreshStoreSkills?: () => void;
  onRefreshChatSkills?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("notes");

  const projectCount = projects.length;
  const runningCount = runningSessions.length;
  const chatCount = chatSessions.length;
  const noteCount = globalNotes.length;
  const skillCount = globalSkills.length;
  const storeSkillCount = storeSkills.length;

  return (
    <div className="space-y-4">
      <div className="app-panel app-border app-text-faint flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs">
        <span className="app-text-muted font-medium">系统状态</span>
        <span className={`inline-flex items-center gap-1 ${apiConnected ? "app-text-success" : "app-text-danger"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${apiConnected ? "app-dot-success" : "app-dot-danger"}`} />
          API
        </span>
        <span className="app-text-fainter">|</span>
        <span className={`inline-flex items-center gap-1 ${databaseInfo?.connected ? "app-text-success" : "app-text-faint"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${databaseInfo?.connected ? "app-dot-success" : "app-dot-neutral"}`} />
          DB
        </span>
        <span className="app-text-fainter">|</span>
        <span className={`inline-flex items-center gap-1 ${databaseInfo?.connected ? "app-text-success" : "app-text-faint"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${databaseInfo?.connected ? "app-dot-success" : "app-dot-neutral"}`} />
          {databaseInfo?.engine?.toUpperCase() ?? "DB"}
        </span>
        {apiError ? (
          <>
            <span className="app-text-fainter">|</span>
            <span className="app-text-danger">{apiError}</span>
          </>
        ) : null}
      </div>

      <nav className="app-input app-border flex rounded-lg border p-1">
        {workbenchTabs.map((tab) => {
          const count = tab.id === "projects" ? projectCount : tab.id === "sessions" ? runningCount : tab.id === "chats" ? chatCount : tab.id === "notes" ? noteCount : tab.id === "skill-store" ? storeSkillCount : skillCount;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${activeTab === tab.id ? "app-button-primary" : "app-text-faint app-hover-accent app-hover-text"}`}
            >
              {tab.label}
              <span className={`rounded px-1 text-[11px] ${activeTab === tab.id ? "app-accent-strong app-text-fainter" : "app-accent app-text-faint"}`}>{count}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "notes" ? (
        <NotePanel
          project={null}
          title="全局笔记"
          description="沉淀跨项目上下文、复盘和可复用想法。"
          emptyText="还没有全局笔记，先记录一条跨项目上下文。"
          notes={globalNotes}
          selectedNote={selectedGlobalNote}
          loading={globalNotesLoading}
          error={globalNotesError}
          draft={globalNoteDraft}
          saving={savingGlobalNote}
          creatingTodo={false}
          deletingNoteId={deletingGlobalNoteId}
          settingsOpen={globalNoteSettingsOpen}
          showCreateTodo={false}
          searchQuery={globalNoteSearchQuery}
          filterTags={globalNoteFilterTags}
          availableTags={availableGlobalNoteTags}
          total={globalNotesTotal}
          page={globalNotesPage}
          onPageChange={onGlobalNotesPageChange}
          onCreate={onCreateNote}
          onSelect={onSelectNote}
          onDraftChange={onNoteDraftChange}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
          onCreateTodo={() => undefined}
          onOpenSettings={onOpenNoteSettings}
          onCloseSettings={onCloseNoteSettings}
          onSearchChange={onGlobalNoteSearchChange}
          onFilterTagsChange={onGlobalNoteFilterTagsChange}
        />
      ) : activeTab === "skills" ? (
        <GlobalSkillPanel
          selectedProject={selectedProject}
          skills={globalSkills}
          projectSkills={projectSkills}
          loading={loading}
          error={error}
          operationName={operationName}
          onCreate={onCreateSkill}
          onRename={onRenameSkill}
          onDelete={onDeleteSkill}
          onCopyToProject={onCopyToProject}
          onEditDocument={onEditDocument}
          onRefresh={onRefreshGlobalSkills ?? (() => {})}
        />
      ) : activeTab === "skill-store" ? (
        <SkillStorePanel
          skills={storeSkills}
          loading={storeSkillsLoading}
          error={storeSkillsError}
          operationName={storeSkillOperationName}
          onCreate={onCreateStoreSkill ?? (() => {})}
          onRename={onRenameStoreSkill ?? (() => undefined)}
          onDelete={onDeleteStoreSkill ?? (() => undefined)}
          onInstall={onInstallStoreSkill ?? (() => undefined)}
          onSendToProject={onSendStoreSkillToProject ?? (() => undefined)}
          onEditDocument={onEditStoreSkillDocument ?? (() => undefined)}
          onRefreshStore={onRefreshStoreSkills ?? (() => {})}
          chatSkills={chatSkillsData}
          chatSkillsLoading={chatSkillsLoadingData}
          chatSkillsError={chatSkillsErrorData}
          deletingChatSkillName={deletingChatSkillNameData}
          onDeleteChatSkill={onDeleteChatSkillData ?? (() => undefined)}
          onRefreshChatSkills={onRefreshChatSkills ?? (() => {})}
        />
      ) : activeTab === "projects" ? (
        <section className="app-panel app-border rounded-xl border">
          <div className="app-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="app-text text-sm font-medium">项目管理</div>
              <p className="app-text-faint mt-0.5 text-xs">所有项目，点击进入项目工作台。</p>
            </div>
            <button onClick={onCreateProject} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
              新建项目
            </button>
          </div>
          <div className="p-4">
            {projects.length === 0 ? (
              <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有项目，先创建一个吧。</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {projects.map((project) => (
                  <div key={project.id} className="app-card app-border app-card-hover rounded-lg border p-3 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="app-text truncate font-medium">{project.name}</div>
                        <div className="app-text-faint mt-0.5 truncate text-xs">{project.path}</div>
                      </div>
                      <button onClick={() => onEnterProject(project.id)} className="app-button-secondary shrink-0 rounded border px-2 py-0.5 text-xs">
                        进入
                      </button>
                    </div>
                    {project.latestSessionResult ? (
                      <div className="app-card app-text-faint mt-2 truncate rounded px-2 py-1 text-xs">
                        {project.latestSessionResult.sessionName}: {project.latestSessionResult.summary.slice(0, 80)}{project.latestSessionResult.summary.length > 80 ? "..." : ""}
                      </div>
                    ) : null}
                    <div className="app-text-faint mt-2 text-xs">更新于 {formatDateTime(project.updatedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : activeTab === "chats" ? (
        <section className="app-panel app-border rounded-xl border">
          <div className="app-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="app-text text-sm font-medium">聊天会话</div>
              <p className="app-text-faint mt-0.5 text-xs">AI 聊天会话，点击进入聊天。</p>
            </div>
          </div>
          <div className="p-4">
            {chatSessions.length === 0 ? (
              <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">还没有聊天会话，切换到聊天页面开始吧。</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {chatSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => onSelectChat(session)}
                    className="app-card app-border app-card-hover rounded-lg border p-3 text-left transition-colors"
                  >
                    <div className="app-text truncate font-medium">{session.title}</div>
                    <div className="app-text-faint mt-1 text-xs">{formatDateTime(session.updatedAt)}</div>
                    {session.messages.length > 0 ? (
                      <div className="app-text-muted mt-1.5 truncate text-xs">{session.messages[session.messages.length - 1].content.slice(0, 100)}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : activeTab === "memory" ? (
        <GlobalMemoryPanel selectedProject={selectedProject} />
      ) : (
        <section className="app-panel app-border rounded-xl border">
          <div className="app-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="app-text text-sm font-medium">运行中执行项</div>
              <p className="app-text-faint mt-0.5 text-xs">当前正在运行的 Claude Code 会话与普通终端。</p>
            </div>
            <button onClick={onOpenWorkspaceTerminal} className="app-button-secondary rounded-lg border px-3 py-2 text-sm">
              打开终端
            </button>
          </div>
          <div className="p-4">
            {runningSessions.length === 0 ? (
              <div className="app-border app-text-faint rounded-lg border border-dashed p-8 text-center">没有运行中的执行项</div>
            ) : (
              <div className="space-y-2">
                {runningSessions.map((session) => (
                  <div key={`${session.kind}:${session.id}`} className="app-card app-border flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="app-dot-success inline-block h-2 w-2 rounded-full" />
                        <span className="app-text truncate font-medium">{session.name}</span>
                        <span className="app-pill-success shrink-0 rounded px-1.5 py-0.5 text-xs">{session.runtimeStatus ?? session.status}</span>
                      </div>
                      <div className="app-text-faint mt-0.5 flex items-center gap-2 text-xs">
                        <span>{session.projectName ?? "工作台根目录"}</span>
                        <span>·</span>
                        <span>{session.kind === "workspace-terminal" ? "终端" : "Claude 会话"}</span>
                        <span>·</span>
                        <span>{formatDateTime(session.updatedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenExecution(session)}
                      className="app-button-secondary ml-3 shrink-0 rounded border px-2 py-0.5 text-xs"
                    >
                      打开
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function GlobalSkillPanel({
  selectedProject,
  skills,
  projectSkills,
  loading,
  error,
  operationName,
  onCreate,
  onRename,
  onDelete,
  onCopyToProject,
  onEditDocument,
  onRefresh
}: {
  selectedProject: ProjectSummary | null;
  skills: SkillSummary[];
  projectSkills: ProjectSkillSummary[];
  loading: boolean;
  error: string | null;
  operationName: string | null;
  onCreate: () => void;
  onRename: (skill: SkillSummary) => void;
  onDelete: (skill: SkillSummary) => void;
  onCopyToProject: (skill: SkillSummary) => void;
  onEditDocument: (skill: SkillSummary) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="app-panel app-border rounded-xl border">
      <div className="app-border flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="app-text text-sm font-medium">全局 Skill 文件夹</div>
          <div className="app-text-faint mt-1 text-xs">来源：~/.claude/skills/*，支持直接编辑 SKILL.md。</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="app-border app-text-muted app-hover-accent app-hover-border app-hover-text rounded-lg border px-2.5 py-2 text-sm" title="刷新">
            ⟳
          </button>
          <button onClick={onCreate} className="app-button-primary rounded-lg px-3 py-2 text-sm font-medium">
            新建
          </button>
        </div>
      </div>
      <div className="p-4">
        {error ? <p className="app-danger-soft mb-3 rounded-lg border p-3 text-xs">{error}</p> : null}
        {loading ? <div className="app-border app-text-muted rounded-lg border p-3 text-xs">全局 Skill 加载中...</div> : null}
        {!loading && skills.length === 0 ? <div className="app-border app-text-faint rounded-lg border border-dashed p-4 text-xs">还没有全局 Skill 文件夹。</div> : null}
        {!loading && skills.length > 0 ? (
          <div className="space-y-2">
            {skills.map((skill) => {
              const projectState = projectSkills.find((item) => item.name === skill.name);
              const busy = operationName === skill.name;
              return (
                <div key={skill.name} className="app-card app-border rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="app-text font-medium">{skill.name}</span>
                        {projectState?.hasOverride ? <span className="app-pill-warning rounded-full border px-2 py-0.5 text-[11px]">被项目覆盖</span> : null}
                      </div>
                      <div className="app-text-faint mt-1 break-all text-xs">{skill.path}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <button disabled={busy} onClick={() => onEditDocument(skill)} className="app-border app-text-soft app-hover-accent app-hover-border app-hover-text rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                        编辑文档
                      </button>
                      <button disabled={busy} onClick={() => onCopyToProject(skill)} className="app-button-success rounded-md border px-2 py-1 text-xs disabled:opacity-50">
                        发送到项目
                      </button>
                      <button disabled={busy} onClick={() => onDelete(skill)} className="app-button-danger rounded-md border px-2 py-1 text-xs disabled:opacity-50">
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
    </section>
  );
}

function SkillStorePanel({
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
  onInstall: (skill: StoreSkillStatus, target: "claude-code" | "chat") => void;
  onSendToProject: (skill: StoreSkillStatus) => void;
  onEditDocument: (skill: StoreSkillStatus) => void;
  onRefreshStore: () => void;
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
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${item.installed.claudeCode ? "app-pill-success" : "app-card app-border app-text-fainter"}`}>
                          {item.installed.claudeCode ? "全局 CC" : "全局 CC"}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${item.installed.chat ? "app-pill-success" : "app-card app-border app-text-fainter"}`}>
                          {item.installed.chat ? "Chat" : "Chat"}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${item.installed.claudeCodeProject ? "app-pill-success" : "app-card app-border app-text-fainter"}`}>
                          {item.installed.claudeCodeProject ? "项目 CC" : "项目 CC"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <button disabled={busy || item.installed.claudeCode} onClick={() => onInstall(item, "claude-code")} className="app-border app-text-soft app-hover-accent app-hover-border app-hover-text rounded-md border px-2 py-1 text-xs disabled:opacity-50" title="安装到全局 Claude Code">
                        安装到 CC
                      </button>
                      <button disabled={busy || item.installed.chat} onClick={() => onInstall(item, "chat")} className="app-border app-text-soft app-hover-accent app-hover-border app-hover-text rounded-md border px-2 py-1 text-xs disabled:opacity-50" title="安装到 AI Chat">
                        安装到 Chat
                      </button>
                      <button disabled={busy} onClick={() => onSendToProject(item)} className="app-button-success rounded-md border px-2 py-1 text-xs disabled:opacity-50" title="发送到指定项目">
                        发送到项目
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

function GlobalMemoryPanel({ selectedProject, onRefresh }: { selectedProject: ProjectSummary | null; onRefresh?: () => void }) {
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
