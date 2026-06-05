import React, { type FormEvent } from "react";
import type {
  ChatSkill,
  ChatMessageSummary,
  ChatSessionSummary,
  ExecutionListItem,
  MetaResponse,
  NoteSummary,
  ProjectSkillSummary,
  ProjectSummary,
  SkillSummary,
  StoreSkillStatus,
  WorktreeSummary
} from "@workhorse-station/shared";
import type {
  ChatFileDraft,
  HomeMode,
  NoteDraft,
  StreamingBlock
} from "../../lib/types";
import { DetailRow } from "../../components/shared/DetailComponents";
import { HomeChatWorkspace } from "../chat/HomeChatWorkspace";
import { HomeOverviewWorkspace } from "../overview/HomeOverviewWorkspace";

export function HomeWorkspace({
  activeMode,
  activeModeInfo,
  featureCards,
  selectedProject,
  selectedWorktree,
  apiConnected,
  apiError,
  databaseInfo,
  globalNotes,
  selectedGlobalNote,
  globalNotesLoading,
  globalNotesError,
  globalNoteDraft,
  savingGlobalNote,
  deletingGlobalNoteId,
  globalNoteSettingsOpen,
  globalSkills,
  globalSkillsLoading,
  globalSkillsError,
  projectSkills,
  skillOperationName,
  chatSessions,
  selectedChat,
  chatDraft,
  chatFile,
  chatLoading,
  chatError,
  creatingChat,
  sendingChat,
  deletingChatId,
  chatScrollSignal,
  visibleChatMessages,
  isStreamingSelectedChat,
  onChatSelect,
  onCreateChat,
  onChatDraftChange,
  onChatFileChange,
  onChatSubmit,
  onDeleteChat,
  onConfirmTool,
  editingMessageId,
  onStartEditMessage,
  onCancelEditMessage,
  streamingChatId,
  streamingBlocks,
  chatMessagesLoading,
  onCreateGlobalNote,
  onSelectGlobalNote,
  onGlobalNoteDraftChange,
  onSaveGlobalNote,
  onDeleteGlobalNote,
  onOpenGlobalNoteSettings,
  onCloseGlobalNoteSettings,
  onCreateGlobalSkill,
  onRenameGlobalSkill,
  onDeleteGlobalSkill,
  onCopyGlobalSkillToProject,
  onEditGlobalSkillDocument,
  storeSkills,
  storeSkillsLoading,
  storeSkillsError,
  storeSkillOperationName,
  onCreateStoreSkill,
  onRenameStoreSkill,
  onDeleteStoreSkill,
  onInstallStoreSkill,
  onSendStoreSkillToProject,
  onEditStoreSkillDocument,
  chatSkills,
  chatSkillsLoading,
  chatSkillsError,
  deletingChatSkillName,
  onDeleteChatSkill,
  onEnterProject,
  onCreateProject,
  onCreateSession,
  onOpenWorkspaceTerminal,
  onOpenExecution,
  projects,
  recentProjects,
  runningSessions,
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
  activeMode: HomeMode;
  activeModeInfo: { label: string; description: string };
  featureCards: Array<{ title: string; value: string; detail: string }>;
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  apiConnected: boolean;
  apiError: string | null;
  databaseInfo: MetaResponse["database"] | null;
  globalNotes: NoteSummary[];
  selectedGlobalNote: NoteSummary | null;
  globalNotesLoading: boolean;
  globalNotesError: string | null;
  globalNoteDraft: NoteDraft;
  savingGlobalNote: boolean;
  deletingGlobalNoteId: string | null;
  globalNoteSettingsOpen: boolean;
  globalSkills: SkillSummary[];
  globalSkillsLoading: boolean;
  globalSkillsError: string | null;
  projectSkills: ProjectSkillSummary[];
  skillOperationName: string | null;
  chatSessions: ChatSessionSummary[];
  selectedChat: ChatSessionSummary | null;
  chatDraft: string;
  chatFile: ChatFileDraft | null;
  chatLoading: boolean;
  chatError: string | null;
  creatingChat: boolean;
  sendingChat: boolean;
  deletingChatId: string | null;
  chatScrollSignal: number;
  visibleChatMessages: ChatMessageSummary[];
  isStreamingSelectedChat: boolean;
  onChatSelect: (session: ChatSessionSummary) => void;
  onCreateChat: () => void;
  onChatDraftChange: (value: string) => void;
  onChatFileChange: (file: File | null) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteChat: (chat: ChatSessionSummary) => void;
  onConfirmTool: (toolCallId: string, approved: boolean) => void;
  editingMessageId: string | null;
  onStartEditMessage: (messageId: string, content: string) => void;
  onCancelEditMessage: () => void;
  streamingChatId: string | null;
  streamingBlocks: StreamingBlock[];
  chatMessagesLoading: boolean;
  onCreateGlobalNote: () => void;
  onSelectGlobalNote: (note: NoteSummary) => void;
  onGlobalNoteDraftChange: (field: keyof NoteDraft, value: string) => void;
  onSaveGlobalNote: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteGlobalNote: (note: NoteSummary) => void;
  onOpenGlobalNoteSettings: () => void;
  onCloseGlobalNoteSettings: () => void;
  onCreateGlobalSkill: () => void;
  onRenameGlobalSkill: (skill: SkillSummary) => void;
  onDeleteGlobalSkill: (skill: SkillSummary) => void;
  onCopyGlobalSkillToProject: (skill: SkillSummary) => void;
  onEditGlobalSkillDocument: (skill: SkillSummary) => void;
  storeSkills: StoreSkillStatus[];
  storeSkillsLoading: boolean;
  storeSkillsError: string | null;
  storeSkillOperationName: string | null;
  onCreateStoreSkill: (name: string, description: string) => void;
  onRenameStoreSkill: (skill: StoreSkillStatus) => void;
  onDeleteStoreSkill: (skill: StoreSkillStatus) => void;
  onInstallStoreSkill: (skill: StoreSkillStatus, target: "claude-code" | "chat") => void;
  onSendStoreSkillToProject: (skill: StoreSkillStatus) => void;
  onEditStoreSkillDocument: (skill: StoreSkillStatus) => void;
  chatSkills: ChatSkill[];
  chatSkillsLoading: boolean;
  chatSkillsError: string | null;
  deletingChatSkillName: string | null;
  onDeleteChatSkill: (skill: ChatSkill) => void;
  projects: ProjectSummary[];
  recentProjects: ProjectSummary[];
  runningSessions: ExecutionListItem[];
  onEnterProject: (projectId?: string) => void;
  onCreateProject: () => void;
  onCreateSession: () => void;
  onOpenWorkspaceTerminal: () => void;
  onOpenExecution: (execution: ExecutionListItem) => void;
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
  return (
    <div className={activeMode === "chat" ? "flex h-full w-full flex-col" : "mx-auto flex w-full max-w-7xl flex-col gap-5"}>
      {activeMode === "chat" ? (
        <HomeChatWorkspace
          selectedProject={selectedProject}
          selectedWorktree={selectedWorktree}
          chatSessions={chatSessions}
          selectedChat={selectedChat}
          draft={chatDraft}
          chatFile={chatFile}
          loading={chatLoading && !streamingChatId}
          error={chatError}
          creating={creatingChat}
          sending={sendingChat}
          deletingChatId={deletingChatId}
          streamingChatId={streamingChatId}
          streamingBlocks={streamingBlocks}
          onSelect={onChatSelect}
          onCreate={onCreateChat}
          onDraftChange={onChatDraftChange}
          onFileChange={onChatFileChange}
          onSubmit={onChatSubmit}
          onDelete={onDeleteChat}
          onConfirmTool={onConfirmTool}
          editingMessageId={editingMessageId}
          onStartEditMessage={onStartEditMessage}
          onCancelEditMessage={onCancelEditMessage}
          visibleMessages={visibleChatMessages}
          isStreaming={isStreamingSelectedChat}
          scrollSignal={chatScrollSignal}
          messagesLoading={chatMessagesLoading}
        />
      ) : (
        <HomeOverviewWorkspace
          apiConnected={apiConnected}
          apiError={apiError}
          databaseInfo={databaseInfo}
          selectedProject={selectedProject}
          globalNotes={globalNotes}
          selectedGlobalNote={selectedGlobalNote}
          globalNotesLoading={globalNotesLoading}
          globalNotesError={globalNotesError}
          globalNoteDraft={globalNoteDraft}
          savingGlobalNote={savingGlobalNote}
          deletingGlobalNoteId={deletingGlobalNoteId}
          globalNoteSettingsOpen={globalNoteSettingsOpen}
          globalSkills={globalSkills}
          loading={globalSkillsLoading}
          error={globalSkillsError}
          projectSkills={projectSkills}
          operationName={skillOperationName}
          chatSessions={chatSessions}
          projects={projects}
          recentProjects={recentProjects}
          runningSessions={runningSessions}
          onEnterProject={onEnterProject}
          onCreateProject={onCreateProject}
          onOpenWorkspaceTerminal={onOpenWorkspaceTerminal}
          onOpenExecution={onOpenExecution}
          onSelectChat={onChatSelect}
          onCreateNote={onCreateGlobalNote}
          onSelectNote={onSelectGlobalNote}
          onNoteDraftChange={onGlobalNoteDraftChange}
          onSaveNote={onSaveGlobalNote}
          onDeleteNote={onDeleteGlobalNote}
          onOpenNoteSettings={onOpenGlobalNoteSettings}
          onCloseNoteSettings={onCloseGlobalNoteSettings}
          onCreateSkill={onCreateGlobalSkill}
          onRenameSkill={onRenameGlobalSkill}
          onDeleteSkill={onDeleteGlobalSkill}
          onCopyToProject={onCopyGlobalSkillToProject}
          onEditDocument={onEditGlobalSkillDocument}
          storeSkills={storeSkills}
          storeSkillsLoading={storeSkillsLoading}
          storeSkillsError={storeSkillsError}
          storeSkillOperationName={storeSkillOperationName}
          onCreateStoreSkill={onCreateStoreSkill}
          onRenameStoreSkill={onRenameStoreSkill}
          onDeleteStoreSkill={onDeleteStoreSkill}
          onInstallStoreSkill={onInstallStoreSkill}
          onSendStoreSkillToProject={onSendStoreSkillToProject}
          onEditStoreSkillDocument={onEditStoreSkillDocument}
          chatSkillsData={chatSkills}
          chatSkillsLoadingData={chatSkillsLoading}
          chatSkillsErrorData={chatSkillsError}
          deletingChatSkillNameData={deletingChatSkillName}
          onDeleteChatSkillData={onDeleteChatSkill}
          globalNoteSearchQuery={globalNoteSearchQuery}
          globalNoteFilterTags={globalNoteFilterTags}
          availableGlobalNoteTags={availableGlobalNoteTags}
          onGlobalNoteSearchChange={onGlobalNoteSearchChange}
          onGlobalNoteFilterTagsChange={onGlobalNoteFilterTagsChange}
          globalNotesTotal={globalNotesTotal}
          globalNotesPage={globalNotesPage}
          onGlobalNotesPageChange={onGlobalNotesPageChange}
          onRefreshGlobalSkills={onRefreshGlobalSkills}
          onRefreshStoreSkills={onRefreshStoreSkills}
          onRefreshChatSkills={onRefreshChatSkills}
        />
      )}
    </div>
  );
}

export function FeatureCardGrid({ cards }: { cards: Array<{ title: string; value: string; detail: string }> }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className="app-card app-border rounded-xl border p-4">
          <div className="app-text-faint text-xs">{card.title}</div>
          <div className="mt-2 text-2xl font-semibold">{card.value}</div>
          <div className="app-text-muted mt-2 text-xs">{card.detail}</div>
        </article>
      ))}
    </div>
  );
}

export function PlaceholderWorkspace({
  apiConnected,
  apiError,
  databaseInfo
}: {
  apiConnected: boolean;
  apiError: string | null;
  databaseInfo: MetaResponse["database"] | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
      <section className="app-panel app-border rounded-xl border">
        <div className="app-border border-b px-4 py-3 text-sm font-medium">MVP 闭环</div>
        <div className="app-border divide-y">
          {["首页聊天生成草稿", "进入项目选择 worktree", "从任务创建会话", "会话模态框后台运行"].map((item, index) => (
            <div key={item} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="app-text-soft">{item}</div>
                <div className="app-text-faint text-xs">新信息架构步骤 {index + 1}</div>
              </div>
              <span className="app-pill-neutral rounded-full border px-2 py-1 text-xs">规划中</span>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel app-border rounded-xl border">
        <div className="app-border border-b px-4 py-3 text-sm font-medium">系统状态</div>
        <div className="app-text-muted space-y-4 p-4 text-sm">
          <DetailRow label="当前阶段" value="Phase 2" />
          <DetailRow label="API 状态" value={apiConnected ? "已连接" : "未连接"} />
          <DetailRow label="数据库" value={databaseInfo?.connected ? `${databaseInfo.engine} 已连接` : "等待后端"} />
          <DetailRow label="实例" value={databaseInfo ? `${databaseInfo.host}/${databaseInfo.database}` : "未知"} />
          {apiError ? <p className="app-banner-danger rounded-lg border p-3 text-xs">{apiError}</p> : null}
        </div>
      </section>
    </div>
  );
}
