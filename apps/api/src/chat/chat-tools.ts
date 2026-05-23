import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { listProjects } from "../projects/project-repository.js";
import { createNote, listGlobalNotes, listNotes } from "../notes/note-repository.js";
import { createTodo, listTodos } from "../todos/todo-repository.js";
import { createPromptDraft, listPromptDrafts } from "../prompt-drafts/prompt-draft-repository.js";
import { listWorktrees } from "../worktrees/worktree-repository.js";

type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string } }>;
  required?: string[];
};

type ToolDef = {
  name: string;
  description: string;
  input_schema: JsonSchema;
};

type ToolResult = {
  result: string;
  isError: boolean;
};

export function getChatToolDefs(): ToolDef[] {
  return [
    {
      name: "search_notes",
      description: "搜索笔记。可以跨项目搜索或限定项目。用于在创建新笔记前检查是否已有相关笔记，或查找参考资料。",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词，会匹配标题和内容" },
          projectId: { type: "string", description: "可选，限定搜索某个项目。不传则搜索全局笔记" }
        },
        required: ["query"]
      }
    },
    {
      name: "create_note",
      description: "创建一条新笔记。支持全局笔记（不传 projectId）或项目笔记。",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "笔记标题" },
          content: { type: "string", description: "笔记正文内容，支持 Markdown" },
          tags: { type: "array", items: { type: "string" }, description: "标签列表，如 [\"frontend\", \"react\"]" },
          projectId: { type: "string", description: "可选，项目 ID。不传则创建全局笔记" }
        },
        required: ["title", "content"]
      }
    },
    {
      name: "list_todos",
      description: "列出指定项目的所有任务（待办事项），用于了解当前有哪些任务需要处理。",
      input_schema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "项目 ID" }
        },
        required: ["projectId"]
      }
    },
    {
      name: "create_todo",
      description: "在项目中创建一条新任务（待办事项）。",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "任务标题" },
          description: { type: "string", description: "任务描述，详细说明需要做什么" },
          status: { type: "string", enum: ["draft", "pending", "in_progress", "completed"], description: "任务状态：draft=草稿, pending=待开始, in_progress=进行中, completed=已完成" },
          tags: { type: "array", items: { type: "string" }, description: "标签列表" },
          projectId: { type: "string", description: "项目 ID" }
        },
        required: ["title", "description", "projectId"]
      }
    },
    {
      name: "create_prompt_draft",
      description: "创建一个 Prompt 草稿，用于后续启动 Claude Code 会话执行代码任务。当用户想要执行某个开发任务时使用。",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Prompt 草稿标题，简要描述任务" },
          prompt: { type: "string", description: "Prompt 内容，详细描述要执行的开发任务" },
          projectId: { type: "string", description: "项目 ID" }
        },
        required: ["title", "prompt", "projectId"]
      }
    },
    {
      name: "list_projects",
      description: "列出所有已注册的项目，了解有哪些项目可用。",
      input_schema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "list_worktrees",
      description: "列出指定项目下的所有 worktree。",
      input_schema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "项目 ID" }
        },
        required: ["projectId"]
      }
    },
    {
      name: "list_prompt_drafts",
      description: "列出指定项目的所有 Prompt 草稿。",
      input_schema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "项目 ID" }
        },
        required: ["projectId"]
      }
    }
  ];
}

export function executeChatTool(db: Database, name: string, input: Record<string, unknown>): ToolResult {
  try {
    switch (name) {
      case "search_notes": {
        const query = String(input.query ?? "").trim();
        if (!query) return { result: "请提供搜索关键词", isError: true };

        const projectId = input.projectId ? String(input.projectId) : null;
        const notes = projectId
          ? listNotes(db, projectId, { search: query })
          : listGlobalNotes(db, { search: query });

        if (!notes.length) {
          return { result: `未找到与"${query}"相关的笔记。`, isError: false };
        }

        const lines = notes.slice(0, 10).map((n) => {
          const scope = n.projectId ? "项目笔记" : "全局笔记";
          const snippet = n.content.slice(0, 120).replace(/\n/g, " ");
          const tags = n.tags.length ? ` [${n.tags.join(", ")}]` : "";
          return `- ${n.title} (${scope}${tags})\n  ${snippet}${n.content.length > 120 ? "..." : ""}`;
        });

        return {
          result: `找到 ${notes.length} 条笔记：\n${lines.join("\n")}`,
          isError: false
        };
      }

      case "create_note": {
        const title = String(input.title ?? "").trim();
        const content = String(input.content ?? "").trim();
        const tags = normalizeTags(input.tags);
        const projectId = input.projectId ? String(input.projectId) : null;

        if (!title) return { result: "笔记标题不能为空", isError: true };
        if (!content) return { result: "笔记内容不能为空", isError: true };
        if (title.length > 120) return { result: "笔记标题不能超过 120 个字符", isError: true };
        if (content.length > 20000) return { result: "笔记内容不能超过 20000 个字符", isError: true };

        const note = createNote(db, {
          projectId,
          title,
          content,
          tags,
          sourceChatSuggestion: null
        });

        const scope = projectId ? "项目" : "全局";
        return { result: `已创建${scope}笔记：《${note.title}》`, isError: false };
      }

      case "list_todos": {
        const projectId = String(input.projectId ?? "").trim();
        if (!projectId) return { result: "请提供项目 ID", isError: true };

        const todos = listTodos(db, projectId);

        if (!todos.length) {
          return { result: "该项目暂无任务。", isError: false };
        }

        const lines = todos.map((t) => {
          const statusLabel = { draft: "草稿", pending: "待开始", in_progress: "进行中", completed: "已完成" }[t.status];
          const tags = t.tags.length ? ` [${t.tags.join(", ")}]` : "";
          return `- [${statusLabel}] ${t.title}${tags}`;
        });

        return { result: `共 ${todos.length} 条任务：\n${lines.join("\n")}`, isError: false };
      }

      case "create_todo": {
        const title = String(input.title ?? "").trim();
        const description = String(input.description ?? "").trim();
        const status = normalizeTodoStatus(input.status);
        const tags = normalizeTags(input.tags);
        const projectId = String(input.projectId ?? "").trim();

        if (!title) return { result: "任务标题不能为空", isError: true };
        if (!description) return { result: "任务描述不能为空", isError: true };
        if (!projectId) return { result: "请提供项目 ID", isError: true };
        if (title.length > 120) return { result: "任务标题不能超过 120 个字符", isError: true };
        if (description.length > 20000) return { result: "任务描述不能超过 20000 个字符", isError: true };

        const todo = createTodo(db, {
          projectId,
          title,
          description,
          status,
          tags,
          sourceNoteId: null,
          sourceChatSuggestion: null
        });

        return { result: `已创建任务：《${todo.title}》（状态：${status === "draft" ? "草稿" : status === "pending" ? "待开始" : status === "in_progress" ? "进行中" : "已完成"}）`, isError: false };
      }

      case "create_prompt_draft": {
        const title = String(input.title ?? "").trim();
        const prompt = String(input.prompt ?? "").trim();
        const projectId = String(input.projectId ?? "").trim();

        if (!title) return { result: "Prompt 草稿标题不能为空", isError: true };
        if (!prompt) return { result: "Prompt 内容不能为空", isError: true };
        if (!projectId) return { result: "请提供项目 ID", isError: true };
        if (title.length > 120) return { result: "标题不能超过 120 个字符", isError: true };
        if (prompt.length > 40000) return { result: "Prompt 内容不能超过 40000 个字符", isError: true };

        const draft = createPromptDraft(db, {
          projectId,
          todoId: null,
          worktreeId: null,
          requestedWorktreeName: null,
          source: "direct",
          title,
          prompt,
          status: "draft",
          sourceChatSuggestion: null
        });

        return { result: `已创建 Prompt 草稿：《${draft.title}》`, isError: false };
      }

      case "list_projects": {
        const projects = listProjects(db);

        if (!projects.length) {
          return { result: "暂无已注册的项目。", isError: false };
        }

        const lines = projects.map((p) => `- ${p.name} (${p.path})`);
        return { result: `共 ${projects.length} 个项目：\n${lines.join("\n")}`, isError: false };
      }

      case "list_worktrees": {
        const projectId = String(input.projectId ?? "").trim();
        if (!projectId) return { result: "请提供项目 ID", isError: true };

        const worktrees = listWorktrees(db, projectId);

        if (!worktrees.length) {
          return { result: "该项目暂无 worktree。", isError: false };
        }

        const lines = worktrees.map((w: { name: string; branch: string; status: string }) => `- ${w.name} (分支: ${w.branch}, 状态: ${w.status})`);
        return { result: `共 ${worktrees.length} 个 worktree：\n${lines.join("\n")}`, isError: false };
      }

      case "list_prompt_drafts": {
        const projectId = String(input.projectId ?? "").trim();
        if (!projectId) return { result: "请提供项目 ID", isError: true };

        const drafts = listPromptDrafts(db, projectId);

        if (!drafts.length) {
          return { result: "该项目暂无 Prompt 草稿。", isError: false };
        }

        const lines = drafts.map((d) => {
          const statusLabel = { draft: "草稿", confirmed: "已确认", archived: "已归档" }[d.status];
          return `- [${statusLabel}] ${d.title}`;
        });

        return { result: `共 ${drafts.length} 个 Prompt 草稿：\n${lines.join("\n")}`, isError: false };
      }

      default:
        return { result: `未知工具: ${name}`, isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: `工具执行出错: ${message}`, isError: true };
  }
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter((v) => v.length > 0 && v.length <= 30);
}

function normalizeTodoStatus(value: unknown) {
  if (typeof value === "string" && ["draft", "pending", "in_progress", "completed"].includes(value)) {
    return value as "draft" | "pending" | "in_progress" | "completed";
  }
  return "draft";
}
