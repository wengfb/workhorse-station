# Codex 支持接入方案

更新时间：2026-06-18 18:25:00 CST

## 1. 目标

在不破坏现有 Claude Code 能力的前提下，为 Workhorse Station 增加 Codex 支持，并把当前“单一 Claude 执行链路”演进为“多 Provider 执行架构”。

本方案强调两点：
- 第一，不直接替换现有 Claude 能力，而是并列接入 Codex。
- 第二，优先完成可落地的最小闭环，再逐步补齐 Codex 原生能力，例如 `AGENTS.md`、`.agents/skills`、`.codex/config.toml` 等。

## 2. 背景与现状

当前项目已经具备较完整的 Claude Code 会话闭环，但核心实现仍然是以 Claude 为唯一执行器进行设计。

### 2.1 当前已具备的能力

- 已有会话创建、运行、停止、续接、历史查看与终端快照能力。
- 已有项目、worktree、prompt draft、todo、skills、memory 等围绕会话展开的业务模型。
- 已有 Web UI、API、PTY、终端流式输出、结果持久化等基础设施。

### 2.2 当前与 Codex 接入直接相关的耦合点

#### 会话执行器写死为 Claude

- Claude 二进制定位在 [apps/api/src/sessions/claude-cli.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/claude-cli.ts:27)。
- 会话运行时直接调用 `resolveClaudeBinary()`，见 [apps/api/src/sessions/session-runtime-manager.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/session-runtime-manager.ts:75)。
- Claude 启动参数由 `buildClaudeArgs()` 直接拼接，见 [apps/api/src/sessions/session-runtime-manager.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/session-runtime-manager.ts:308)。

#### 会话数据模型没有 Provider 抽象

- `sessions` 表当前只有项目、worktree、todo、prompt、runtime 状态等字段，没有 `provider`、`provider_thread_id`、`provider_metadata` 等字段，见 [apps/api/src/db/schema.ts](/home/wengfb/code/workhorse-station/apps/api/src/db/schema.ts:93)。
- 共享类型 `SessionSource`、`SessionListItem`、`SessionSummary` 也没有 Provider 维度，见 [packages/shared/src/index.ts](/home/wengfb/code/workhorse-station/packages/shared/src/index.ts:354)。

#### Skill / Memory / 指令目录偏向 Claude

- Skill Store 安装目标仍然是 `claude-code` / `claude-code-project` / `chat`，见 [packages/shared/src/index.ts](/home/wengfb/code/workhorse-station/packages/shared/src/index.ts:208)。
- Skill 根目录默认写死为 `~/.claude/skills` 和 `<project>/.claude/skills`，见 [apps/api/src/skills/skill-store.ts](/home/wengfb/code/workhorse-station/apps/api/src/skills/skill-store.ts:17)。
- Memory / 指令文件当前围绕 `CLAUDE.md` 和 `.claude/rules` 设计，见 [apps/api/src/memory/memory-fs.ts](/home/wengfb/code/workhorse-station/apps/api/src/memory/memory-fs.ts:10)。

#### 前端文案与交互也默认只有 Claude

- 会话页、会话创建弹窗、概览文案均以“Claude Code 会话”为唯一概念，见 [apps/web/src/session-ui.tsx](/home/wengfb/code/workhorse-station/apps/web/src/session-ui.tsx:97)。

#### 会话历史恢复逻辑绑定 Claude 本地目录结构

- 当前历史解析走 `~/.claude/projects/<slug>/<sessionId>.jsonl`，见 [apps/api/src/sessions/session-routes.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/session-routes.ts:773)。

## 3. 设计原则

### 3.1 不替换，先并列

第一阶段不移除或弱化现有 Claude 能力。Codex 作为新 Provider 并列接入，避免一次性大重构带来回归风险。

### 3.2 先抽象执行层，再接入 Codex

不要在现有 Claude 代码上继续堆条件分支，例如 `if provider === "codex"`。应先抽象会话 Provider 适配层，再把 Claude 挪进去，最后增加 Codex 实现。

### 3.3 优先复用现有 PTY 会话能力

短期内优先复用现有 PTY、WebSocket、buffer 持久化、停止/续接/resize 机制，只替换“启动哪个可执行程序、带哪些参数、如何解析历史”的部分。

### 3.4 先做 CLI Provider，再看是否引入更深集成

Codex 官方支持多种接入面：
- Codex CLI
- Codex app-server
- Codex SDK
- Codex MCP server

对当前项目来说，第一版最短路径是 Codex CLI Provider。后续如果要更细粒度的线程、审批、工具调用结构化事件，再考虑 app-server 或 SDK。

## 4. 官方能力边界摘要

本方案基于 2026-06-18 拉取的 Codex 官方手册整理。与当前项目最相关的结论如下：

- Codex 的持久项目指令核心是 `AGENTS.md`，并且会按目录层级发现和合并。
- Codex repo 级 skills 目录是 `.agents/skills`，用户级 skills 目录是 `$HOME/.agents/skills`。
- Codex 支持项目级和用户级 `.codex/config.toml` 配置，可配置 MCP、权限、模型等。
- Codex 有官方 `worktree` 使用方式，适合并行任务隔离。
- 深度产品集成推荐 `codex app-server`。
- 程序化调用推荐 `Codex SDK`。

说明：以上结论来自 `https://developers.openai.com/codex/codex-manual.md`。

补充说明：

- 上述 `.agents/skills` / `$HOME/.agents/skills` 是 Codex 官方文档中的原生 skills 发现路径。
- 当前这台机器上的 Codex 运行环境同时存在 `~/.codex/skills`，其中承载的是 Codex 当前会话框架下安装的本地 skill 包。
- 因此在 Workhorse Station 的 Phase C 设计中，需要把“Codex 官方原生 skills 目录”和“本地现有 skill 包目录”区分处理，不能直接把两者视为同一概念。

## 5. 总体方案

### 5.1 目标架构

将现有“Claude 专用会话系统”演进为“多 Provider 会话系统”。

建议增加以下抽象：

- `AgentProvider`
  - 标识会话由哪个执行器承载。
  - 初始值：`"claude" | "codex"`。

- `SessionProviderAdapter`
  - 负责 Provider 的二进制定位、启动参数、恢复参数、历史解析和能力声明。

- `SessionProviderRegistry`
  - 负责根据 `provider` 找到对应适配器。

- `ProviderAwareMemory`
  - 根据 Provider 决定指令文件和技能目录的来源。

### 5.2 推荐的分层

#### 公共层，继续复用

- 会话数据库记录
- PTY 进程生命周期
- WebSocket 推流
- buffer 持久化
- stop / resize / input
- 项目、worktree、todo、promptDraft 业务关联

#### Provider 适配层，新增

- 查找二进制
- 组装 CLI 参数
- resume / fork 策略
- 解析本地历史记录
- 暴露 provider 元数据

#### Provider 资源层，逐步补齐

- Claude：`CLAUDE.md`、`.claude/skills`
- Codex：`AGENTS.md`、`.agents/skills`、`.codex/config.toml`

## 6. 分阶段实施方案

### Phase A：方案与抽象落地

目标：把会话系统从“Claude 专用”改造成“支持多 Provider 的骨架”，但暂时不启用 Codex。

任务：

- 新增共享类型：
  - `AgentProvider = "claude" | "codex"`
  - 会话实体、执行列表实体增加 `provider`
- 数据库 `sessions` 表新增字段：
  - `provider VARCHAR(64) NOT NULL DEFAULT 'claude'`
  - `provider_thread_id VARCHAR(255) NULL`
  - `provider_metadata_json LONGTEXT NULL`
- 后端新增 `SessionProviderAdapter` 接口
- 将现有 Claude 启动逻辑从 `SessionRuntimeManager` 中抽离到 `ClaudeSessionProvider`
- 将现有 Claude 历史解析逻辑抽离到 Provider 层
- 前端会话列表、会话详情、执行列表支持展示 provider 标识

验收标准：

- 不启用 Codex 的情况下，现有 Claude 会话功能保持不变。
- 数据库迁移后，旧数据能正常读取，默认 provider 为 `claude`。
- 会话创建、执行列表、概览页开始具备 Provider 展示能力。

### Phase B：Codex CLI Provider 最小可用版

目标：在现有会话系统中新增 Codex 会话，复用 PTY 和前端会话体验。

任务：

- 新增 `apps/api/src/sessions/codex-cli.ts`
  - 负责查找 `codex` 可执行文件
  - 支持环境变量覆盖，例如 `CODEX_BIN`
- 新增 `CodexSessionProvider`
  - 实现 binary resolve
  - 实现 start args build
  - 实现 continue / resume args build
  - 实现本地历史解析
- 会话创建接口支持传入 `provider`
- 会话续接逻辑根据 `provider` 走不同恢复策略
- 前端创建会话弹窗增加“执行器”选择：
  - Claude
  - Codex
- 前端列表卡片增加 Provider Pill

验收标准：

- 可以在项目内新建 Codex 会话。
- 可以查看 Codex 终端输出。
- 可以停止 Codex 会话。
- 可以继续 Codex 会话，前提是已成功解析出 Codex 真实线程 ID。

当前实现状态（2026-06-18）：

- 已完成 Provider 抽象、数据库字段、前端执行器选择、Codex CLI 启动、Codex 历史日志解析。
- 已补齐会话创建请求中的 `provider` 透传。
- 已补齐 Codex 会话继续时的保护逻辑：如果真实线程 ID 尚未落盘，不再错误回退到 Workhorse 自己的 `session.id`。
- 仍未完成 Skill Store、Memory、Rules 面板对 Codex 原生目录的适配。

### Phase C：Codex 指令与 Skill 体系适配

目标：让项目中的 Skill / Memory / 指令体系不再只服务 Claude，也能对 Codex 生效。

任务：

- 重新定义“Memory”面板职责，拆分为更准确的概念：
  - 全局指令
  - 项目指令
  - 项目规则
- Claude 路径保持兼容：
  - 全局：`~/.claude/CLAUDE.md`
  - 项目：`<project>/CLAUDE.md`
  - 规则：`<project>/.claude/rules`
- Codex 路径新增：
  - 全局：`~/.codex/AGENTS.md`
  - 项目：`<project>/AGENTS.md`
  - Repo Skill：`<project>/.agents/skills`
  - User Skill：`$HOME/.agents/skills`
- Skill Store 安装目标从当前固定值升级为多 Provider 目标，例如：
  - `claude-global`
  - `claude-project`
  - `codex-global`
  - `codex-project`
  - `chat`
- 前端 Skill 管理区增加 Provider 维度

验收标准：

- 可以分别查看和编辑 Claude / Codex 的全局与项目指令来源。
- 可以把 Skill 安装到 Codex 对应目录。

实现建议：

- Phase C 不要直接复用现有 `claude-code` / `claude-code-project` 安装目标语义。
- 需要先明确 Workhorse Station 中“Codex 原生 skills 安装目标”与“本机本地 skill 包目录”的产品定义，再决定 Skill Store 的目标枚举和落盘路径。

当前实现状态（2026-06-18）：

- 已完成 Skill Store 目标枚举升级：
  - `claude-global`
  - `claude-project`
  - `codex-global`
  - `codex-project`
  - `chat`
- 已完成 Codex 原生 skills 路径接入：
  - 全局：`$HOME/.agents/skills`
  - 项目：`<project>/.agents/skills`
- 已完成全局/项目指令文件的 provider-aware API 与前端切换：
  - Claude：`CLAUDE.md`
  - Codex：`AGENTS.md`
- 已明确规则文件与自动记忆的当前边界：
  - Claude 继续使用 `.claude/rules` 与 `~/.claude/projects/.../memory`
  - Codex 暂不伪造 rules / memory 的等价目录，前后端均以只读提示方式呈现
- 尚未完成浏览器层面的完整手工回归验证，尤其是工作台里切换项目后 Skill Store 项目安装状态的可视化确认。

### Phase D：Codex 原生能力增强

目标：在最小可用版之上，逐步接近 Codex 原生工作方式。

可选任务：

- 新增 `.codex/config.toml` 的查看与编辑入口
- 支持为项目配置 Codex MCP
- 支持展示 Codex 推荐的 repo 指令发现方式
- 若 CLI 输出事件粒度不够，评估切换到 `codex app-server`
- 若后续要做自动化流水线或多代理调度，评估接入 `Codex SDK`

验收标准：

- 对需要更强结构化控制的场景，有明确升级路径，而不是继续在 CLI 适配层堆积特例。

## 7. 详细任务拆分

### 7.1 数据库与共享类型

任务：

- 更新 [apps/api/src/db/schema.ts](/home/wengfb/code/workhorse-station/apps/api/src/db/schema.ts:93)
- 增加 `sessions.provider`
- 增加 `sessions.provider_thread_id`
- 增加 `sessions.provider_metadata_json`
- 更新 [packages/shared/src/index.ts](/home/wengfb/code/workhorse-station/packages/shared/src/index.ts:354)
- 新增 `AgentProvider`
- 更新 `SessionListItem` / `SessionSummary` / `ExecutionListItem`

输出：

- 数据结构支持多 Provider 会话

### 7.2 后端执行层重构

任务：

- 新增 `session-provider.ts`
  - 定义适配器接口
- 新增 `session-provider-registry.ts`
  - 注册 Claude 与 Codex Provider
- 改造 [apps/api/src/sessions/session-runtime-manager.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/session-runtime-manager.ts:64)
  - `startSession()` 接收 provider
  - 不再直接依赖 `resolveClaudeBinary()`
- 改造 [apps/api/src/sessions/session-routes.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/session-routes.ts:98)
  - 创建会话时写入 provider
  - 继续会话时按 provider 恢复

输出：

- 后端会话运行逻辑不再与 Claude 硬编码绑定

### 7.3 Claude Provider 收口

任务：

- 保留 [apps/api/src/sessions/claude-cli.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/claude-cli.ts:27)
- 把 Claude 参数拼接逻辑从 [apps/api/src/sessions/session-runtime-manager.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/session-runtime-manager.ts:308) 挪出
- 把 Claude 历史解析逻辑从 [apps/api/src/sessions/session-routes.ts](/home/wengfb/code/workhorse-station/apps/api/src/sessions/session-routes.ts:773) 挪到 Claude Provider

输出：

- Claude 成为“一个 Provider 实现”，而不是系统默认内核

### 7.4 Codex Provider 新增

任务：

- 新增 `codex-cli.ts`
- 新增 `codex-session-provider.ts`
- 支持：
  - binary resolve
  - 启动参数
  - 恢复参数
  - 历史解析
  - provider thread id 持久化

风险提示：

- Codex CLI 的本地历史文件位置、resume 参数、线程 ID 暴露方式需要在实现阶段做实机验证。
- 如果 CLI 恢复语义与 Claude 差异较大，需要单独定义 `continue` 行为，不应强行套用 Claude 模型。

### 7.5 指令与 Skill 体系改造

任务：

- 改造 [apps/api/src/memory/memory-fs.ts](/home/wengfb/code/workhorse-station/apps/api/src/memory/memory-fs.ts:10)
- 抽出 provider-aware 路径解析器
- 改造 [apps/api/src/skills/skill-store.ts](/home/wengfb/code/workhorse-station/apps/api/src/skills/skill-store.ts:17)
- 更新 [packages/shared/src/index.ts](/home/wengfb/code/workhorse-station/packages/shared/src/index.ts:208)
  - 废弃当前 `claude-code` / `claude-code-project` 命名
  - 引入更清晰的目标枚举

输出：

- Skill 和指令管理不再只面向 Claude

### 7.6 前端交互改造

任务：

- 改造 [apps/web/src/session-ui.tsx](/home/wengfb/code/workhorse-station/apps/web/src/session-ui.tsx:97)
  - “Claude Code 会话”升级为“AI 执行会话”或“代码会话”
  - 创建弹窗增加 Provider 选择
  - 会话卡片增加 Provider 标识
- 改造会话列表、历史、执行列表、概览页相关文案
- Skill 安装面板增加 Codex 目标按钮
- Memory 面板支持切换 Claude / Codex 指令来源

输出：

- 用户可显式选择 Claude 或 Codex 创建会话

## 8. 风险与取舍

### 8.1 最大风险不是技术接入，而是模型抽象不够

如果不先做 Provider 抽象，直接在现有 Claude 代码里加 Codex 分支，后续会快速失控：

- 会话创建流程出现大量条件判断
- 历史解析逻辑被拆散
- Skill / Memory 路径规则更加混乱
- UI 文案持续混用 Claude / Codex 概念

### 8.2 不建议第一版直接上 app-server

原因：

- 当前项目已经有一整套 PTY 终端和会话流机制
- 先复用现有机制的改造成本最低
- app-server 更适合做深度产品集成，不适合作为第一步验证

### 8.3 不建议继续把 Codex 硬映射到 Claude 概念

典型误区：

- 用 `CLAUDE.md` 兼容 Codex 指令
- 把 `.claude/skills` 直接当作 Codex 的技能目录
- 把所有会话都继续称为 Claude 会话

这样短期省事，但后面会阻碍真正的 Codex 原生能力落地。

## 9. 推荐实施顺序

建议严格按下面顺序推进：

1. 先完成数据模型与 Provider 抽象。
2. 把 Claude 收口成 Provider。
3. 再新增 Codex CLI Provider。
4. 再改前端会话选择与展示。
5. 再扩展 Skill / AGENTS / Memory 面板。
6. 最后再评估 app-server / SDK 深度集成。

## 10. 第一阶段验收口径

第一阶段指“支持 Codex 最小会话能力”的验收口径如下：

- 用户可以在创建会话时选择 `Claude` 或 `Codex`
- 所选 Provider 会被持久化到会话记录
- Claude 会话能力不回归
- Codex 会话可以启动、看到终端输出、停止
- 会话列表和执行列表能清楚区分 Provider
- 文档与 UI 中不再把所有会话统一称为 Claude 会话

## 11. 当前实现与联调结果

截至 2026-06-18，Phase A 与 Phase B 的核心链路已在当前仓库完成并完成实机联调，方案不再只是设计稿。

### 11.1 已完成实现

- 会话数据模型已增加 `provider`、`provider_thread_id`、`provider_metadata`。
- 后端已完成多 Provider 抽象，Claude 与 Codex 都通过统一 Provider 接口接入。
- 已新增 Codex CLI Provider，并支持：
  - 启动会话
  - 继续会话
  - 从本地 `~/.codex/sessions/**/*.jsonl` 扫描并回填真实线程 ID
  - 按 Provider 解析历史消息
- 前端创建会话弹窗已支持选择 `Claude` / `Codex`。
- 会话列表、历史与相关文案已去除“所有会话都默认是 Claude 会话”的假设。

### 11.2 联调环境说明

- 当前仓库 API 联调使用 `3002` 端口。
- `3001` 上存在另一套旧服务，不能用于本次 Codex 验证。
- 数据库已使用项目环境变量中的 MySQL 配置完成连接验证。

本次使用的 API 启动方式：

```bash
MYSQL_HOST=g3-3579 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=113811 MYSQL_DATABASE=workhorse_station API_PORT=3002 LOG_LEVEL=info pnpm --filter @workhorse-station/api dev
```

### 11.3 已验证能力

#### 1）创建 Codex 会话

已验证可以创建 `provider=codex` 的真实会话，并正确回填 `provider_thread_id`。

示例：

- `projectId = f07eb312-d379-4968-8a5d-7e8e52ae2ddf`
- `sessionId = 66ea5433-24bf-4baa-9a53-4f64a505d803`
- `providerThreadId = 019eda07-a050-73e3-a844-2c34812d5411`

#### 2）历史读取

已验证 `/history` 能按 Codex 日志正确解析用户消息与助手消息。

首轮验证结果：

- user: `请先输出一行 CODEx smoke test，然后等待进一步指令。`
- assistant: `CODEx smoke test`

#### 3）继续会话

已验证对已停止的 Codex 会话调用 `/continue` 后：

- Provider 仍为 `codex`
- 恢复使用的仍是原始 `provider_thread_id`
- 会话能重新进入 `running`
- 数据库中的 `provider_thread_id` 不会被错误覆盖

#### 4）继续后的二次对话

已验证 `continue` 后继续发送新消息，Codex 会在同一线程中产生新一轮对话。

验证结果：

- user: `这是 continue 后的联调消息。请只回复一行 CONTINUE_OK。`
- assistant: `CONTINUE_OK`

并且 `/history` 最终已返回完整四条消息：

- 初始 user
- 初始 assistant
- continue 后 user
- continue 后 assistant

### 11.4 一个实现细节

会话输入接口 `/input` 透传的是原始 PTY 字节流，而不是高级消息协议。

这意味着：

- 通过 API 直接驱动终端时，要发送终端真实按键数据
- 回车提交应使用终端语义的 `\\r`
- 如果只写入文本但没有发送正确的回车字节，内容会停留在 Codex TUI 输入框中，而不会真正提交

这个行为本身是合理的，因为前端终端就是把 xterm 的 `onData` 原样透传给后端。

### 11.5 当前结论

“Codex 最小会话闭环”已经在当前仓库跑通，至少包括：

- 创建
- 输出
- 停止
- 继续
- 继续后的继续对话
- 历史解析

剩余工作更偏向产品化完善，而不是底层可用性验证，包括：

- 补做前端界面层面的联调回归
- 继续清理残留 Claude 专属文案
- 按需扩展 `AGENTS.md` / `.agents/skills` / `.codex/config.toml` 的管理能力

## 12. 后续执行建议

如果按当前项目节奏推进，建议下一步直接开一个“Phase A + Phase B”的实现任务，优先完成：

- 数据库字段补齐
- Provider 接口抽象
- Claude Provider 收口
- Codex CLI Provider 最小跑通
- 创建会话弹窗增加 Provider 选择

这些核心项目前已经完成，下一步更建议聚焦下面三类收尾：

- 前端完整联调与回归验证
- Codex 指令与 Skill 目录的产品化管理
- 基于真实使用场景补齐 Provider 级体验差异
