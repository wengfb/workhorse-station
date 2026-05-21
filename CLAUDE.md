# AI 开发管理 Web 软件

## 项目背景
这是一个基于 Codeman 思路的单用户开发管理 Web 软件，围绕 **项目 / worktree / 笔记 / 待办 / Skill / AI 聊天 / Claude Code 会话** 形成闭环。Codeman 只是参考项目，用来借鉴它的 PTY 会话、SSE、终端工作台等能力。

## 文档索引
- `./CLAUDE.md`：当前项目的协作约定、设计原则、技术路线
- `./dev-management-plan.md`：整体开发计划、阶段拆分、参考 Codeman 的结论
- `./dev-management-prototype.md`：原型阶段的页面布局和交互草图
- `./dev-management-mvp.md`：MVP 范围、核心功能和验收标准
- `./dev-management-tech-stack.md`：技术选型说明和方案取舍
- `./Codeman/`：参考项目本体，当前项目只借鉴其实现思路，不直接把它当成本项目

## 设计约定
- 整体视觉与交互参考 Notion 的数据库页：列表/详情联动、属性化信息展示、清晰分区、低干扰
- 不使用左侧栏，保持顶栏 + 中间内容区 + 右侧执行区的工作台结构
- 右侧默认终端，可切换 AI 聊天 / 会话输出
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
- 文件处理标准 skill 负责 Excel / Word / PDF / 图片的导入、抽取、搜索、OCR、摘要

## 工作方式
- 先完成 MVP，再做体验打磨
- 不要引入重型 agent 框架或多模型调度，除非需求明确要求
- 代码修改前先读相关文件，遵循现有约定
- 新功能优先补文档，再实现


