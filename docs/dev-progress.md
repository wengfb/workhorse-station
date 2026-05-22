# 开发进度

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
- Phase 1 仍有两项未完成：
  - 基于任务启动会话时，可填写或选择已有 worktree 名称。
  - 完整的项目状态总览。

### 原因说明
- 上述未完成项都依赖真实 Claude Code 会话 / PTY / 会话持久化或更完整的数据面板。
- 当前仓库仍未接入真实 Claude Code PTY 与会话后端，因此先在文档中明确阶段边界，再进入 Phase 2。

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
