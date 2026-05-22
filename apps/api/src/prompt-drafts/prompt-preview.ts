import type { CreatePromptDraftPreviewRequest, ProjectSummary, SessionSource, TodoSummary, WorktreeSummary } from "@workhorse-station/shared";

export type PromptPreviewContext = {
  project: ProjectSummary;
  todo: TodoSummary | null;
  worktree: WorktreeSummary | null;
  input: CreatePromptDraftPreviewRequest;
};

export function buildPromptPreview({ project, todo, worktree, input }: PromptPreviewContext) {
  const source = normalizeSource(input.source, todo);
  const requestedWorktreeName = normalizeRequestedWorktreeName(input.requestedWorktreeName);
  const title = normalizeTitle(input.title, todo, source);
  const targetWorktree = worktree?.name ?? requestedWorktreeName ?? "未指定";
  const branch = worktree?.branch ?? project.defaultBranch;
  const promptSections = [
    `你正在处理项目「${project.name}」中的开发任务。`,
    `仓库路径：${project.path}`,
    `默认分支：${project.defaultBranch}`,
    `目标 worktree：${targetWorktree}`,
    `建议分支上下文：${branch}`
  ];

  if (todo) {
    promptSections.push("", "## 待办背景", `标题：${todo.title}`);

    if (todo.description.trim()) {
      promptSections.push(`描述：${todo.description}`);
    }

    promptSections.push(`当前状态：${todo.status}`);

    if (todo.tags.length > 0) {
      promptSections.push(`标签：${todo.tags.join(", ")}`);
    }
  } else {
    promptSections.push("", "## 任务背景", "这是一个直接创建的 Claude Code 会话，请先根据项目上下文明确目标和改动范围。");
  }

  promptSections.push(
    "",
    "## 执行要求",
    "1. 先阅读相关代码和现有实现，再开始修改。",
    "2. 优先复用现有模式，不新增不必要抽象。",
    "3. 完成后说明改动点、验证结果和后续建议。"
  );

  return {
    title,
    prompt: promptSections.join("\n"),
    source,
    todoId: todo?.id ?? null,
    worktreeId: worktree?.id ?? null,
    requestedWorktreeName
  };
}

function normalizeSource(source: SessionSource | undefined, todo: TodoSummary | null): SessionSource {
  if (source === "direct" || source === "todo") {
    return source;
  }

  return todo ? "todo" : "direct";
}

function normalizeRequestedWorktreeName(value: string | null | undefined) {
  const name = value?.trim();
  return name ? name : null;
}

function normalizeTitle(value: string | null | undefined, todo: TodoSummary | null, source: SessionSource) {
  const title = value?.trim();

  if (title) {
    return title;
  }

  if (todo) {
    return `Prompt 草稿：${todo.title}`;
  }

  return source === "todo" ? "Prompt 草稿：未命名待办" : "Prompt 草稿：直接创建会话";
}
