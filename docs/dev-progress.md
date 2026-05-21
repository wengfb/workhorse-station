# 开发进度

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
