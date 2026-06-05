import React, { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  ChatArtifactSuggestion,
  ChatAttachment,
  ChatMessageSummary,
  ChatSessionSummary,
  ChatToolCall,
  ChatToolResult,
  ProjectSummary,
  WorktreeSummary
} from "@workhorse-station/shared";
import {
  formatDateTime,
  formatFileSize,
  formatSuggestionTargetLabel,
  toolLabel,
  formatToolSummary,
  formatError,
  formatChatStreamError,
  readChatFile,
  toChatAttachment
} from "../../lib/format-utils";
import type { ChatFileDraft, StreamingBlock, ChatStreamPendingMessage } from "../../lib/types";
import { MarkdownContent } from "../../markdown-content";
import { createClientId } from "../../lib/utils";

export function HomeChatWorkspace({
  selectedProject,
  selectedWorktree,
  chatSessions,
  selectedChat,
  draft,
  chatFile,
  loading,
  error,
  creating,
  sending,
  deletingChatId,
  streamingChatId,
  streamingBlocks,
  editingMessageId,
  onSelect,
  onCreate,
  onDraftChange,
  onFileChange,
  onSubmit,
  onDelete,
  onConfirmTool,
  onStartEditMessage,
  onCancelEditMessage,
  visibleMessages,
  isStreaming,
  scrollSignal,
  messagesLoading
}: {
  selectedProject: ProjectSummary | null;
  selectedWorktree: WorktreeSummary | null;
  chatSessions: ChatSessionSummary[];
  selectedChat: ChatSessionSummary | null;
  draft: string;
  chatFile: ChatFileDraft | null;
  loading: boolean;
  error: string | null;
  creating: boolean;
  sending: boolean;
  deletingChatId: string | null;
  streamingChatId: string | null;
  streamingBlocks: StreamingBlock[];
  editingMessageId: string | null;
  messagesLoading: boolean;
  onSelect: (session: ChatSessionSummary) => void;
  onCreate: () => void;
  onDraftChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (chat: ChatSessionSummary) => void;
  onConfirmTool: (toolCallId: string, approved: boolean) => void;
  onStartEditMessage: (messageId: string, content: string) => void;
  onCancelEditMessage: () => void;
  visibleMessages: ChatMessageSummary[];
  isStreaming: boolean;
  scrollSignal: number;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const autoScrollRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior });
  };

  useEffect(() => {
    if (autoScrollRef.current) {
      scrollToBottom();
    }
  }, [visibleMessages.length, streamingBlocks, isStreaming]);

  useEffect(() => {
    if (scrollSignal > 0) {
      autoScrollRef.current = true;
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [scrollSignal]);

  useEffect(() => {
    if (editingMessageId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingMessageId]);

  return (
    <section className="app-surface grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="app-header flex flex-col overflow-hidden p-3">
        <div className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="app-text text-sm font-medium">聊天会话</div>
              <div className="app-text-faint mt-1 text-xs">不同于 Claude Code 会话</div>
            </div>
            <button onClick={onCreate} className="app-button-secondary rounded-lg border px-2.5 py-1.5 text-xs">
              新建
            </button>
          </div>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto lg:space-y-1">
          {chatSessions.length === 0 ? <div className="app-border app-text-faint rounded-xl border border-dashed p-3 text-sm">还没有聊天会话</div> : null}
          {chatSessions.map((session) => (
            <div key={session.id} className={`group flex items-center rounded-xl p-3 text-sm ${selectedChat?.id === session.id ? "app-accent" : "app-hover-accent"}`}>
              <button
                onClick={() => onSelect(session)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="app-text truncate font-medium">{session.title}</div>
                <div className="app-text-faint mt-1 truncate text-xs">{formatDateTime(session.updatedAt)}</div>
              </button>
              <button
                type="button"
                disabled={deletingChatId === session.id}
                onClick={() => onDelete(session)}
                className="app-button-secondary ml-2 shrink-0 rounded-md border px-2 py-1 text-[11px] opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                {deletingChatId === session.id ? "删除中..." : "删除"}
              </button>
            </div>
          ))}
        </div>
      </aside>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
        <div className="app-text-faint mx-auto w-full max-w-[768px] px-4 py-3 text-xs">
          上下文：{selectedProject?.name ?? "未选择项目"} / {selectedWorktree?.name ?? "未选择 worktree"} · 可直接让我搜索笔记、创建任务或保存 Prompt
        </div>
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-auto"
          onScroll={(event) => {
            const container = event.currentTarget;
            const threshold = 150;
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            autoScrollRef.current = distanceFromBottom <= threshold;
          }}
        >
          <div className="mx-auto w-full max-w-[768px] space-y-4 p-4 sm:p-6">
            {loading ? <div className="app-card app-border app-text-faint rounded-xl border p-6 text-center text-sm">聊天会话加载中...</div> : null}
            {!loading && error ? <div className="app-banner-danger rounded-xl border p-4 text-sm">{error}</div> : null}
            {!loading && !selectedChat ? <div className="app-border app-text-faint rounded-xl border border-dashed p-6 text-center text-sm">新建或选择一个聊天会话。</div> : null}
            {!loading && selectedChat && messagesLoading ? <div className="app-card app-border app-text-faint rounded-xl border p-6 text-center text-sm">消息加载中...</div> : null}
            {visibleMessages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                draft={draft}
                editingMessageId={editingMessageId}
                textareaRef={textareaRef}
                expandedToolCalls={expandedToolCalls}
                setExpandedToolCalls={setExpandedToolCalls}
                streamingChatId={streamingChatId}
                onDraftChange={onDraftChange}
                onCancelEditMessage={onCancelEditMessage}
                onConfirmTool={onConfirmTool}
                onStartEditMessage={onStartEditMessage}
              />
            ))}
            {isStreaming ? (
              <div className="flex justify-start">
                <div className="app-text-soft w-full space-y-3 rounded-2xl px-4 py-3 text-sm">
                  {streamingBlocks.length === 0 ? <ChatStreamingPlaceholder /> : streamingBlocks.map((block, idx) => renderStreamingBlock(block, idx, expandedToolCalls, setExpandedToolCalls, onConfirmTool))}
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <div className="mx-auto w-full max-w-[768px]">
            {chatFile ? (
              <div className="app-card app-border app-text-muted mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                <span className="truncate">已选择文件：{chatFile.name}</span>
                <button type="button" onClick={() => onFileChange(null)} className="app-text-faint app-hover-text">
                  移除
                </button>
              </div>
            ) : null}
            <div className="app-input app-border flex items-end gap-2 rounded-2xl border p-2">
              <label className="app-button-secondary shrink-0 cursor-pointer rounded-xl border px-3 py-2 text-sm">
                选择文件
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                />
              </label>
              <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (!event.ctrlKey && !event.shiftKey) {
                      event.preventDefault();
                      const form = event.currentTarget.closest("form");
                      if (form) form.requestSubmit();
                    } else {
                      event.preventDefault();
                      const ta = event.currentTarget;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const newValue = draft.slice(0, start) + "\n" + draft.slice(end);
                      onDraftChange(newValue);
                      requestAnimationFrame(() => {
                        ta.selectionStart = ta.selectionEnd = start + 1;
                      });
                    }
                  }
                }}
                className="app-text app-placeholder-faint max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                placeholder="输入消息。我会在需要时帮你搜索、创建笔记、任务或 Prompt。"
              />
              <button disabled={creating || sending || !!streamingChatId} className="app-button-primary shrink-0 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50">
                {streamingChatId ? "接收中..." : sending ? "发送中..." : creating ? "创建中..." : "发送"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

export function ChatMessageBubble({
  message,
  draft,
  editingMessageId,
  textareaRef,
  expandedToolCalls,
  setExpandedToolCalls,
  streamingChatId,
  onDraftChange,
  onCancelEditMessage,
  onConfirmTool,
  onStartEditMessage
}: {
  message: ChatMessageSummary;
  draft: string;
  editingMessageId: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  expandedToolCalls: Set<string>;
  setExpandedToolCalls: React.Dispatch<React.SetStateAction<Set<string>>>;
  streamingChatId: string | null;
  onDraftChange: (value: string) => void;
  onCancelEditMessage: () => void;
  onConfirmTool: (toolCallId: string, approved: boolean) => void;
  onStartEditMessage: (messageId: string, content: string) => void;
}) {
  const isEditing = editingMessageId === message.id;

  return (
    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`space-y-3 rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "max-w-[82%] app-panel-strong app-border app-text border" : "w-full app-text-soft"} ${message.role === "user" && !streamingChatId && !isEditing ? "cursor-pointer" : ""}`}
        onDoubleClick={message.role === "user" && !streamingChatId ? () => onStartEditMessage(message.id, message.content) : undefined}
      >
        {editingMessageId === message.id ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  const form = event.currentTarget.closest("form");
                  if (form) form.requestSubmit();
                } else if (event.key === "Escape") {
                  onCancelEditMessage();
                }
              }}
              className="app-input-shell w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              rows={3}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onCancelEditMessage} className="app-button-secondary rounded-md border px-2.5 py-1 text-xs">
                取消
              </button>
              <span className="app-text-faint text-[11px]">Enter 发送 · Shift+Enter 换行 · Esc 取消</span>
            </div>
          </div>
        ) : message.content.startsWith("::chat-error::") ? (
          <ChatErrorBubble payload={message.content.slice("::chat-error::".length)} />
        ) : (
          <MarkdownContent content={message.content} />
        )}
        {message.attachments.length ? (
          <div className="app-border app-text-faint space-y-2 border-t pt-3 text-xs">
            {message.attachments.map((attachment) => (
              <div key={`${message.id}-${attachment.name}`} className="app-input app-border rounded-lg border px-3 py-2">
                <div className="app-text-soft truncate font-medium">{attachment.name}</div>
                <div className="app-text-faint mt-1 flex flex-wrap gap-2 text-[11px]">
                  <span>{attachment.mimeType}</span>
                  <span>{formatFileSize(attachment.size)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {message.toolCalls.length ? (
          <div className="app-border space-y-2 border-t pt-3">
            {message.toolCalls.map((tc) => renderToolCallBlock(tc, message.toolResults.find((tr) => tr.toolCallId === tc.id), expandedToolCalls, setExpandedToolCalls, onConfirmTool))}
          </div>
        ) : null}
        {message.role === "user" && message.toolResults.length ? (
          <div className="app-border space-y-1 border-t pt-3">
            {message.toolResults.map((tr) => (
              <div key={tr.toolCallId} className={`text-xs ${tr.isError ? "app-text-danger" : "app-text-success"}`}>
                {tr.isError ? "❌ " : "✅ "}{tr.result}
              </div>
            ))}
          </div>
        ) : null}
        {message.artifactSuggestions.length ? (
          <div className="app-border space-y-2 border-t pt-3">
            {message.artifactSuggestions.map((suggestion) => {
              const saved = suggestion.adoption?.status === "saved";

              return (
                <div key={suggestion.id} className="app-input app-border app-text-muted rounded-xl border p-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="app-text font-medium">{suggestion.title}</div>
                      <div className="app-text-faint mt-1">{suggestion.type === "note" ? "笔记草稿" : suggestion.type === "todo" ? "任务草稿" : "Prompt 草稿"}</div>
                    </div>
                    {saved ? <span className="app-pill-neutral app-text-success shrink-0 rounded-md border px-2 py-1 text-[11px]">已保存</span> : null}
                  </div>
                  {saved ? <div className="app-text-success mt-2 text-[11px]">已保存到 {formatSuggestionTargetLabel(suggestion.type)}</div> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChatErrorBubble({ payload }: { payload: string }) {
  let parsed: { summary?: string; raw?: string } | null = null;

  try {
    parsed = JSON.parse(payload) as { summary?: string; raw?: string };
  } catch {
    parsed = null;
  }

  const raw = parsed?.raw || payload || "流式响应出错";

  return (
    <div className="app-banner-danger flex items-start gap-2 rounded-2xl border px-4 py-3">
      <span className="app-text-danger mt-0.5" aria-hidden="true">!</span>
      <div className="min-w-0 whitespace-pre-wrap break-all text-xs leading-relaxed">{raw}</div>
    </div>
  );
}

export function renderStreamingBlock(
  block: StreamingBlock,
  idx: number,
  expandedToolCalls: Set<string>,
  setExpandedToolCalls: React.Dispatch<React.SetStateAction<Set<string>>>,
  onConfirmTool: (toolCallId: string, approved: boolean) => void
) {
  if (block.type === "text") {
    return <MarkdownContent key={`text-${idx}`} content={block.text} />;
  }

  return renderToolCallBlock(block.toolCall, block.result, expandedToolCalls, setExpandedToolCalls, onConfirmTool);
}

export function renderToolCallBlock(
  tc: ChatToolCall,
  result: ChatToolResult | undefined,
  expandedToolCalls: Set<string>,
  setExpandedToolCalls: React.Dispatch<React.SetStateAction<Set<string>>>,
  onConfirmTool: (toolCallId: string, approved: boolean) => void
) {
  const isExecuted = tc.status === "executed" || tc.status === "approved";
  const isExpanded = expandedToolCalls.has(tc.id);
  const isLong = result && result.result.length > 80;
  const showExpanded = result && (result.isError || !isLong || isExpanded);

  return (
    <div
      key={tc.id}
      className={`rounded-xl border p-3 text-xs ${
        tc.status === "pending_confirmation"
          ? "app-banner-warning"
          : tc.status === "rejected"
            ? "app-banner-danger"
            : "app-banner-success"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
            tc.status === "pending_confirmation"
              ? "app-button-warning"
              : tc.status === "rejected"
                ? "app-button-danger"
                : "app-button-success"
          }`}
        >
          {toolLabel(tc.name)}
        </span>
        <span className="app-text truncate font-medium">{formatToolSummary(tc.name, tc.input)}</span>
        {tc.status === "pending_confirmation" ? <span className="app-text-warning ml-auto shrink-0 text-[11px]">等待确认</span> : tc.status === "rejected" ? <span className="app-text-danger ml-auto shrink-0 text-[11px]">已拒绝</span> : null}
      </div>
      {tc.status === "pending_confirmation" ? (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => onConfirmTool(tc.id, true)} className="app-button-success rounded-md border px-2.5 py-1 text-[11px]">
            执行
          </button>
          <button type="button" onClick={() => onConfirmTool(tc.id, false)} className="app-button-danger rounded-md border px-2.5 py-1 text-[11px]">
            拒绝
          </button>
        </div>
      ) : null}
      {isExecuted && result ? (
        <div className={`mt-2 border-t pt-2 ${result.isError ? "app-danger-soft" : "app-success-soft"}`}>
          {showExpanded ? (
            <div className={result.isError ? "app-text-danger" : "app-text-faint"}>
              {result.isError ? "❌ " : "✅ "}{result.result}
              {isLong && !result.isError ? (
                <button onClick={() => {
                  setExpandedToolCalls((prev) => {
                    const next = new Set(prev);
                    next.delete(tc.id);
                    return next;
                  });
                }} className="app-text-success ml-1">收起</button>
              ) : null}
            </div>
          ) : (
            <div className="app-text-faint">
              {result.result.slice(0, 80)}...
              <button onClick={() => setExpandedToolCalls((prev) => new Set([...prev, tc.id]))} className="app-text-success ml-1">展开</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ChatStreamingPlaceholder() {
  return (
    <div className="app-text-faint space-y-2 animate-in fade-in">
      <div className="flex gap-1.5">
        <span className="app-dot-neutral h-2 w-2 rounded-full animate-pulse [animation-delay:0ms]" />
        <span className="app-dot-neutral h-2 w-2 rounded-full animate-pulse [animation-delay:150ms]" />
        <span className="app-dot-neutral h-2 w-2 rounded-full animate-pulse [animation-delay:300ms]" />
      </div>
      <div className="space-y-2">
        <div className="app-skeleton h-3 w-32 rounded-full animate-pulse" />
        <div className="app-skeleton h-3 w-56 rounded-full animate-pulse [animation-delay:150ms]" />
      </div>
    </div>
  );
}

export function buildVisibleChatMessages(session: ChatSessionSummary, pendingMessages: ChatStreamPendingMessage[]): ChatMessageSummary[] {
  const pendingSummaries = pendingMessages.map((message) => ({
    id: message.id,
    chatSessionId: message.chatSessionId,
    role: message.role,
    content: message.content,
    attachments: message.attachments,
    artifactSuggestions: [],
    toolCalls: [],
    toolResults: [],
    createdAt: message.createdAt
  } satisfies ChatMessageSummary));

  return [...session.messages, ...pendingSummaries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function upsertChatMessage(messages: ChatMessageSummary[], nextMessage: ChatMessageSummary) {
  const existingIndex = messages.findIndex((message) => message.id === nextMessage.id);
  if (existingIndex >= 0) {
    return messages.map((message, index) => index === existingIndex ? nextMessage : message);
  }

  return [...messages, nextMessage].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function deriveChatSessionTitle(currentTitle: string, content: string, attachments: ChatAttachment[]) {
  if (currentTitle !== "新聊天") {
    return currentTitle;
  }

  const candidate = content || attachments[0]?.name || "新聊天";
  return candidate.trim().slice(0, 40) || "新聊天";
}
