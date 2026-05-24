import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Database } from "sql.js";
import { createProject, findProjectByPath, getProject, listProjects, updateProject } from "../projects/project-repository.js";
import { normalizeProjectPath, validateDefaultBranch } from "../projects/project-path.js";
import { createNote, listGlobalNotes, listNotes } from "../notes/note-repository.js";
import { createTodo, listTodos } from "../todos/todo-repository.js";
import { createPromptDraft, listPromptDrafts } from "../prompt-drafts/prompt-draft-repository.js";
import { listWorktrees } from "../worktrees/worktree-repository.js";
import { loadChatSkill, type SkillMetadata, getChatSkillsRoot } from "../skills/skill-loader.js";

type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string } }>;
  required?: string[];
};

export type ToolDef = {
  name: string;
  description: string;
  input_schema: JsonSchema;
  confirmation: "auto" | "confirm";
};

type ToolResult = {
  result: string;
  isError: boolean;
};

export function getChatToolDefs(skills?: SkillMetadata[]): ToolDef[] {
  const baseTools: ToolDef[] = [
    {
      name: "search_notes",
      description: "搜索笔记。可以跨项目搜索或限定项目。用于在创建新笔记前检查是否已有相关笔记，或查找参考资料。",
      confirmation: "auto",
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
      confirmation: "confirm",
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
      confirmation: "auto",
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
      confirmation: "confirm",
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
      confirmation: "confirm",
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
      confirmation: "auto",
      input_schema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "create_project",
      description: "注册一个新项目。需要提供项目名称和代码目录的绝对路径，代码目录必须是已存在的 Git 仓库。",
      confirmation: "confirm",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "项目名称" },
          path: { type: "string", description: "代码目录的绝对路径，必须是已存在的 Git 仓库" },
          defaultBranch: { type: "string", description: "默认分支，不填则从 Git 仓库自动读取" },
          description: { type: "string", description: "项目描述/备注" }
        },
        required: ["name", "path"]
      }
    },
    {
      name: "update_project",
      description: "修改项目信息。可修改名称、代码目录、默认分支和描述，至少需要提供一个要修改的字段。",
      confirmation: "confirm",
      input_schema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "项目 ID" },
          name: { type: "string", description: "新的项目名称" },
          path: { type: "string", description: "新的代码目录绝对路径" },
          defaultBranch: { type: "string", description: "新的默认分支" },
          description: { type: "string", description: "新的项目描述，传空字符串可清除描述" }
        },
        required: ["projectId"]
      }
    },
    {
      name: "list_worktrees",
      description: "列出指定项目下的所有 worktree。",
      confirmation: "auto",
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
      confirmation: "auto",
      input_schema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "项目 ID" }
        },
        required: ["projectId"]
      }
    }
  ];

  baseTools.push({
    name: "bash",
    description: "执行一个 bash 命令并返回输出。用于运行脚本、查看文件内容、检查系统状态等操作。命令执行超时 30 秒，使用当前项目目录作为工作目录。",
    confirmation: "auto",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "要执行的 bash 命令。例如：ls -la、cat file.txt、bash script.sh" },
        workdir: { type: "string", description: "可选，指定命令执行的工作目录。默认为当前项目目录。" }
      },
      required: ["command"]
    }
  });

  if (skills && skills.length > 0) {
    const skillListText = skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
    baseTools.push({
      name: "Skill",
      description: `调用一个可用技能来获取专业指导和流程说明。当用户的任务匹配某个技能的描述时，先调用此工具加载技能的完整指令，然后按照技能指令执行任务。\n\n可用技能列表：\n${skillListText}`,
      confirmation: "auto",
      input_schema: {
        type: "object",
        properties: {
          skill: {
            type: "string",
            description: `要调用的技能名称。可用技能：${skills.map((s) => s.name).join(", ")}`
          }
        },
        required: ["skill"]
      }
    });
  }

  return baseTools;
}

const toolDefMap = new Map(getChatToolDefs().map((t) => [t.name, t]));

export function getToolConfirmation(name: string): "auto" | "confirm" {
  if (name === "Skill" || name === "bash") return "auto";
  return toolDefMap.get(name)?.confirmation ?? "confirm";
}

export async function executeChatTool(db: Database, name: string, input: Record<string, unknown>): Promise<ToolResult> {
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

      case "create_project": {
        const name = String(input.name ?? "").trim();
        const rawPath = String(input.path ?? "").trim();

        if (!name) return { result: "项目名称不能为空", isError: true };
        if (name.length > 80) return { result: "项目名称不能超过 80 个字符", isError: true };
        if (!rawPath) return { result: "代码目录路径不能为空", isError: true };

        let normalized;
        try {
          normalized = await normalizeProjectPath(rawPath, input.defaultBranch);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { result: `路径验证失败: ${message}`, isError: true };
        }

        const existing = findProjectByPath(db, normalized.path);
        if (existing) {
          return { result: `该代码目录已绑定到项目"${existing.name}"`, isError: true };
        }

        const description = input.description ? String(input.description).trim() || null : null;
        if (description && description.length > 1000) {
          return { result: "项目描述不能超过 1000 个字符", isError: true };
        }

        const project = createProject(db, {
          name,
          path: normalized.path,
          defaultBranch: normalized.defaultBranch,
          description
        });

        return {
          result: `已创建项目：《${project.name}》（路径: ${project.path}，默认分支: ${project.defaultBranch}）`,
          isError: false
        };
      }

      case "update_project": {
        const projectId = String(input.projectId ?? "").trim();
        if (!projectId) return { result: "请提供项目 ID", isError: true };

        const current = getProject(db, projectId);
        if (!current) return { result: "项目不存在", isError: true };

        const hasName = input.name !== undefined && input.name !== null && input.name !== "";
        const hasPath = input.path !== undefined && input.path !== null && input.path !== "";
        const hasBranch = input.defaultBranch !== undefined && input.defaultBranch !== null && input.defaultBranch !== "";
        const hasDesc = Object.prototype.hasOwnProperty.call(input, "description");

        if (!hasName && !hasPath && !hasBranch && !hasDesc) {
          return { result: "至少需要提供一个要更新的字段（name/path/defaultBranch/description）", isError: true };
        }

        let name = current.name;
        if (hasName) {
          name = String(input.name).trim();
          if (!name) return { result: "项目名称不能为空", isError: true };
          if (name.length > 80) return { result: "项目名称不能超过 80 个字符", isError: true };
        }

        let projectPath = current.path;
        let defaultBranch = current.defaultBranch;

        if (hasPath) {
          const rawPath = String(input.path).trim();
          if (!rawPath) return { result: "代码目录路径不能为空", isError: true };

          try {
            const n = await normalizeProjectPath(rawPath, hasBranch ? input.defaultBranch : current.defaultBranch);
            projectPath = n.path;
            defaultBranch = n.defaultBranch;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { result: `路径验证失败: ${message}`, isError: true };
          }

          const existing = findProjectByPath(db, projectPath);
          if (existing && existing.id !== projectId) {
            return { result: `该代码目录已绑定到项目"${existing.name}"`, isError: true };
          }

          if (projectPath !== current.path && listWorktrees(db, projectId).length > 0) {
            return { result: "该项目已有 worktree，请先删除 worktree 后再修改代码目录", isError: true };
          }
        } else if (hasBranch) {
          try {
            defaultBranch = validateDefaultBranch(input.defaultBranch);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { result: `分支验证失败: ${message}`, isError: true };
          }
        }

        let description = current.description;
        if (hasDesc) {
          if (input.description === null || input.description === "") {
            description = null;
          } else {
            description = String(input.description).trim();
            if (description.length > 1000) {
              return { result: "项目描述不能超过 1000 个字符", isError: true };
            }
          }
        }

        const updated = updateProject(db, projectId, {
          name,
          path: projectPath,
          defaultBranch,
          description
        });

        if (!updated) return { result: "更新项目失败", isError: true };

        return { result: `已更新项目：《${updated.name}》`, isError: false };
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

      case "Skill": {
        const skillName = String(input.skill ?? "").trim();
        if (!skillName) return { result: "请指定要调用的技能名称", isError: true };

        const loaded = await loadChatSkill(skillName);
        if (!loaded) {
          return {
            result: `技能 "${skillName}" 不存在或无法加载。可用技能请查看 Skill 工具描述中的列表。`,
            isError: true
          };
        }

        const skillDir = `${getChatSkillsRoot()}/${skillName}`;
        const skillList = `技能目录：${skillDir}\n在后续的 bash 命令中，引用此技能脚本时，请用技能目录路径替换 ${"${CLAUDE_SKILL_DIR}"}。\n\n${loaded.body}`;

        return {
          result: `已加载技能 "${loaded.metadata.name}" 的完整指令：\n\n${skillList}`,
          isError: false
        };
      }

      case "bash": {
        const command = String(input.command ?? "").trim();
        if (!command) return { result: "请提供要执行的命令", isError: true };

        const workdir = typeof input.workdir === "string" ? input.workdir : process.cwd();
        const exec = promisify(execFile);

        try {
          const { stdout, stderr } = await exec("/bin/bash", ["-c", command], {
            cwd: workdir,
            timeout: 30000,
            maxBuffer: 1024 * 1024,
            env: { ...process.env }
          });

          const output = [stderr ? `stderr:\n${stderr}` : "", stdout ? `stdout:\n${stdout}` : ""]
            .filter(Boolean)
            .join("\n");

          return {
            result: output || "(无输出)",
            isError: false
          };
        } catch (err: unknown) {
          const error = err as NodeJS.ErrnoException & { killed?: boolean; stderr?: string };
          if (error.killed) return { result: "命令执行超时（30 秒）", isError: true };
          return {
            result: `命令执行失败: ${error.message}\n${(error as { stderr?: string }).stderr ?? ""}`,
            isError: true
          };
        }
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
