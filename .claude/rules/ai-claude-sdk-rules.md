---
name: ai-claude-sdk-rules
description: AI and Claude SDK rules for tools, skills, and structured outputs.
metadata:
  type: reference
---

# AI 与 Claude SDK 规则

- Claude SDK 作为聊天智能体主入口
- Claude 负责聊天、流式输出、工具调用
- 程序层负责真逻辑：skill 管理、文件处理、待办生成、prompt 生成、项目 / worktree / 笔记数据
- 这些功能通过 tools 暴露给 Claude SDK 调用
- skill 以“提示词 + 参数 + 可选脚本/动作”的形式管理
- 文件处理标准 skill 负责 Excel / Word / PDF / 图片的导入、抽取、搜索、OCR、摘要
- 结构化输出优先使用 Zod 做校验
- AI 输出默认先作为草稿，不直接落库

**Why:** 这样既能用上 Claude SDK 的现成能力，又不把业务逻辑锁进 SDK。
**How to apply:** 编写聊天、skill、文件处理或待办生成逻辑时，优先把能力封装成可调用工具，而不是塞进 prompt 里。