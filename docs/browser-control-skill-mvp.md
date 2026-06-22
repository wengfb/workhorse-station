# 浏览器控制 Skill MVP

## 目标
- 在 WSL 内提供一个本地服务。
- 让 Windows Chromium 扩展主动连接这个服务。
- 让 Claude Code 通过项目级 skill 调用本地服务，控制用户已经打开的浏览器和当前登录态。

## 本轮范围
- 支持：
  - `status`
  - `list-tabs`
  - `activate-tab`
  - `snapshot`
  - `click`
  - `type`
  - `wait`
  - `extract`
- 不支持：
  - 任意 JS / selector / XPath
  - cookie / localStorage / sessionStorage 读取
  - 密码、验证码、支付类字段填写或读取
  - 文件上传下载
  - `chrome://`、`edge://`、扩展页、PDF viewer、跨域 iframe
  - 持久化和 Web UI 集成

## 链路
```text
Claude Code skill
  -> python3 ./.claude/skills/user-browser-control/scripts/browserctl.py
  -> http://127.0.0.1:8765
  -> ws://127.0.0.1:8765/ws
  -> Windows 浏览器扩展
  -> 当前 tab 的 content script
```

## 组件
### 1. 本地服务
路径：`./.claude/skills/user-browser-control/scripts/browser_service.mjs`

职责：
- 提供 HTTP API 给 `browserctl.py`
- 提供 WebSocket 给浏览器扩展
- 校验 token
- 缓存最近的 tab 列表
- 转发动作并等待扩展返回结果

### 2. 浏览器扩展
路径：`./.claude/skills/user-browser-control/extension/`

职责：
- 启动后主动连接本地服务
- 同步 tabs 信息
- 支持切换指定 tab
- 把动作转发给 content script
- 返回结果

### 3. Claude Code skill
路径：`./.claude/skills/user-browser-control/`

职责：
- 定义触发条件
- 约束标准工作流
- 通过 `browserctl.py` 调用本地服务

## 安全边界
- 本地服务只监听 `127.0.0.1`
- HTTP / WS 共用同一个 token
- 写操作必须带最近一次 `snapshot` 返回的 `snapshotId + ref`
- 不暴露 `eval`、任意 DOM 查询和存储读取接口
- content script 命中敏感字段时直接返回 `blocked_target`
- 页面明显变化后，旧 `snapshotId` 失效，需重新 `snapshot`

## 协议摘要
### HTTP
- `GET /health`
- `GET /status`
- `GET /tabs?scope=all|active`
- `POST /actions`

`POST /actions` 请求示例：

```json
{
  "action": "click",
  "tabId": 123,
  "snapshotId": "s_abc",
  "ref": "e12"
}
```

### WebSocket
扩展连到：
- `ws://127.0.0.1:8765/ws?token=<token>`

扩展 -> 服务：
- `hello`
- `tabs`
- `heartbeat`
- `action-result`

服务 -> 扩展：
- `action`

## 错误码
- `unauthorized`：token 错误或缺失
- `not_connected`：扩展未连接
- `tab_not_found`：目标 tab 不存在
- `stale_snapshot`：页面变化导致旧快照失效
- `blocked_target`：命中敏感字段或不允许的目标
- `unsupported_page`：当前页面类型不支持
- `timeout`：动作执行超时
- `bad_request`：参数不合法

## 安装
1. 选一个本地 token，例如 `browser-control-local-token`。
2. 在 WSL 启动服务：
   - `BROWSER_CONTROL_TOKEN=browser-control-local-token node ./.claude/skills/user-browser-control/scripts/browser_service.mjs`
3. 在 Windows Chrome/Edge 加载 `./.claude/skills/user-browser-control/extension` 为 unpacked extension。
4. 在扩展 options 中填：
   - WebSocket URL：`ws://127.0.0.1:8765/ws`
   - Token：同上
5. 在 WSL 验证：
   - `BROWSER_CONTROL_TOKEN=browser-control-local-token python3 ./.claude/skills/user-browser-control/scripts/browserctl.py status`

## 验证顺序
1. `status`
2. `list-tabs`
3. `activate-tab`
4. `snapshot`
5. `click`
6. `type`
7. `wait`
8. `extract`

## 使用限制
- 当前只适合单机自用。
- 当前只支持普通 `http/https` 页面。
- 当前只维护一个活动扩展连接；新连接会替换旧连接。
