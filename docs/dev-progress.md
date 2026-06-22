# 开发进度

## 2026-06-18：Codex Provider 最小接入与方案落档

### 已完成
- 会话链路增加 `AgentProvider = "claude" | "codex"` 抽象，`sessions` 表新增 `provider`、`provider_thread_id`、`provider_metadata_json`。
- 后端新增 `codex-cli.ts` 与 Provider Registry，`SessionRuntimeManager` 已改为按 Provider 构建启动命令。
- 会话创建、执行列表、概览页、会话详情已支持展示 Provider。
- 前端创建会话表单新增“执行器”选择，支持 Claude / Codex。
- 修复创建会话请求漏传 `provider` 的问题，避免前端选择 Codex 后后端仍按 Claude 启动。
- 新增 Codex 历史日志解析与线程落盘匹配逻辑，支持从 `~/.codex/sessions/.../*.jsonl` 解析会话消息。
- 修复 Codex 续接保护：当真实线程 ID 尚未解析出来时，后端不再错误回退到 Workhorse 自己的 session id 继续会话。
- 新增方案文档 [docs/codex-support-plan.md](/home/wengfb/code/workhorse-station/docs/codex-support-plan.md:1)，并已根据 2026-06-18 官方手册修正 `.agents/skills`、`AGENTS.md`、`.codex/config.toml` 等路径说明。

### 验收记录
- `pnpm -r typecheck`：通过。

### 待验证
- `pnpm run dev`
- 浏览器中实际创建 Claude / Codex 会话各一次，确认执行器选择、终端输出、停止、继续、历史解析都符合预期。
- Skill Store / Memory / Rules 面板尚未做 Codex 原生目录适配，属于下一阶段工作。

## 2026-06-18：Codex 原生目录第二阶段适配

### 已完成
- Skill Store 安装目标从旧的 `claude-code` / `claude-code-project` 升级为：
  - `claude-global`
  - `claude-project`
  - `codex-global`
  - `codex-project`
  - `chat`
- 后端 `skill-store` 已支持 Codex 原生 skills 目录：
  - 全局：`$HOME/.agents/skills`
  - 项目：`<project>/.agents/skills`
- 新增 provider-aware 指令文件接口：
  - `GET/PUT /api/agent-docs/global?provider=claude|codex`
  - `GET/PUT /api/projects/:projectId/agent-docs?provider=claude|codex`
- 旧 `claude-md` 路由仍保留兼容，但内部已复用新的通用指令文件模型。
- Memory / Rules API 已增加 `provider` 维度。
  - Claude 继续映射到现有 `CLAUDE.md`、`.claude/rules`、`~/.claude/projects/.../memory`
  - Codex 当前支持项目/全局 `AGENTS.md`
  - Codex 的 rules / auto memory 暂无可靠原生等价目录，因此 API 明确返回 `available: false`、`readOnly: true` 和提示文案，而不是伪造路径
- 前端全局记忆面板与项目记忆面板已支持切换 `Claude / Codex`。
- 前端 Skill Store 已支持安装到 Claude / Codex / Chat 各目标，并在选择项目后支持项目级安装状态展示。

### 验收记录
- `pnpm -r typecheck`：通过。
- 单独启动 API（`3003`）后验证以下接口通过：
  - `GET /api/agent-docs/global?provider=codex`
  - `GET /api/projects/:projectId/agent-docs?provider=claude`
  - `GET /api/projects/:projectId/rules?provider=codex`
  - `GET /api/projects/:projectId/memory?provider=codex`
- 已验证通过 Skill Store 安装到 `codex-global`：
  - API 返回 `installed.codexGlobal = true`
  - 目标目录实际落盘到 `$HOME/.agents/skills/<skill>`

### 当前边界
- 本阶段没有把 `~/.codex/skills` 作为 Skill Store 安装目标；仍按方案文档只支持 Codex 官方原生 `.agents/skills`。
- Codex 的规则目录和自动记忆目录当前没有继续硬映射到 Claude 概念，避免后续产品语义失真。

## 2026-06-04：网页主题与终端主题切换

### 已完成
- 顶栏网页主题切换改为图标按钮，点击在暗色 / 亮色之间切换。
- 终端主题切换移入会话模态框，支持跟随界面 / 暗色 / 亮色，默认跟随界面。
- 新增 `apps/web/src/theme.tsx`：统一管理 `uiTheme` / `terminalTheme` 状态，并在根节点写入 `data-ui-theme` / `data-terminal-theme`。
- `apps/web/index.html` 增加主题预初始化脚本，首屏加载前先恢复已保存主题，避免闪烁。
- `apps/web/src/pty-terminal.tsx` 接入 xterm.js 亮暗两套主题，切换终端主题时即时生效。
- `apps/web/src/styles.css` 增加主题变量与亮色覆盖规则，先覆盖现有深色样式中的主要背景、文字、边框、状态色与终端面板。
- `docs/dev-management-mvp.md` 补充主题切换约定。

### 待验证
- `pnpm install`
- `pnpm -r typecheck`
- `pnpm -r build`
- 浏览器中切换网页主题与终端主题，确认刷新后仍保持上次选择。

## 2026-05-29：Windows 桌面端 UI 壳首切片

### 已完成
- 新增 `apps/desktop/` Electron 桌面端骨架，首版直接打开 `http://localhost:3001`。
- 新增桌面端连接失败页：当 WSL 中的 `workhorse-station` 服务未就绪时，提供重试连接和浏览器打开入口。
- 根 `package.json` 新增 `desktop:start` / `desktop:build` 脚本。
- `.env.example`、`scripts/install.sh`、`scripts/update.sh` 补充 `localhost:3001` 单端口与 WSL systemd 服务说明。
- `docs/dev-management-plan.md`、`docs/dev-management-mvp.md`、`docs/dev-management-tech-stack.md` 更新双端路线：保留 web 端，Windows 桌面端首版只做 UI 壳，后端继续运行在 WSL。

### 待验证
- `pnpm install`
- `pnpm -r typecheck`
- `pnpm -r build`
- Windows 中启动 Electron，确认能打开 `http://localhost:3001`，并在服务未启动时显示错误页。

### 已完成
- 后端新增 `POST /api/projects/:projectId/sessions/:sessionId/continue` 端点：原地续接已停止（completed/failed）的会话，使用 `--resume <id>` 不 fork，保留原有 terminal buffer。
- `SessionRuntimeManager.startSession()` 新增 `initialBuffer` 可选参数，支持续接时预填历史终端输出。
- 前端 `api.ts` 新增 `continueSession()` 函数。
- `SessionModal` 新增 `onContinueSession` / `continuingSessionId` props，已停止会话卡片显示「继续」按钮（绿色）。
- `App.tsx` 接入 `handleContinueSession`：调用 continue API 后自动切换到终端视图。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。

## 2026-05-24：聊天中 Skill 调用与 bash 工具集成

### 已完成
- 聊天工具集中新增 `Skill` 工具：根据 `listChatSkills()` 动态生成可用 Skill 列表，Claude 可通过该工具加载指定 Chat Skill 的完整指令并按指令执行。
- 聊天工具集中新增 `bash` 工具：支持执行 bash 命令（30 秒超时、1MB 输出限制），工作目录为当前项目目录，使 AI 能运行脚本和检查系统状态。
- `buildSystemPrompt()` 新增 Chat Skills 列表注入：系统提示词中列出所有可用 Chat Skill 的名称和描述，引导 Claude 匹配并调用。
- `ChatStreamHandler.processMessage()` 在每次消息处理时调用 `listChatSkills()` 刷新 Skill 列表，确保工具注册和系统提示词始终反映最新状态。
- `loadChatSkill(skillName)` 从 `~/.workhorse/chat-skills/<name>/` 加载 SKILL.md 内容，返回 frontmatter 元数据和 body 指令文本。
- `Skill` 工具返回结果中包含技能目录路径提示，方便后续 bash 命令引用技能脚本。

### 验收记录
- `todo-summary` Chat Skill 已注册，`SKILL.md` + `scripts/count.sh` 可用。
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。

## 2026-05-24：技能仓库管理与 Chat Skills 管理

### 已完成
- 新增 Skill 主仓库 `~/.workhorse/skills/`，统一管理 Skill 的创建、重命名、删除。
- 新增安装下发机制：支持将主仓库 Skill 安装到三个目标——全局 Claude Code（`~/.claude/skills/`）、AI Chat（`~/.workhorse/chat-skills/`）、项目 Claude Code（`<project>/.claude/skills/`）。
- 新增 `InstallTarget`、`StoreSkill`、`StoreSkillStatus` 等共享类型。
- 提取 `parseFrontmatter()` 到独立文件 `skill-frontmatter.ts`，供 store 和 loader 共用。
- 后端新增 `skill-store.ts`（文件系统操作）和 `skill-store-routes.ts`（5 个 REST 端点）。
- 后端新增 `chat-skill-routes.ts`：`GET /api/chat-skills` 列出 Chat Skills，`DELETE /api/chat-skills/:name` 移除。
- 前端新增 `SkillStorePanel` 组件，包含创建 Skill 表单弹窗（名称 + 描述，替换原来两次 prompt）、安装状态徽标、安装/重命名/删除操作。
- `SkillStorePanel` 底部新增 Chat Skills 管理区，显示 `~/.workhorse/chat-skills/` 下的 Skill 并提供移除按钮。
- 工作台标签新增「技能仓库」选项卡（`WorkbenchTab` 扩展 `"skill-store"`）。
- 启动时自动加载技能仓库和 Chat Skills 数据，count badge 实时显示正确数量。

### 关键修复
- 创建 Skill 从两次 `prompt()` 弹窗改为单个模态框表单（名称 + 描述），一次提交即可完成。
- 修复技能仓库页面 count 显示 0 的问题：`reloadStoreSkills()` 加入启动 `Promise.all`。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- 浏览器验证：通过。
  - 技能仓库 count 正确显示 2（etst / tset）。
  - 新建表单弹窗单次填入名称和描述，创建成功。
  - 安装到全局 CC 和 Chat 后按钮变为 disabled，文件正确复制到目标目录。
  - 删除 Skill 后 UI 回到空状态，主仓库目录已清理。
  - Chat Skills 区正确显示 todo-summary，含名称、描述、路径和移除按钮。

## 2026-05-24：流式工具调用渲染时序修复

### 已完成
- 后端对所有工具（包括 auto）统一先发送 `tool_use_pending` 事件，前端在 SSE 事件到达时即可创建工具卡片占位。
- 前端三个独立 state（`streamingContent`、`streamingToolCalls`、`streamingToolResults`）合并为 `StreamingBlock[]` 时间线数组。
- 渲染改为 `streamingBlocks.map()` 按事件到达顺序显示，text block 用 MarkdownContent，tool block 用工具卡片，确保文本和工具按时间顺序穿插。
- `ChatStreamWorkspace` 和 `HomeChatWorkspace` 的 props 接口统一使用 `streamingBlocks: StreamingBlock[]`。

### 关键修复
- 修复工具调用结果在所有文本输出完成后才显示的问题。
- 修复文本在上、工具在下的渲染顺序问题。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- 浏览器验证：通过，工具调用卡片在文本输出中实时穿插显示。

## 2026-05-24：任务管理增强——搜索、标签过滤与内联状态切换

### 已完成
- 后端 `listTodos` / `countTodos` 新增 `search` 和 `tags` 参数，LIKE 匹配标题、描述和标签。
- `GET /api/projects/:projectId/todos` 新增 `search` / `tags` 查询参数。
- 前端 `getTodos` 新增 `search` / `tags` 可选参数。
- 任务面板新增搜索输入框：按标题、描述、标签模糊匹配，300ms debounce，结果计数显示筛选标记。
- 任务面板新增可用标签芯片：从当前任务列表自动提取，点击切换过滤条件。
- 任务卡片标签改为可点击按钮：点击添加/移除过滤条件，高亮当前激活的过滤标签。
- 任务卡片状态标签改为下拉框（combobox）：支持不打开模态框直接切换草稿/待处理/进行中/已完成，即时调用 API 更新。
- 新增 `availableTodoTags` 派生计算、`todoSearchQuery` / `todoFilterTags` 状态和防抖 useEffect。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- API 验证：`?search=下拉框` 返回 1/1 条正确筛选结果。
- 浏览器验证：通过。
  - 搜索"下拉框"后正确筛选出 1 条匹配任务，显示"1 条结果（已筛选）"。
  - 清除搜索后恢复显示 5 条任务。
  - 状态下拉框切换"待处理"→"已完成"即时生效，时间更新为当前时刻。
  - 浏览器控制台无错误。

## 2026-05-24：页面高度固定为视口高度

### 已完成
- `styles.css`：`html, body, #root` 统一设为 `height: 100%; overflow: hidden`，从根节点锁定页面高度，防止内容撑开视口。
- `App.tsx` 根布局：`min-h-screen` → `h-full`，不再允许弹性撑高。
- `<main>`：添加 `min-h-0` 防止 flex 子元素溢出；聊天模式使用 `overflow-hidden`，由内部 grid 处理滚动；概览/项目模式使用 `overflow-auto`，由 main 统一处理滚动。
- `HomeWorkspace` 聊天模式：`min-h-[calc(100vh-104px)]` → `h-full`，不再硬编码 calc 偏移量。
- `HomeChatWorkspace`：`h-[calc(100vh-80px)]` → `h-full`，由父级约束高度而非自行计算。
- 卡片内容较高时通过所属滚动容器内部滚动，不撑开页面。

### 验收记录
- `npm run build`：通过。
- 浏览器验证：通过。
  - 聊天模式：页面固定 973px，消息区内部滚动（2554px 内容 → 760px 容器），无外层滚动条。
  - 工作台模式：body=viewport，main 内部滚动（1299px → 906px）。
  - 项目页面：body=viewport，main 内部滚动（1025px → 906px）。

## 2026-05-24：项目页面 UI 精简

### 已完成
- 移除项目页面的状态卡片（项目数量 / Worktree 数量 / 运行中会话 / 数据库状态），减少非必要信息干扰。
- 移除项目页面右上角「新建项目」按钮，项目创建和管理统一通过概览页承接。
- 「直接创建会话」按钮文案简化为「创建会话」。

### 验收记录
- `tsc --noEmit`：通过。
- `pnpm -r build`：通过。

## 2026-05-24：工作台标签页式管理重构

### 已完成
- 顶部导航「概览」更名为「工作台」，强调全局资源管理而非仪表盘语义。
- 新增 `WorkbenchTab` 类型（`"notes" | "skills" | "projects" | "chats" | "sessions"`），替代原来的垂直堆叠布局。
- 工作台页重构为 5 个独立标签页：笔记 / Skill / 项目 / 聊天 / 会话，每个标签显示资源数量。
- 新增顶部紧凑系统状态栏：API / DB / FTS5 以彩色状态点一行展示，替代原来的侧边卡片。
- 项目标签页展示完整项目列表（含路径、最近会话摘要、更新时间），支持「进入」和「新建项目」操作。
- 聊天标签页列出所有聊天会话，显示最后一条消息预览，点击直接进入聊天。
- 会话标签页展示跨项目运行中的 Claude Code 执行会话，含绿色脉冲状态指示。
- 工作台标签状态通过内部 `useState` 管理，切换不依赖路由。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- 浏览器验证：通过。
  - 顶部显示「工作台」按钮，点击切换至标签页管理界面。
  - 系统状态栏显示 API / DB / FTS5 绿色状态点。
  - 笔记 (2) / Skill (1) / 项目 (1) / 聊天 (2) / 会话 (0) 标签带计数正确渲染。
  - 各标签页内容正常切换，项目管理列表、聊天预览、Skill 管理均正常。
  - 浏览器控制台无错误。

## 2026-05-23：聊天 SSE 流式输出与工具调用确认机制

### 已完成
- 新增共享类型 `ChatToolCallStatus`、`ChatStreamEvent`、`ChatStreamEventType`、`ConfirmToolRequest`。
- `ChatToolCall` 增加 `status` 字段，历史数据默认视为 `"executed"`。
- 工具定义增加 `confirmation: "auto" | "confirm"` 字段：5 个查询工具为 auto，3 个写操作工具（create_note、create_todo、create_prompt_draft）为 confirm。
- 新增 `ChatStreamHandler`：管理单会话 Anthropic 流式 API 调用和工具循环，通过回调发送 SSE 事件，内部维护 pending confirmations 的 Promise Map。
- 新增 `chat-events.ts`：统一注入 timestamp 的 SSE 事件工厂函数。
- 聊天路由改造：`POST /api/chat-sessions/:chatSessionId/messages` 从同步阻塞改为 SSE 流式端点，使用 `reply.hijack()` + `await processMessage()` 保持连接。
- 新增 `POST /api/chat-sessions/:chatSessionId/confirm-tool`：接收前端确认/拒绝指令。
- 前端 `streamChatMessage()`：使用 fetch + ReadableStream 解析 SSE 事件。
- 前端聊天 UI 改造：流式文本渲染、工具调用卡片（含 pending/executed 状态）、确认按钮（执行/拒绝）、发送按钮流式状态（接收中...）。
- 待确认工具默认 5 分钟超时自动拒绝。

### 关键问题与修复
- **POST 请求下 SSE 连接立即断开**：fire-and-forget 模式（`.catch()` 不 await）导致 Fastify 在 POST handler 返回后触发请求关闭。修复为 `await handler.processMessage()` 保持 handler 存活至流结束，同时将连接关闭监听从 `request.raw.on("close")` 改为 `request.raw.socket?.on("close")`。

### 验收记录
- `pnpm -r build`：通过。
- curl 验证 SSE 输出：259 行事件，text_delta 逐字输出正常。
- 浏览器验证：通过。
  - 流式文本输出正常（逐字显示）。
  - 自动工具调用（search_notes）自动执行，结果实时显示。
  - 确认工具调用（create_note）显示「等待确认」卡片和执行/拒绝按钮。
  - 点击「执行」后创建成功，AI 基于结果继续对话。
  - 发送按钮在流式接收中显示「接收中...」并禁用，完成后恢复「发送」。

## 2026-05-23：AI 聊天从 Structured Output 改为 Tool Use

### 已完成
- 新增共享类型 `ChatToolCall`、`ChatToolResult`，扩展 `ChatMessageSummary`。
- 数据库迁移：`chat_messages` 新增 `tool_calls_json`、`tool_results_json` 列。
- `chat-repository.ts` 扩展 write input / row mapping 支持新字段。
- 新建 `chat-tools.ts`：定义 8 个工具（search_notes、create_note、list_todos、create_todo、create_prompt_draft、list_projects、list_worktrees、list_prompt_drafts），使用 JSON Schema 定义，纯函数执行器直接读写 SQLite。
- 重写 `chat-service.ts`：移除 `output_config.json_schema`，改为手动 Tool Use 循环（最多 5 次迭代），通过 `client.beta.messages.create()` 传入 `tools` 参数，`toBetaMessages()` 将 DB 历史还原为 `BetaMessageParam[]`。
- `chat-routes.ts` 适配多消息返回：遍历 `generateChatReply` 返回的 `messages[]` 逐条写入 DB。
- 前端 `App.tsx`：新增 tool call 卡片（绿色边框）和 tool result 渲染，移除 apply 逻辑和 `savingChatSuggestionKey` 状态，旧 `artifactSuggestions` 改为只读展示。
- 修复消息排序问题：`ORDER BY created_at ASC, id ASC` 改为 `ORDER BY rowid ASC`，避免同一秒内插入的多条消息按随机 UUID 排序导致 tool_use/tool_result 配对错乱。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- 浏览器验证：通过。
  - search_notes 正确调用并返回搜索结果。
  - create_note 正确创建笔记，消息顺序为 tool call → tool result → AI 回复。
  - 三轮连续对话无错误，tool_use/tool_result 正确配对。
  - tool call 卡片绿色边框显示，tool result 带 ✅ 前缀。
  - 旧聊天会话的 artifactSuggestions 卡片只读显示。

## 2026-05-23：笔记标签过滤与全文搜索

### 已完成
- 后端新增 FTS5 虚拟表创建（contentless 模式），并在 CRUD 操作中同步维护索引。
- FTS5 在当前 sql.js 1.14.1 中不可用（`no such module: fts5`），自动降级为 LIKE 全文搜索。
- `GET /api/notes` 和 `GET /api/projects/:projectId/notes` 新增 `search` 和 `tags` 查询参数支持。
- `search` 参数对标题、正文和标签做 LIKE 模糊匹配。
- `tags` 参数支持逗号分隔多标签过滤，内部通过 JSON 文本 LIKE 匹配。
- 前端 NotePanel 新增搜索栏：搜索输入框、标签芯片列表、结果计数。
- 笔记列表中的标签芯片改为可点击按钮，点击可添加/移除标签过滤条件。
- 搜索输入 300ms debounce 后自动触发数据重载。
- 过滤标签芯片从当前笔记列表中自动提取，支持渐进式筛选。
- 修复标签芯片按钮嵌套在笔记选中按钮内的 HTML hydration 错误。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- API 验证：`?search=React`、`?tags=frontend`、组合查询均返回正确结果。
- 浏览器验证：通过。
  - 概览页全局笔记出现搜索栏和标签芯片。
  - 搜索 "React" 后正确筛选出 1 条匹配笔记，显示"1 条结果（已筛选）"。
  - 点击 "frontend" 标签芯片后正确筛选出 2 条匹配笔记。
  - 标签芯片高亮状态和可用标签列表随筛选结果正确更新。
  - 浏览器控制台无错误。

## 2026-05-23：概览页增强

### 已完成
- 新增跨项目会话 API：`GET /api/sessions/running`（返回所有运行中/排队中的会话）和 `GET /api/sessions/recent?limit=N`（返回最近会话），均 JOIN projects 表带上项目名。
- 新增共享类型 `OverviewSessionSummary`、`RunningSessionsResponse`、`RecentSessionsResponse`。
- 前端概览页新增「最近项目」卡片区：展示最近更新的 5 个项目，含项目名、路径、最后会话结果摘要、更新时间，提供「进入」按钮直接跳转项目。
- 前端概览页新增「运行中会话」列表：展示所有跨项目运行中/排队的 Claude Code 会话，含会话名、项目名、运行时状态和最近活动时间，提供「进入」按钮直接跳转项目并打开会话。
- 优化「最近聊天」区域描述文案，限制显示最近 6 条聊天会话。
- 点击最近项目或运行中会话的「进入」按钮可切换到对应项目的工作台。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- API 验证：`GET /api/sessions/running` 和 `GET /api/sessions/recent?limit=3` 均返回正确数据结构。
- 浏览器验证：通过。
  - 概览页展示「最近项目」卡片，显示 workhorse-station 项目名、路径和时间。
  - 概览页展示「运行中会话」空状态。
  - 概览页展示「最近聊天」列表。
  - 点击最近项目的「进入」按钮可正确跳转到项目工作台。
  - 浏览器控制台无错误。

## 2026-05-22：全局笔记 CRUD 首切片

### 已完成
- 后端新增全局笔记 API：`GET /api/notes`、`POST /api/notes`、`PATCH /api/notes/:noteId`、`DELETE /api/notes/:noteId`。
- 全局笔记复用 `notes` 表，使用 `project_id IS NULL` 与项目笔记区分；共享 `NoteSummary` 继续保留 `projectId: null`。
- 首页概览接入全局笔记管理区，复用项目笔记编辑器交互，支持列表、创建、自动保存、属性编辑、删除。
- 全局笔记模式隐藏“创建任务”动作，避免跨项目笔记直接绑定项目任务。
- 同步更新开发计划：标记首页聊天、默认草稿建议、全局笔记 CRUD 和已完成的 Skill 文件夹管理项。

### 验收记录
- `pnpm --filter @workhorse-station/api typecheck`：通过。
- `pnpm --filter @workhorse-station/web typecheck`：通过。
- `pnpm -r build`：通过。
- 浏览器验证：通过。
  - 打开首页概览后可看到“全局笔记”管理区。
  - 新建全局笔记并立即保存后，列表出现该笔记。
  - 打开属性弹窗后可保存标签，列表中显示 `global` / `crud` 标签。
  - 删除测试全局笔记后，列表恢复为空状态。
  - 浏览器控制台无错误，仅有 React DevTools 信息提示。

## 2026-05-29：Skill 文档可编辑

### 已完成
- 全局 Skill、项目 Skill、技能仓库新增 `SKILL.md` 文档读写接口。
- Skill 管理界面新增文档编辑入口，可直接修改各 Skill 文件夹内的 `SKILL.md`。
- 新建全局 / 项目 Skill 时默认创建 `SKILL.md`，重命名 Skill 时同步更新文档中的 `name` frontmatter。

### 验收记录
- 待验证。

## 2026-05-22：Skill 文件夹管理首切片

### 已完成
- 将 Skill 管理约定调整为文件夹管理：全局来源 `~/.claude/skills/*`，项目来源为项目 `.claude/skills/*`，名称等于文件夹名。
- 新增后端 Skill 文件夹 API：支持全局 / 项目 Skill 列表、创建、重命名、删除、复制和项目级同名覆盖展示。
- 后端以文件系统为真实来源，不解析 Skill 目录内容，不把 Skill 正文写入数据库。
- 新增共享 Skill 类型和前端 API client。
- 首页概览接入全局 Skill 文件夹管理；项目 Skill 页接入合并视图，展示生效来源、路径和覆盖状态。
- 删除和覆盖复制保留显式确认，非法名称、目标已存在、确认名不匹配由后端返回明确错误。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- 浏览器验证：通过。
  - 概览页可发现并展示 `~/.claude/skills/*`。
  - 创建全局测试 Skill 后，真实目录出现在 `~/.claude/skills/`。
  - 项目 Skill 页可发现并展示项目 `.claude/skills/*`，已有同名项目 Skill 能覆盖全局 Skill。
  - 创建项目测试 Skill 后，真实目录出现在项目 `.claude/skills/`。
  - 项目 Skill 可复制到全局，复制后合并视图显示同名覆盖关系。
  - 项目 Skill 重命名和删除会同步真实文件夹。
  - 测试过程中创建的临时全局 / 项目 Skill 已清理。
  - 浏览器控制台无错误。

## 2026-05-22：首页 AI 聊天建议确认落库闭环

### 已完成
- 新增聊天建议采纳状态：`artifactSuggestions` 中记录 `pending` / `saved`、目标实体类型 / ID、采纳项目 / worktree 和采纳时间。
- 新增 `POST /api/chat-sessions/:chatSessionId/messages/:chatMessageId/suggestions/:suggestionId/apply`，由后端统一完成建议确认、实体创建、来源关联和建议状态回写。
- `notes` / `todos` / `prompt_drafts` 增加 `source_chat_suggestion_json`，目标实体可反查来源聊天会话、消息和建议 ID。
- 首页建议卡片保存改为调用 apply API，支持保存中状态、已保存禁用态和刷新后持久显示。
- 结构化回复解析增强：兼容模型偶发返回 `suggestions` 别名，以及前后夹杂其他 JSON 对象时提取包含 `reply` 的结构化结果。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- 浏览器验证：通过。
  - 首页聊天真实生成任务 / 笔记 / Prompt 草稿建议卡片。
  - 点击任务建议“保存”后，按钮变为“已保存”，任务列表出现草稿任务。
  - 点击笔记建议“保存”后，按钮变为“已保存”，笔记列表出现对应笔记。
  - 点击 Prompt 草稿建议“保存”后，按钮变为“已保存”，Prompt 草稿列表出现对应草稿。
  - 刷新页面后，任务 / 笔记 / Prompt 草稿建议卡片仍显示“已保存”。
  - API 验证 `todos` / `notes` / `prompt_drafts` 返回 `sourceChatSuggestion`，聊天消息建议返回 `adoption`。

## 2026-05-22：首页 AI 聊天首切片

### 已完成
- 首页聊天从 mock 切换为真实持久化，会话与消息分别落到 `chat_sessions` / `chat_messages`。
- 后端通过官方 Anthropic SDK 调用 Claude，返回自然语言回复和结构化草稿建议。
- 前端首页聊天接入真实 API，支持会话列表、新建 / 删除会话、文本附件、assistant 建议卡片，以及项目 / worktree 上下文注入。
- Claude 代理环境已兼容 `ANTHROPIC_AUTH_TOKEN` 和 `ANTHROPIC_BASE_URL`，可直接复用 `~/.claude/settings.json` 的代理配置。

### 验收记录
- `corepack pnpm -r typecheck`：通过。
- `corepack pnpm -r build`：通过。
- 浏览器验证：通过到 assistant 回复与建议渲染。
  - 首页可加载真实聊天会话。
  - 可新建聊天会话并发送文本消息。
  - 文本附件可选择、可展示，并随消息提交。
  - assistant 回复会渲染到页面，结构化草稿建议也会返回并展示。
  - 建议确认按钮的最后一步点击验证仍留待下一轮。

## 2026-05-22：会话结果留存与任务 / 项目回写

### 已完成
- 会话结果继续复用 `sessions.summary`，不新增额外结果表。
- 修正会话退出时的完成逻辑：成功停止 / 正常退出后不再清空 `summary`，失败退出仅在摘要为空时补 exit code 兜底文本。
- `projects` 和 `todos` 新增 `latest_session_result` 字段，用轻量快照保存最近一次显式回写的会话结果。
- 会话 `PATCH` 接口新增结果回写能力：支持保存结果、写回关联任务、写回当前项目。
- 会话模态框历史视图新增“会话结果”编辑区，可直接保存结果并触发写回动作。
- 会话列表、模态框左侧列表新增结果摘要预览；项目详情和任务详情新增最近会话结果卡片，并提供“打开会话”入口。

### 验收记录
- 浏览器验证：通过。
  - 在会话模态框中打开待办会话的“查看历史”后，可看到结果编辑区和“保存结果 / 写回任务 / 写回项目”按钮。
  - 在浏览器中真实输入结果并保存后，会话列表即时显示结果摘要预览。
  - 点击“写回任务”后，任务接口返回 `latestSessionResult`，结果快照与会话关联正确。
  - 点击“写回项目”后，项目接口返回 `latestSessionResult`，结果快照与会话关联正确。
- API 验证：通过。
  - `GET /api/projects/:projectId/sessions` 可读到保存后的 `summary`。
  - `GET /api/projects/:projectId/todos` 可读到任务级 `latestSessionResult`。
  - `GET /api/projects/:projectId` 可读到项目级 `latestSessionResult`。

## 2026-05-22：真实 Claude Code 会话与终端接入

### 已完成
- 会话创建已从“记录”升级为真实启动 Claude Code PTY，支持项目根目录、已有 worktree，以及按名称自动创建 worktree。
- 会话后端新增 runtime manager、PTY 封装、Claude 可执行文件解析、SSE 事件流和 terminal snapshot 接口。
- 会话停止 / 删除改为真实进程控制，不再只是更新状态字段；停止后的会话会收敛为 `completed` / `stopped`。
- 前端会话模态框接入 xterm.js，运行中显示实时终端，停止后切换为静态快照，避免继续挂载 resize 逻辑。
- 进入项目时会强制重载 worktrees / notes / todos / prompt drafts / sessions，避免初次进入时状态过旧。

### 验收记录
- 浏览器验证：通过。
  - 项目页进入后，worktree 列表和上下文能即时同步到最新状态。
  - 会话弹层可以打开，运行中会话使用真实终端渲染，停止后显示终端快照。
  - 停止后的会话不再继续触发 xterm viewport / resize 报错。
  - 会话停止、删除路径仍可用，停会话后状态会回到 `completed` / `stopped`。

## 2026-05-22：Prompt 草稿与项目会话最小闭环

### 已完成
- 新增项目级 `prompt_drafts` 持久化：支持预览、创建、编辑和列表读取。
- 新增项目级 `sessions` 持久化：支持创建、列表、停止（更新状态）和删除。
- 会话创建支持两条入口：直接创建、从待办创建。
- 会话创建流程拆分为两个模态框：先在创建模态框中生成 / 保存 prompt 草稿，再进入会话查看模态框。
- 顶部导航右上角新增“会话”按钮，可随时重新打开当前项目的会话模态框。
- 会话模态框 PC 维持 3:7 结构，左侧使用紧凑标签展示项目 / 待办 / worktree / 状态，右侧保留会话占位视图。
- 每条会话卡片右侧提供独立“停止”“删除”操作；关闭模态框仅表示收起，不等于停止。

### 当前阶段边界
- 当前已完成的是会话数据面和交互闭环，不是真实 Claude Code PTY 执行闭环。
- 会话记录会保存 prompt 快照、来源、关联 todo / worktree / prompt draft，但右侧执行区仍是 PTY 未接入占位。
- “停止会话”当前表现为将单条会话状态更新为 `completed`，不涉及真实终端进程管理。

### API 范围
- `POST /api/projects/:projectId/prompt-drafts/preview`：生成未落库的 prompt 草稿预览。
- `GET /api/projects/:projectId/prompt-drafts`：读取项目下 prompt 草稿列表。
- `POST /api/projects/:projectId/prompt-drafts`：保存 prompt 草稿。
- `PATCH /api/projects/:projectId/prompt-drafts/:draftId`：更新 prompt 草稿。
- `GET /api/projects/:projectId/sessions`：读取项目下会话列表。
- `POST /api/projects/:projectId/sessions`：创建会话记录并保存 prompt 快照。
- `PATCH /api/projects/:projectId/sessions/:sessionId`：更新会话名称、状态、摘要。
- `DELETE /api/projects/:projectId/sessions/:sessionId`：删除单条会话记录。

### 验收记录
- `corepack pnpm -r typecheck`：通过。
- `corepack pnpm -r build`：通过。
- 浏览器验证：通过。
  - 通过待办入口和直接创建入口都能打开创建会话模态框。
  - 可先生成 prompt 草稿、保存草稿，再创建会话记录。
  - 顶部“会话”按钮可重新打开会话模态框。
  - 每条会话卡片都带独立“停止”“删除”按钮。
  - 停止单条会话后，状态会更新为 `completed`。
  - 删除当前选中会话后，会自动切换到剩余会话；若无剩余会话则关闭模态框。

## 2026-05-22：Phase 1 收尾标记与 Phase 2 首切片启动

### 状态结论
- Phase 1 主体已完成：项目 CRUD、代码目录绑定、项目级 worktree 管理、worktree 列表/选择/状态展示，以及删除 worktree 时同步删除本地分支。
- Phase 1 已全部完成（项目状态总览、worktree 选择/填写均已通过后续迭代补齐）。

### Phase 2 首切片范围
- 项目级 notes 真实 CRUD。
- 项目级 todos 真实 CRUD。
- todo 支持 `status`、`tags`、`sourceNoteId`。
- 前端用真实数据替换项目内 notes / todos 占位。
- 支持从 note 创建 todo，并自动带上来源关联。

### 暂不纳入本切片
- 全局笔记。
- 搜索 / FTS5。
- AI 草稿。
- prompt 生成。
- 会话联动。
- 完整项目状态总览。

## 2026-05-21：UI 信息架构方向调整

### 目标
- 支持 PC 和移动版，不再强制桌面固定宽度。
- 顶栏将聊天 / 概览拆成独立菜单项；项目入口只通过项目下拉进入，不单独展示项目菜单项和 Worktree 按钮。
- 聊天页区分聊天会话和 Claude Code 会话：左侧是聊天会话列表，右侧是聊天内容和带文件选择的输入框。
- 生成笔记、待办、提示词等能力作为默认 Skill，不作为聊天主界面按钮。
- 概览页承载全局笔记、全局 Skill、最近项目、最近会话等管理入口。
- 进入具体项目后，通过项目级顶部导航进入总览 / 待办 / 笔记 / Skill / 会话 / Worktree。
- 终端不再作为全局固定右侧栏；选中或创建 Claude Code 会话后，通过可关闭的大模态框打开。
- 会话模态框 PC 采用 3:7 左右布局，移动端使用全屏单列。
- 关闭会话模态框表示后台运行，不代表停止会话。
- 会话创建需要支持直接创建和从待办创建两种入口。

### 说明
- Phase 0/1 记录中的“右侧终端 / AI 聊天 / 会话输出”是历史骨架验收项，不再作为当前目标形态。
- 当前切片先调整文档并实现项目级 notes / todos 真实数据流，不实现真实 Claude Code PTY 或会话持久化。


## 2026-05-22：项目笔记编辑器与任务文案重构

### 已完成
- 项目页“笔记”改成直接进入 markdown 编辑器，不再走表单式详情页。
- 笔记正文支持自动保存；首行会自动提取为标题，且标题仍可单独手改。
- 笔记列表卡片增加“属性”入口，标签等次要属性通过模态框编辑。
- 项目级“待办”相关可见文案统一改成“任务”，包括 tab、页面标题、创建入口和从任务创建会话。

### 验收记录
- 浏览器验证：通过。
  - 笔记 tab 打开后，右侧可直接编辑标题和 markdown 正文。
  - 新建笔记输入多行 markdown 后，列表里会显示自动提取的首行标题。
  - 切换笔记后，已编辑内容仍保留。
  - 点击笔记卡片的“属性”后可以打开属性模态框。
  - 项目 tab、任务页标题、从笔记创建任务、从任务创建会话都已改成“任务”。


### 目标
- worktree 作为项目级资源管理，按项目过滤列表。
- worktree 固定存放在项目 `.claude/worktree/` 目录下。
- 支持创建、选择、状态展示和删除 worktree。
- 删除 worktree 时同步删除对应本地 git 分支。
- 删除前前端确认，后端校验分支确认值和项目归属。
- dirty / missing / unknown / 未合并分支等风险状态默认阻止删除。
- 右侧终端占位同步显示当前项目、worktree、分支、状态和 cwd。

### API 范围
- `GET /api/projects/:projectId/worktrees`：返回当前项目 worktree 列表，并刷新 clean / dirty / missing / unknown 状态。
- `POST /api/projects/:projectId/worktrees`：创建项目级 git worktree，默认分支名为 `workhorse/<name>`。
- `DELETE /api/projects/:projectId/worktrees/:worktreeId`：删除 worktree 目录、同步删除本地分支并清理记录。

### 安全约定
- worktree 名称只允许字母、数字、点、下划线和短横线，避免路径穿越。
- git 命令使用 `execFile` 参数数组执行，不拼 shell 字符串。
- 删除前校验 worktree 路径仍位于项目 `.claude/worktree/` 下。
- 删除前确认 git worktree 的 path / branch 与数据库记录一致。
- dirty worktree 返回 `409 worktree_dirty`，不删除目录、分支或数据库记录。
- 未合并分支返回 `409 branch_not_merged`，不执行强删。
- 项目已有 worktree 时，禁止修改项目代码目录或删除项目记录。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- API 验证：通过。
  - `GET /health` 正常。
  - 自动创建 / 复用绑定 `/home/wengfb/projects/workhorse-station` 的项目。
  - `POST /api/projects/:projectId/worktrees` 可创建 `.claude/worktree/<name>` 下的 worktree。
  - 重复 worktree 名称返回 `409 worktree_name_exists`。
  - 非法名称返回 `400 validation_error`。
  - 制造未跟踪文件后，列表状态刷新为 `dirty`。
  - dirty worktree 删除返回 `409 worktree_dirty`。
  - 清理 dirty 文件后，删除 worktree 成功，并同步删除本地分支。
- 浏览器验证：通过。
  - 打开 `http://localhost:5173`。
  - 项目页显示 Worktree 管理区。
  - 可在浏览器创建 `browser-verify` worktree。
  - 创建后 Worktree 数量、顶栏当前 worktree、列表状态和右侧终端上下文同步更新。
  - 删除前出现确认框，确认后列表恢复为空，顶栏和右侧终端上下文同步清空。
  - 浏览器控制台无错误。


## 2026-05-21：Phase 1 项目 CRUD 和代码目录绑定

### 目标
- 项目列表读取真实 SQLite 数据，不再返回固定空数组。
- 支持创建、查看、编辑、删除项目。
- 每个项目绑定一个本机已有 Git 仓库主工作目录。
- 创建和更新项目时规范化真实路径，避免同一路径重复绑定。
- `sql.js` 写操作成功后调用 `persist()` 落盘。
- 前端在现有工作台结构中提供项目列表 / 详情联动。

### API 范围
- `GET /api/projects`：返回项目列表。
- `GET /api/projects/:id`：返回单个项目。
- `POST /api/projects`：创建项目并绑定代码目录。
- `PATCH /api/projects/:id`：更新项目基础信息或重新绑定目录。
- `DELETE /api/projects/:id`：删除项目记录，不删除本地代码目录。

### 路径校验约定
- 路径必须是绝对路径。
- 路径必须存在且是目录。
- 路径下必须存在 `.git` 目录；Phase 1 暂不接受 linked worktree 的 `.git` 文件。
- 入库路径使用 `realpath` 后的真实绝对路径。
- 默认分支优先从 `.git/HEAD` 探测，失败时使用 `main`。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- API 验证：通过。
  - `GET /health`、`GET /api/meta`、`GET /api/projects` 正常。
  - `POST /api/projects` 可绑定 `/home/wengfb/projects/workhorse-station`。
  - 重复绑定同一路径返回 `409 project_path_exists`。
  - 相对路径、不存在路径、非 Git 目录返回对应 400 错误。
  - `GET /api/projects/:id`、`PATCH /api/projects/:id`、`DELETE /api/projects/:id` 正常。
  - 重启 API 后项目记录仍存在，确认 `sql.js` 持久化生效。
- 浏览器验证：通过。
  - 打开 `http://localhost:5173`，页面保持顶栏 + 中间内容区 + 右侧执行区。
  - “项目”tab 可创建、选择、编辑、删除项目。
  - 顶栏当前项目、项目数量卡片、列表、详情和终端占位同步更新。
  - 右侧可切换“终端 / AI 聊天 / 会话输出”。
  - 浏览器控制台无错误。


## 2026-05-24：终端 buffer 持久化、JSONL 历史回放与会话续接

### 已完成
- 终端 buffer 持久化：每 10 秒 + 50KB 阈值增量 flush 到 `terminal_buffer` 列，会话退出时最终保存。
- 终端快照 API 支持 DB fallback：运行中会话从内存取 buffer，已停止会话从 DB 读取 `terminal_buffer`。
- 新增 `GET /api/projects/:projectId/sessions/:sessionId/history`：解析 `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`，返回结构化的 user/assistant 消息列表。
- `parseClaudeCodeHistory()` 支持 text、tool_use、tool_result 三种 block 类型，自动将 tool_result 关联到前一条 assistant 消息。
- 前端会话模态框新增「查看历史」tab：聊天气泡渲染（用户右蓝、AI 左灰、工具调用绿底），支持 Markdown 文本、分支标记和时间戳。
- 会话续接：创建会话时可通过 `resumeSessionId` + `forkSession` 参数从已有会话继续或分叉，CLI 参数映射为 `--resume` / `--fork-session`。
- 创建会话时将 prompt 作为 CLI 位置参数传入 Claude Code，保证提示词注入。
- 会话停止后终端使用只读 xterm.js（`disableStdin: true`）渲染 ANSI buffer，替代原来的 `<pre>` 标签，避免乱码。
- `resolveClaudeBinary()` 增加 nvm 路径候选和 `which claude` 命令回退，解决 CLAUDE_BIN 未找到问题。
- 共享类型新增 `SessionHistoryMessage`、`SessionHistoryMessageBlock`、`SessionHistoryResponse`。

### 关键修复
- 修复 `getSessionHistory` 泛型双重包装：`fetchJson<ApiResponse<SessionHistoryResponse>>` → `fetchJson<SessionHistoryResponse>`，前端 `res.ok` / `res.data.messages` → `data.messages`。根因：`fetchJson` 已解包 `ApiResponse`，再套一层导致前端取 `res.ok` 为 `undefined`，历史数据永不渲染。

### 验收记录
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- API 验证：`GET /api/projects/.../sessions/.../history` 返回 user/assistant 消息数组，包含 text 和 tool_use block。

## 2026-05-21：Phase 0 工程骨架首个切片

### 已完成
- 建立 pnpm monorepo：`apps/web`、`apps/api`、`packages/shared`。
- 搭建 React + TypeScript + Vite + Tailwind 前端骨架。
- 实现顶栏 + 中间内容区 + 右侧执行区的工作台布局。
- 实现右侧终端 / AI 聊天 / 会话输出 tab 切换占位。
- 搭建 Fastify API 服务。
- 实现 `/health`、`/api/meta`、`/api/projects`。
- 使用 `sql.js` 初始化本地 SQLite 数据库文件 `data/app.db`。
- 创建基础表：`migrations`、`projects`、`worktrees`、`notes`、`todos`、`skills`、`sessions`。
- 前端显示 API 连接状态、SQLite 初始化状态和 FTS5 探测结果。

### 技术调整
- 原计划使用 `better-sqlite3`，但本机 pnpm 阻止原生构建脚本后无法生成 native binding。
- 为保证 Phase 0 可运行和可验证，当前切换为纯 JS/WASM 的 `sql.js`。
- 当前 `sql.js` 环境下 FTS5 探测结果为不可用；后续若需要 FTS5，可在数据库层稳定后再评估恢复原生 SQLite 驱动。

### 验证记录
- `pnpm install`：通过。
- `pnpm -r typecheck`：通过。
- `pnpm -r build`：通过。
- API 验证：通过。
  - `GET http://localhost:3001/health` 返回 `ok: true`。
  - `GET http://localhost:3001/api/meta` 返回 Phase 0、数据库已连接、路径为 `data/app.db`。
  - `GET http://localhost:3001/api/projects` 返回空项目数组。
- 浏览器验证：通过。
  - 打开 `http://localhost:5173`。
  - 顶栏、中间内容区、右侧执行区存在。
  - 页面显示 `API 已连接`。
  - 右侧 tab 可从“终端”切换到“AI 聊天”和“会话输出”。
  - 浏览器控制台无错误，仅有 React DevTools 信息提示。

### 下一步
- Phase 1：实现项目 CRUD 和代码目录绑定。
- 增加项目列表与详情真实数据流。
- 为 worktree 管理预留 git 状态读取和分支删除前确认流程。
