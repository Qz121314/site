# 独立客服系统接入与 Messages 协议

## 架构结论

这条边界固定，不再变化：

> **独立客服系统负责会话、消息、坐席和实时状态；Site Storefront 负责用户聊天 UI。**

客服管理系统使用独立 Git 仓库、独立 Cloudflare Worker、独立数据库、独立域名和独立部署流程。本 `site` 仓库不保存会话、消息、坐席或工单数据。

```text
Site Storefront Messages UI
  → 同源 /api/messages/v1/*
  → Site Worker
  → D1 运行时客服连接配置
  → generic_v1 provider adapter
  → 独立客服 Worker
  → 客服系统自己的 Conversation / Message / Agent 数据库
```

职责边界：

```text
site.git
├─ Storefront Messages 用户 UI
├─ 匿名访客安全 Cookie
├─ 不透明 conversationRef
├─ 同源 Messages API
├─ 客服连接运行时配置
├─ 转化池 / round-robin
└─ provider adapter

customer-service.git
├─ Conversation 唯一数据源
├─ Message 唯一数据源
├─ Agent / 坐席
├─ 会话状态
├─ 未读 / 已读
├─ 消息幂等
├─ 数据保留
└─ WebSocket / SSE / Durable Objects 等实时能力
```

Site D1 **不得**创建 conversations、messages、agents、tickets 等客服业务表。

## 客服连接

后台“客服管理”只保存运行时连接：

- 连接名称；
- provider，目前固定 `generic_v1`；
- HTTPS API 根地址；
- 可选项目 ID；
- 可选 API Token；
- 启用状态。

API Token 为只写字段。后台读取连接时只返回 `hasApiToken`，不返回 Token 原文；Provider 地址、Token、Project ID 和访客标识都不得进入 Storefront bundle 或 R2 发布快照。

更换客服系统域名时只修改后台运行时连接，不重新构建 Storefront。

## Cloudflare Secret

Site Worker 必须配置：

```text
MESSAGES_SESSION_SECRET
```

要求至少 32 个字符，并与 `SESSION_SECRET` 分离。

它只用于：

- 签名匿名访客 Cookie；
- AES-GCM 加密 Storefront 使用的 `conversationRef`。

浏览器看到的 `conversationRef` 不包含可读的客服连接 ID 或上游 conversation ID，并且只能与创建它的访客 Cookie 一起使用。

## Product CTA 行为

在线客服 CTA 不再跳到外部客服网页，也不再调用 `/groups/{groupId}/entry`。

固定流程：

```text
Product CTA
  → GET /go/{productId}
  → Site Worker 校验产品和转化分组
  → customer_service 模式不消费 round-robin target
  → 302 /messages/new/?productId=...&sectionId=...
  → 用户在 Site Storefront 输入第一条消息
  → POST /api/messages/v1/conversations
  → 此时才消费 round-robin target
  → Site Worker 调用独立客服 Worker 创建 Conversation
  → 返回加密 conversationRef
  → Storefront 进入 /messages/{conversationRef}/
```

这样不会创建空会话，也不会在点击 CTA 和发送首条消息时重复推进 round-robin 游标。

链接型 CTA 保持原行为：`/go/{productId}` 选择链接 target 后直接 HTTP 302。

## Site 同源 Messages API

Storefront 只调用以下同源接口：

```http
GET  /api/messages/v1/conversations
GET  /api/messages/v1/conversations/{conversationRef}?before={cursor}&limit=30
POST /api/messages/v1/conversations
POST /api/messages/v1/conversations/{conversationRef}/messages
POST /api/messages/v1/conversations/{conversationRef}/read
```

所有响应：

```http
Cache-Control: no-store, private
Pragma: no-cache
Referrer-Policy: no-referrer
X-Robots-Tag: noindex, nofollow
```

写接口必须：

- 校验请求 `Origin` 与 Site 同源；
- 只接受 JSON；
- 限制请求正文大小；
- 单条消息最大 4000 字符；
- 使用 `clientMessageId` 作为幂等键；
- 错误响应不返回 Token、上游 URL、内部日志或原始 provider body。

Storefront 的 `SupportGateway` 位于：

```text
apps/storefront/src/support-contract.ts
apps/storefront/src/support-gateway.ts
```

UI 不允许直接访问客服域名。

## 匿名访客身份

Site 不建立用户账号系统。Messages 使用 HttpOnly 匿名访客 Cookie：

```text
site_messages_session
```

属性：

```text
HttpOnly
Secure（HTTPS）
SameSite=Strict
Path=/
```

Cookie 内只保存签名后的随机 Visitor ID 和有效期。Conversation 和 Message 本身仍全部存放在独立客服系统。

Site Worker 调用客服 Worker 时附加：

```http
X-Site-Visitor-Id: <visitor-id>
X-Site-Request-Id: <request-id>
Authorization: Bearer <api-token>   # 可选
X-Project-Id: <project-id>          # 可选
```

## 多客服系统

Site 允许多个客服连接同时启用，不假设全站只有一个客服 Worker。

会话列表：

```text
Site Worker
  → 并行读取所有已启用客服连接的当前 Visitor 会话
  → 合并 / 排序
  → 每条远程 conversation ID 加密为 Site conversationRef
  → 返回 Storefront
```

打开、发送、已读时，Site Worker 解密 `conversationRef`，得到实际连接和远程 conversation ID，再向正确的客服 Worker 发请求。

因此不同分区可以绑定不同客服系统，同时 Storefront 仍然只有一个 Messages UI。

## generic_v1：客服分组接口

后台配置转化池时继续使用分组接口：

```http
GET {baseUrl}/groups
Accept: application/json
Authorization: Bearer <token>   # 可选
X-Project-Id: <projectId>       # 可选
```

返回：

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

转化入口只保存：

```text
customer_service_connection_id
remote_group_id
remote_group_name
```

不重复保存客服域名、Token 或 Project ID。

## generic_v1：Messages 上游协议

独立客服 Worker 需要实现下面的版本化接口。

### 会话列表

```http
GET {baseUrl}/messages/v1/conversations
```

返回：

```json
{
  "conversations": [
    {
      "id": "remote-conversation-id",
      "agentName": "Agent Name",
      "agentAvatarUrl": null,
      "productId": "product-id",
      "sectionId": "section-id",
      "productTitle": "Product title",
      "productCoverUrl": null,
      "lastMessage": "Hello",
      "lastMessageAt": "2026-08-09T12:00:00.000Z",
      "unreadCount": 1,
      "status": "active"
    }
  ]
}
```

`status`：

```text
waiting
active
closed
```

### 会话详情 / 历史分页

```http
GET {baseUrl}/messages/v1/conversations/{remoteConversationId}?before={cursor}&limit=30
```

返回：

```json
{
  "conversation": {
    "id": "remote-conversation-id",
    "agentName": null,
    "agentAvatarUrl": null,
    "productId": "product-id",
    "sectionId": "section-id",
    "productTitle": "Product title",
    "productCoverUrl": null,
    "lastMessage": "Hello",
    "lastMessageAt": "2026-08-09T12:00:00.000Z",
    "unreadCount": 0,
    "status": "waiting",
    "createdAt": "2026-08-09T11:00:00.000Z",
    "expiresAt": "2026-09-09T11:00:00.000Z",
    "nextMessageCursor": null,
    "messages": [
      {
        "id": "message-id",
        "direction": "customer",
        "body": "Hello",
        "sentAt": "2026-08-09T11:00:00.000Z",
        "delivery": "sent"
      }
    ]
  }
}
```

`direction`：`customer | agent`。

Provider 返回的 `delivery`：`sent | read`。Storefront 自己可以临时显示 `sending`，但 `sending` 不是客服 Worker 的持久状态。

### 创建会话并发送首条消息

```http
POST {baseUrl}/messages/v1/conversations
Idempotency-Key: <clientMessageId>
Content-Type: application/json
```

请求：

```json
{
  "remoteGroupId": "sales",
  "clientMessageId": "uuid",
  "message": "Hello",
  "product": {
    "id": "product-id",
    "sectionId": "section-id",
    "title": "Product title",
    "href": "/sections/section-id/products/product-id/",
    "coverUrl": null
  }
}
```

返回格式与“会话详情”一致。

客服系统应将产品上下文作为 Conversation metadata 保存；Site 不要求客服仓库反向读取 Site D1。

### 发送后续消息

```http
POST {baseUrl}/messages/v1/conversations/{remoteConversationId}/messages
Idempotency-Key: <clientMessageId>
Content-Type: application/json
```

请求：

```json
{
  "clientMessageId": "uuid",
  "body": "Hello again"
}
```

返回：

```json
{
  "message": {
    "id": "message-id",
    "direction": "customer",
    "body": "Hello again",
    "sentAt": "2026-08-09T12:10:00.000Z",
    "delivery": "sent"
  }
}
```

### 标记已读

```http
POST {baseUrl}/messages/v1/conversations/{remoteConversationId}/read
Content-Type: application/json
```

请求：

```json
{
  "lastMessageId": "message-id"
}
```

返回：

```json
{
  "ok": true
}
```

已读是显式写操作，不允许通过 GET 会话详情隐式改变未读状态。

## 独立客服仓库开发顺序

`site` 完成后，新的客服仓库按下面顺序实现：

```text
1. generic_v1 /groups
2. Visitor ID 接收与校验边界
3. Conversation / Message 数据模型
4. POST 创建会话 + clientMessageId 幂等
5. 会话列表 / 详情 / Cursor 历史分页
6. 发送消息
7. 已读状态
8. Agent 管理后台
9. WebSocket / SSE / Durable Objects 实时推送
10. 数据保留 / 关闭 / 超时策略
```

实时机制属于客服仓库。Site Storefront 保持同一套 `SupportGateway`，未来从轮询升级实时推送时不改变业务归属。

## 旧数据

旧版单例客服配置已经迁移为连接模型。旧手工客服 URL 入口保持为 legacy 数据并停用；正式在线客服 target 必须重新绑定“客服连接 + 远程客服分组”。

`/groups/{groupId}/entry` 外部会话 URL 模型已经退役，不再作为 Site Messages 架构的一部分。
