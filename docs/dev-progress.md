# 开发进度

## 2026-05-21：UI 信息架构方向调整

### 目标
- 支持 PC 和移动版，不再强制桌面固定宽度。
- 首页改为全局工作台，左上角下拉仅切换聊天 / 概览。
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
- 当前切片先调整文档和前端占位 UI，不实现真实 Claude Code PTY、待办后端或会话持久化。


## 2026-05-21：Phase 1 worktree 管理

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
