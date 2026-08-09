# 独立客服系统接入与转化池接口模型

## 仓库与部署边界

客服管理系统是独立产品，使用独立 Git 仓库、独立 Cloudflare Worker、独立数据库、独立域名和独立部署流程。本 `site` 仓库不保存会话、消息、坐席或工单数据，只承担：

- Storefront 的 Messages 用户界面；
- Admin 的客服连接运行时配置；
- Site Worker 的服务商无关适配层；
- 产品和分区上下文到客服系统的安全传递。

```text
Storefront Messages
  → 同源 /api/messages/v1/*
  → Site Worker adapter
  → D1 运行时连接配置
  → 独立客服 Worker
  → 客服系统自己的数据库与坐席后台
```

前端不得硬编码独立客服系统域名，也不得直接持有 API Token、项目密钥或私有配置。更换客服域名或客服实现时，只修改后台运行时配置，不重新构建 Storefront。

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

## 客服系统连接

后台客服管理保存：

- 连接名称
- provider
- HTTPS API 根地址
- 可选项目 ID
- 可选 API Token
- 私有扩展 JSON
- 启用状态

API Token 为只写字段，后台读取连接时只返回 `hasApiToken`，不返回 token 原文。私有连接信息不得进入 R2 前台快照。

当前预留 provider 为 `generic_v1`。

## Messages 同源接口边界

Messages UI 最终只依赖 Site Worker 的同源、私有用户接口：

```http
GET  /api/messages/v1/conversations
GET  /api/messages/v1/conversations/{conversationId}
POST /api/messages/v1/conversations
POST /api/messages/v1/conversations/{conversationId}/messages
```

对应的前端数据与方法边界由 `apps/storefront/src/support-contract.ts` 中的 `SupportGateway` 定义。该契约只描述 UI 所需能力，不包含任何 provider 地址或凭据。

这些路由在独立客服系统和访客身份机制完成前不应暴露伪实现或未鉴权写接口。接入时必须满足：

- 所有响应使用 `Cache-Control: no-store, private`；
- 浏览器只携带站点自己的安全会话 Cookie；
- Site Worker 服务端读取 D1 中的连接信息并附加 provider 鉴权；
- conversation ID 是不透明标识，不能由客户端拼接上游地址；
- 写消息接口校验 Origin、正文长度和幂等键；
- 错误响应不返回 Token、上游 URL、内部日志或原始 provider 响应。

当前 Messages 使用空集合展示未接入状态，不在浏览器、本地存储或 Site D1 中伪造会话数据。

## 独立客服 Worker 的消息协议

独立客服仓库完成后，`generic_v1` adapter 将把上述同源能力映射到客服 Worker 的版本化消息接口。独立客服 Worker 是会话和消息的唯一数据源，并负责访客会话、客服身份、实时通信、消息状态和数据保留。

首次接入应先完成能力协商与访客会话方案，再启用 Messages 请求；不要让 Storefront 直接访问跨域客服 API。现有 `/groups` 与 `/groups/{groupId}/entry` 契约继续独立工作，不要求在当前阶段实现消息系统。

## generic_v1 分组接口

Worker 请求：

```http
GET {baseUrl}/groups
Accept: application/json
Authorization: Bearer <token>   # 可选
X-Project-Id: <projectId>       # 可选
```

客服系统返回：

```json
{
  "groups": [
    {
      "id": "sales",
      "name": "Sales",
      "isEnabled": true
    }
  ]
}
```

转化池选择在线客服时，后台通过 Worker 调用该接口，管理员只能从返回的客服分组中选择。

转化入口保存：

```text
customer_service_connection_id
remote_group_id
remote_group_name
```

不在转化入口中重复保存 API Token、项目配置或客服系统 API 地址。

## 未来会话入口接口

客服系统正式开发完成后，动态 CTA 链路预留：

```http
POST {baseUrl}/groups/{groupId}/entry
Content-Type: application/json
Authorization: Bearer <token>   # 可选
X-Project-Id: <projectId>       # 可选
```

请求：

```json
{
  "requestId": "...",
  "productId": "...",
  "sectionId": "..."
}
```

返回：

```json
{
  "url": "https://support.example.com/session/..."
}
```

最终 `/go/:code` 将负责：产品 → 转化分组 → round-robin 目标 → 客服系统 adapter → 会话入口 → 转化事件 → HTTP 302。

## 链接跳转

链接模式不经过客服管理：

```text
链接型转化分组
├─ 链接 A → https://...
├─ 链接 B → https://...
└─ 链接 C → https://...
```

多个启用链接继续按 `round_robin` 轮换。链接目标只保存名称、URL、排序和启用状态。

## 旧数据迁移

旧版单例客服配置会迁移为一个 `legacy-default` 连接，旧单例字段随后清空。

旧版在线客服转化入口原本是手工 URL，迁移后保留记录但自动停用，并标记为需要重新绑定客服系统和远程客服分组。旧链接型转化入口保持原有状态。
