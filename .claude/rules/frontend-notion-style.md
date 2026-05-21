---
name: frontend-notion-style
description: Frontend and UI rules for the Notion-like workbench layout.
metadata:
  type: reference
---

# 前端与 UI 规则

- 整体风格参考 Notion 的数据库页：列表/详情联动、属性化信息展示、清晰分区、低干扰
- 不使用左侧栏
- 采用顶栏 + 中间内容区 + 右侧执行区的工作台结构
- 右侧默认终端，可切换 AI 聊天 / 会话输出
- 中间区域承载项目、笔记、待办、Skill 的管理界面
- 列表页优先支持筛选、搜索、排序、状态标签
- 详情页优先支持属性编辑、关联关系、草稿确认
- 深色优先，高对比、少动效、强调状态
- 需要终端、聊天、详情并行时，优先保持当前上下文不被打断

**Why:** 这个产品更像开发工作台，不是传统后台。
**How to apply:** 所有页面设计都先问自己是否保留了列表/详情联动和右侧执行区。