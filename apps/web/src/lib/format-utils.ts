import type {
  ChatArtifactSuggestion,
  ChatAttachment,
  TodoSummary,
  TodoStatus,
} from "@workhorse-station/shared";
import type { ChatFileDraft } from "./types";

export const textFileExtensions = new Set([
  "txt", "md", "markdown", "json", "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "css", "html", "xml", "yml", "yaml", "sql", "java", "go", "py", "rb", "sh",
]);
export const maxChatFileSize = 200_000;

export function formatTodoStatus(status: TodoStatus) {
  const labels: Record<TodoStatus, string> = {
    draft: "草稿",
    pending: "待处理",
    in_progress: "进行中",
    completed: "已完成",
  };

  return labels[status];
}

export function readChatFile(file: File) {
  if (!isTextChatFile(file)) {
    throw new Error("仅支持文本文件");
  }

  if (file.size > maxChatFileSize) {
    throw new Error("文件不能超过 200KB");
  }

  return file.text().then((textContent) => ({
    name: file.name,
    mimeType: file.type || guessMimeType(file.name),
    size: file.size,
    textContent,
  }));
}

export function toChatAttachment(file: ChatFileDraft): ChatAttachment {
  return file;
}

export function isTextChatFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    textFileExtensions.has(extension) ||
    file.type.startsWith("text/") ||
    file.type === "application/json"
  );
}

export function guessMimeType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "json") return "application/json";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "ts" || extension === "tsx") return "text/typescript";
  if (
    extension === "js" ||
    extension === "jsx" ||
    extension === "mjs" ||
    extension === "cjs"
  )
    return "text/javascript";
  if (extension === "yml" || extension === "yaml") return "text/yaml";
  return "text/plain";
}

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSuggestionTargetLabel(
  type: ChatArtifactSuggestion["type"]
) {
  if (type === "note") {
    return "笔记";
  }

  if (type === "todo") {
    return "任务";
  }

  return "Prompt 草稿";
}

export function toolLabel(name: string) {
  switch (name) {
    case "search_notes":
      return "搜索笔记";
    case "create_note":
      return "创建笔记";
    case "list_todos":
      return "查看任务";
    case "create_todo":
      return "创建任务";
    case "create_prompt_draft":
      return "保存 Prompt";
    case "list_projects":
      return "查看项目";
    case "list_worktrees":
      return "查看 Worktree";
    case "list_prompt_drafts":
      return "查看 Prompt";
    case "Skill":
      return "加载技能";
    case "bash":
      return "执行命令";
    default:
      return name;
  }
}

export function formatToolSummary(
  name: string,
  input: Record<string, unknown>
) {
  if (name === "Skill") return String(input.skill ?? "").slice(0, 80);
  if (name === "bash") return String(input.command ?? "").slice(0, 80);
  const title = (input.title || input.query || "") as string;
  return title ? String(title).slice(0, 80) : name;
}

export function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function formatChatStreamError(rawMessage: string) {
  const raw = rawMessage || "流式响应出错";

  if (raw.startsWith("400 ")) {
    return {
      summary: raw,
      raw,
    };
  }

  return {
    summary: raw,
    raw,
  };
}

export function formatTodoTime(todo: TodoSummary) {
  const label = todo.status === "completed" ? "完成于" : "更新于";
  const value =
    todo.status === "completed"
      ? (todo.completedAt ?? todo.updatedAt)
      : todo.updatedAt;
  return `${label} ${formatDateTime(value)}`;
}

export function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
