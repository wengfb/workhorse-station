# 开发计划：AI 开发管理 Web 软件

## 1. 项目目标
做一个单用户的开发管理工作台，围绕 **项目 / worktree / 笔记 / 待办 / Skill / AI 聊天 / Claude Code 会话** 形成闭环。

## 2. 参考项目结论
参考 Codeman 后，建议复用它的这些能力：
- PTY 会话管理
- SSE 实时推送
- 持久化状态存储
- 任务队列与 prompt 执行模型
- 右侧终端式工作台布局

需要重做或新增的能力：
- 项目与 worktree 一等公民
- 笔记系统
- 待办系统
- Skill 管理
- 通用 AI 聊天窗口
- AI 驱动的待办 / prompt 生成
- 文件处理标准 Skill（Excel / Word / PDF / 图片的导入、抽取、搜索、OCR、摘要）

## 3. MVP 范围
### 必做
- 项目管理
- worktree 管理
- 笔记管理（全局 / 项目）
- 待办管理
- Skill 管理
- 通用 AI 聊天窗口
- Claude Code 会话接入
- prompt 生成与编辑
- 右侧终端 / 聊天 / 会话面板

### 暂不做
- 多用户
- 权限系统
- 团队协作
- 复杂工作流引擎
- 代码语义索引
- 多模型调度
- 自主代理执行

## 4. 技术路线
### 风格原则
- 整体视觉与交互参考 Notion 的数据库页：列表/详情联动、属性化信息展示、清晰分区、低干扰
- 不使用左侧栏，保持顶栏 + 中间内容区 + 右侧执行区的工作台结构
- 以 Codeman 的服务结构为参考
- 提供 REST API + SSE
- 统一封装会话、笔记、待办、Skill、AI 服务
- 集中式存储（建议 SQLite 或轻量 JSON 起步，后续可切数据库）

### 前端
- 保留“主内容区 + 右侧工作区”的布局
- 右侧默认终端，可切换 AI 聊天 / 会话输出
- 中间区域承载项目、笔记、待办、Skill 的管理界面

### AI 层
- 统一 LLM Service
- 聊天智能体采用 Claude SDK 作为主入口：Claude 负责聊天、流式输出、工具调用；程序层提供 skill、文件处理、待办生成、prompt 生成等工具供其调用；如需更细的参数校验，使用 Zod
- 支持：
  - 生成待办草稿
  - 生成 Claude Code prompt
  - 生成笔记摘要
  - 聊天式交互
- 所有 AI 输出先生成草稿，再由用户确认落库

## 5. 开发阶段

### Phase 0：项目骨架
- [x] 初始化项目结构（pnpm monorepo，`apps/web`、`apps/api`、`packages/shared`）
- [x] 确定前后端目录划分
- [x] 接入基础配置和环境变量
- [x] 建立统一存储层（当前使用 `sql.js` 初始化 `data/app.db`，FTS5 后续再评估）
- [x] 建立日志与错误处理
- [x] 完成首个浏览器可验证工作台骨架：顶栏 + 中间内容区 + 右侧执行区
- [x] 验证记录见 `docs/dev-progress.md`

### Phase 1：项目与 worktree
- 项目 CRUD
- 代码目录绑定
- 项目级 worktree 管理（每个项目的 `.claude/worktree/` 下按名称保存）
- worktree 列表、选择、状态展示
- 基于任务启动会话时，可填写或选择已有 worktree 名称
- 删除 worktree 时同步删除对应的本地 git 分支
- 项目状态总览

### Phase 2：笔记与待办
- 笔记 CRUD
- 笔记标签与搜索
- 笔记转待办
- 待办状态、标签、来源关联

### Phase 3：Skill 系统
- 全局 Skill 管理
- 项目级 Skill 覆盖
- Skill 内容支持提示词 + 脚本 + 参数
- 文件处理标准 Skill（Excel / Word / PDF / 图片的导入、抽取、搜索、OCR、摘要）
- 在 prompt 生成中注入 Skill

### Phase 4：AI 聊天窗口
- 通用聊天入口
- 支持项目 / worktree 上下文注入
- 支持生成笔记 / 待办 / prompt
- 支持调用标准 Skill（包括文件处理 Skill）
- 支持一键发起 Claude Code 会话

### Phase 5：会话与终端
- 复用 PTY 会话能力
- 会话绑定项目 / worktree / prompt / 待办
- 保存会话记录与摘要
- 右侧终端与会话输出切换

### Phase 6：体验打磨
- 全局搜索
- 快速切换项目 / worktree
- 草稿历史
- 最近会话
- 状态总览面板

## 6. 关键数据模型
- Project
- Worktree
- Note
- Todo
- Skill
- PromptDraft
- AIChatSession
- ClaudeSession
- SessionLog

## 7. 关键交互主线
1. 选择项目 / worktree（worktree 隶属于项目，存放在项目 `.claude/worktree/` 下）
2. 记录笔记或打开 AI 聊天
3. AI 生成待办草稿
4. 待办生成 prompt 草稿
5. 用户修改 prompt
6. 发起 Claude Code 会话（可填写或选择已有 worktree 名称）
7. 保存会话结果与关联数据

## 8. 风险点
- worktree 与会话的绑定关系要清晰，且 worktree 归属到具体项目
- 删除 worktree 时要同步清理对应的本地 git 分支
- AI 输出必须可编辑，不能直接写入
- 存储设计要能支持后续扩展
- 终端与内容区并行时的状态同步要稳定
- 需要避免把功能做成另一个复杂的 agent 控制台

## 9. 第一版验收标准
- 能创建项目并绑定目录
- 能管理 worktree
- 能写笔记并转待办
- 能通过 AI 生成待办和 prompt
- 能发起 Claude Code 会话
- 能保存会话结果
- 界面上支持右侧终端/聊天切换
