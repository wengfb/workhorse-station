# 技术选型说明

## 1. 总体原则
- 偏单用户、本地工作台
- 优先稳定、成熟、可维护
- 少框架化，多业务化
- 先做可落地的 MVP，再扩展能力

## 2. 前端技术栈
- **React + TypeScript + Vite**
  - 适合工作台式前端
  - 构建简单，开发体验好
- **Tailwind CSS + shadcn/ui / Radix UI**
  - 快速搭建一致的界面组件
  - 适合高密度管理界面
- **TanStack Query**
  - 管理服务端状态、缓存与刷新
- **Zustand**
  - 管理轻量本地状态
- **React Router**
  - 页面路由
- **xterm.js**
  - 终端面板
- **Monaco Editor**
  - prompt、skill、脚本编辑

## 3. 后端技术栈
- **Node.js + Fastify**
  - 轻量、性能好、适合 API + SSE + WS
- **SSE + WebSocket**
  - SSE：状态流、AI 流式输出
  - WebSocket：终端交互
- **Zod**
  - 请求参数校验
  - AI 输出结构校验
- **pino**
  - 日志

## 4. 数据层
- **SQLite 优先**
  - 适合单用户、本地集中式存储
  - 后续可平滑升级
- **文件系统**
  - 存放附件、导入文件、原始文档、截图
- **SQLite FTS5**
  - 起步阶段做全文搜索

## 5. AI 层
- **Claude SDK**
  - 作为聊天智能体主入口，负责对话、流式输出、工具调用
- **Zod**
  - AI 输出和工具参数校验
- **程序提供工具 / skill**
  - skill 管理、文件处理、待办生成、prompt 生成、worktree / 项目 / 笔记等业务逻辑都在程序层实现，再以 Claude SDK tools 方式暴露给模型调用
- **Vercel AI SDK（可选）**
  - 前端流式聊天体验

## 6. 文件处理
- **mammoth**：Word
- **exceljs**：Excel
- **pdf-parse**：PDF
- **tesseract.js**：图片 OCR
- 统一做成文档抽取管线，供 AI 聊天里的文件 skill 调用

## 7. 搜索方案
- 第一阶段：**SQLite FTS5**
- 后续数据量变大后，再考虑独立搜索引擎

## 8. 不建议的选型
- **Next.js**：对这个场景偏重
- **LangChain / CrewAI / AutoGen**：过重，容易把业务做复杂
- **ElasticSearch**：第一版成本高，收益不明显

## 9. 推荐最终组合
- 前端：React + Vite + TS + Tailwind + shadcn/ui + xterm.js
- 后端：Fastify + SSE / WS
- 桌面端：Electron（首版仅作为 Windows UI 壳，直接打开 `http://localhost:3001`）
- 存储：SQLite + 文件系统
- AI：Anthropic SDK + Zod + 自研轻量编排
- 搜索：SQLite FTS5

## 10. 双端运行策略
- 浏览器版继续作为主开发与 AI 调试入口
- Windows 桌面端首版不嵌入后端，不单独维护第二套前端
- 后端继续运行在 WSL 中，通过安装脚本和 systemd 用户服务常驻启动
- 浏览器版与桌面端统一通过 `http://localhost:3001` 访问同一套页面和 API
- 桌面端启动前先探测 `http://localhost:3001/health`，服务未就绪时显示重试页
