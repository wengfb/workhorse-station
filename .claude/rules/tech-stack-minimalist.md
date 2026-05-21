---
name: tech-stack-minimalist
description: Minimal technology stack rules for the new project.
metadata:
  type: reference
---

# 技术栈规则

- 前端优先：React + TypeScript + Vite
- UI 组件优先：Tailwind CSS + shadcn/ui / Radix UI
- 状态管理：TanStack Query + Zustand
- 终端：xterm.js
- 编辑器：Monaco Editor
- 后端优先：Node.js + Fastify
- 通信：SSE + WebSocket
- 存储：SQLite + 文件系统
- 搜索：SQLite FTS5
- 文件处理：mammoth / exceljs / pdf-parse / tesseract.js
- AI：Claude SDK + Zod

- 不要一开始引入 Next.js、LangChain、CrewAI、AutoGen、ElasticSearch
- 不要为尚未确认的多模型场景提前搭复杂抽象

**Why:** 这是单用户工作台，先保证简单、稳定、可维护。
**How to apply:** 新增依赖前先看是否能用现有栈解决，避免重型框架。