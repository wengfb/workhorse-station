---
name: backend-project-worktree-rules
description: Backend rules for project-scoped worktrees and Claude Code session handling.
metadata:
  type: reference
---

# 后端与数据规则

- 项目是 worktree 的父级对象
- 每个项目下的 worktree 存放在该项目的 `.claude/worktree/` 目录中
- 基于任务启动会话时，可填写或选择已有 worktree 名称；不存在时再创建对应 worktree
- 删除 worktree 时必须同步删除对应的本地 git 分支
- 会话必须绑定项目、worktree、prompt、关联待办
- 笔记、待办、Skill、会话记录都要保留来源关联
- 结构化数据优先集中存储到 SQLite，附件和导入文件走文件系统
- 全文搜索优先考虑 SQLite FTS5
- API 优先使用 REST + SSE，终端交互再用 WebSocket

**Why:** worktree 是项目级执行上下文，删改必须和 git 状态一致。
**How to apply:** 任何涉及会话、worktree、分支、项目状态的改动都要先确认关联关系。