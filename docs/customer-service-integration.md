# 客服系统与转化池接口模型

## 固定架构

客服系统连接在后台全局管理，具体使用关系由各业务分区的转化池决定。

```text
客服管理
├─ 客服系统 A
├─ 客服系统 B
└─ 客服系统 C

业务分区 / 转化池
├─ 在线客服分组 → 选择客服系统 → 读取并绑定远程客服分组
└─ 链接跳转分组 → 直接维护 URL
```

同一个客服系统可以被多个业务分区复用；不同业务分区也可以选择完全不同的客服系统。

## 接入原则

默认接入方式为 `generic_rest_v2`，目标是覆盖绝大多数 HTTPS + REST + JSON 客服系统，同时尽量减少后台需要填写的字段。

普通连接默认只填写：

- 连接名称
- HTTPS API 地址
- 认证方式
- Token / API Key（无需认证时不填）
- 启用状态

高级映射默认折叠。只有第三方接口结构与默认约定不同，才需要配置分组路径、字段映射或会话入口方式。

旧版 `generic_v1` 继续兼容，不要求迁移已有连接。

API Token / API Key 为只写凭证，后台读取连接时只返回 `hasApiToken`，不返回原文。客服连接和高级配置不得进入 R2 前台快照。

## generic_rest_v2 默认行为

默认分组请求：

```http
GET {baseUrl}/groups
Accept: application/json
Authorization: Bearer <token>
```

默认会自动识别常见列表位置：

```text
根数组
groups
items
results
data
teams
departments
data.groups
data.items
data.results
data.teams
data.departments
```

默认会自动识别常见 ID 字段：

```text
id
_id
uuid
groupId
group_id
teamId
team_id
departmentId
department_id
```

默认会自动识别常见名称字段：

```text
name
title
displayName
display_name
label
```

默认会自动识别 `isEnabled / is_enabled / enabled / active / status` 等状态字段；缺少状态字段时按启用处理。

因此符合常见 REST/JSON 结构的客服系统通常不需要填写字段映射。

## 支持的认证方式

`generic_rest_v2` 支持：

- Bearer Token / OAuth Access Token
- API Key Header
- HTTP Basic Auth
- 无认证

OAuth 授权流程本身不由当前后台代办；如果第三方平台已经提供 Access Token，可直接按 Bearer Token 使用。以后需要正式 OAuth Authorization Code 时可在 provider 层扩展，不改变转化池数据模型。

API Key Header 的 Header 名称可以在后台填写，例如 `X-API-Key`。Basic Auth 的用户名可配置，密码/API Key 继续存放在只写凭证字段中。

## 项目 / 工作区 Header

部分客服系统需要额外项目、站点或工作区 ID。该能力放在高级设置中：

```text
projectId
projectHeaderName
```

只有同时配置两者时，Worker 才发送对应 Header；默认不会给所有第三方接口强行附加 `X-Project-Id`。

## 分组字段映射

如果自动识别失败，可以在高级设置中显式填写：

```text
groups.path        分组接口相对路径
groups.itemsPath   列表路径
groups.idPath      ID 字段
groups.namePath    名称字段
groups.enabledPath 状态字段
```

例如第三方返回：

```json
{
  "data": {
    "teams": [
      {
        "team_id": 12,
        "title": "Sales",
        "status": "active"
      }
    ]
  }
}
```

可以配置：

```text
groups.path        /v2/teams
groups.itemsPath   data.teams
groups.idPath      team_id
groups.namePath    title
groups.enabledPath status
```

Worker 最终统一归一化为：

```json
{
  "id": "12",
  "name": "Sales",
  "isEnabled": true
}
```

转化池只依赖这个内部统一模型，不依赖第三方平台自己的字段命名。

## 会话入口

在线客服 CTA 最终仍由 `/go/:code` 经过 Worker 解析，因此连接必须能够把远程分组解析成一个 HTTP/HTTPS 会话入口。

默认方式是请求接口：

```http
POST {baseUrl}/groups/{groupId}/entry
Content-Type: application/json
```

默认请求体：

```json
{
  "requestId": "...",
  "productId": "...",
  "sectionId": "..."
}
```

默认自动识别返回中的：

```text
url
entryUrl
entry_url
chatUrl
chat_url
link
href
data.url
data.entryUrl
data.entry_url
```

高级设置可以修改请求方法、相对路径和 URL 字段。

如果第三方客服不提供“创建会话入口”API，但客服链接可以通过分组 ID 拼接，也可以改成 URL 模板模式：

```text
https://chat.example.com/start?group={groupId}
```

这种模式不需要额外向第三方 API 请求会话入口。

## generic_v1 兼容模式

旧版连接继续使用原约定：

```http
GET {baseUrl}/groups
Authorization: Bearer <token>
X-Project-Id: <projectId>
```

以及：

```http
POST {baseUrl}/groups/{groupId}/entry
```

返回固定使用：

```json
{
  "url": "https://support.example.com/session/..."
}
```

旧连接保持原行为，不需要为了升级 `generic_rest_v2` 修改线上客服系统。

## 转化池保存内容

在线客服入口只保存：

```text
customer_service_connection_id
remote_group_id
remote_group_name
```

不会在每个转化入口中重复保存 API Token、API 地址或接口映射。

`/go/:code` 负责：

```text
产品
→ 转化分组
→ round-robin 目标
→ 客服系统 Adapter
→ 会话入口
→ HTTP 302
```

本站不再额外记录客服咨询量；咨询统计以客服管理系统自己的数据为准。

## 链接跳转

链接模式不经过客服管理：

```text
链接型转化分组
├─ 链接 A → https://...
├─ 链接 B → https://...
└─ 链接 C → https://...
```

多个启用链接继续按 `round_robin` 轮换。链接点击统计由联盟平台负责，本站不额外写统计事件。

## 旧数据迁移

旧版单例客服配置已迁移为 `generic_v1` 连接；现有连接继续兼容。

`generic_rest_v2` 使用现有 `provider` 和 `private_config_json` 字段保存 Adapter 类型与非敏感映射，因此本次升级不需要新增 D1 数据列或迁移已有连接。
