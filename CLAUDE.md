# AI 开发管理 Web 软件

## 项目背景
这是一个基于 Codeman 思路的单用户开发管理 Web 软件，围绕 **项目 / worktree / 笔记 / 待办 / Skill / AI 聊天 / Claude Code 会话** 形成闭环。Codeman 只是参考项目，用来借鉴它的 PTY 会话、SSE、终端交互、会话持久化等能力。

## 文档索引
- `./CLAUDE.md`：当前项目的协作约定、设计原则、技术路线
- `./docs/dev-management-plan.md`：整体开发计划、阶段拆分、参考 Codeman 的结论
- `./docs/dev-management-prototype.md`：原型阶段的页面布局和交互草图
- `./docs/dev-management-mvp.md`：MVP 范围、核心功能和验收标准
- `./docs/dev-management-tech-stack.md`：技术选型说明和方案取舍
- `./docs/dev-progress.md`：实际开发进度、阶段结论和验收记录
- `./Codeman/`：参考项目本体，当前项目只借鉴其实现思路，不直接把它当成本项目

## 设计约定
- 整体视觉与交互参考 Notion 的数据库页：列表/详情联动、属性化信息展示、清晰分区、低干扰
- 不使用左侧栏，首页采用顶部导航 + 主内容区的全局工作台结构
- 顶栏将聊天 / 概览拆成独立菜单项；项目入口只通过项目下拉进入，不单独展示项目菜单项和 Worktree 按钮
- 顶栏提供项目下拉：展示项目列表，每个项目右侧提供进入项目页的小按钮，列表末尾提供添加项目入口
- 聊天首页采用类似 ChatGPT 的结构：左侧是独立贴边的聊天会话列表，右侧是占满剩余空间的聊天区；聊天内容和输入框最大宽度 768px，并在右侧区域居中；聊天会话与 Claude Code 会话区分管理
- 聊天输入框保持简单，仅包含输入、发送和文件选择；生成笔记、待办、提示词等能力作为默认 Skill，不作为主界面按钮
- 概览承载全局笔记、全局 Skill、最近项目、最近会话等管理入口
- Skill 管理以真实文件夹为准：全局 Skill 来自 `~/.claude/skills/*`，项目 Skill 来自项目 `.claude/skills/*`，名称等于文件夹名
- 进入具体项目后，再显示项目级顶部导航：总览 / 待办 / 笔记 / Skill / 会话 / Worktree
- 终端不作为全局固定右侧栏；选中或创建 Claude Code 会话后，通过可关闭的大模态框打开
- 会话模态框在 PC 上采用 3:7 左右布局：左侧会话列表/信息，右侧操作终端或会话历史；移动端使用全屏单列
- 关闭会话模态框只表示后台运行，不代表停止会话；停止会话必须是明确操作
- 创建 Claude Code 会话支持直接创建，也支持从待办事项创建
- 编辑、新建、删除确认等表单型操作优先使用模态框或移动端抽屉
- worktree 归属到具体项目，存放在项目 `.claude/worktree/` 下
- 删除 worktree 时同步删除对应的本地 git 分支
- 所有 AI 输出先作为草稿，再由用户确认落库

## 技术路线
- 前端：React + TypeScript + Vite + Tailwind + shadcn/ui + xterm.js
- 后端：Node.js + Fastify + SSE / WebSocket
- 存储：SQLite + 文件系统
- AI：Claude SDK 为主，程序层提供 tools/skill，Zod 负责参数和结构校验
- 搜索：SQLite FTS5

## AI 约定
- Claude SDK 负责聊天、流式输出、工具调用
- skill、文件处理、待办生成、prompt 生成、项目 / worktree / 笔记逻辑都在程序层实现，再通过 tools 暴露给 Claude SDK 调用
- Skill 管理只负责发现和操作整个文件夹；工作台内只直接编辑 Skill 目录下的 `SKILL.md` 文档，不解析或复制其他提示词、脚本、参数等内容
- 文件处理标准 skill 负责 Excel / Word / PDF / 图片的导入、抽取、搜索、OCR、摘要

## 工作方式
- 先完成 MVP，再做体验打磨
- 不要引入重型 agent 框架或多模型调度，除非需求明确要求
- 代码修改前先读相关文件，遵循现有约定
- 新功能优先补文档，再实现
- 用户明确要求提交时，允许直接在默认分支上执行，不需要先创建分支，除非有明确要求
