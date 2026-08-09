# 独立客服系统接入与 Messages 协议

## 架构结论

这条边界固定：

> **Site Storefront 负责用户聊天 UI；独立客服系统负责 Visitor、Conversation、Message、Agent 和实时通信。Storefront 直接连接客服系统，Site Worker 不代理聊天流量。**

最终拓扑：

```text
                         Browser
                            │
                    Site Storefront
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
      Site Worker / D1            Customer Service Worker
      产品、主题、素材、配置          REST + WebSocket
              │                           │
              │                           ▼
              │                    Conversation / Message
              │                    Durable Objects / DB
              │                           │
              │                           ▼
              │                    Customer Service Admin
```

代码和部署：

```text
site.git
├─ Storefront
│  └─ Messages 用户 UI + 客服直连客户端
├─ Product Admin
├─ Site Worker
├─ Site D1
└─ R2

customer-service.git
├─ Customer Service Admin
├─ Customer Service Worker
├─ Conversation / Message
├─ Agent / Group
├─ WebSocket realtime
└─ Customer Service DB / Durable Objects
```

`site` D1 不创建 conversations、messages、agents、tickets 等客服业务表。

---

## 产品后台负责什么

产品后台只负责 **客服系统接入配置** 和 **Product -> Support Group** 映射，不参与用户和客服之间的消息传输。

客服连接配置：

```text
name
baseUrl
projectId
managementToken
isEnabled
```

字段边界：

- `baseUrl`：客服系统服务根地址，例如 `https://support.example.com`；允许 Storefront 读取。
- `projectId`：客服系统中的项目标识；允许 Storefront 读取。
- `managementToken`：当前数据库字段仍名为 `api_token`，只供 Site Admin 测试连接、读取客服 Group；绝不返回 Storefront。
- `isEnabled`：关闭后 Storefront 不再发现该客服连接。

一个 `baseUrl` 派生所有协议地址，不额外录入 WebSocket URL：

```text
Management API  {baseUrl}/management/v1/*
Client REST     {baseUrl}/client/v1/*
Client Realtime wss://{host}/client/v1/realtime
```

更换客服系统域名只修改 Product Admin 中的 `baseUrl`，Storefront 不需要重新构建。

---

## Site 发布给 Storefront 的公开配置

Storefront 可以读取：

```http
GET /api/public/storefront/support/connections
```

示例：

```json
{
  "connections": [
    {
      "id": "connection-id",
      "baseUrl": "https://support.example.com",
      "projectId": "site-main",
      "protocolVersion": "v1"
    }
  ]
}
```

此接口不得返回：

```text
managementToken
apiToken
Authorization
任何客服后台登录凭证
```

Product -> Support Group 使用：

```http
GET /api/public/storefront/support/route/{productId}?sectionId={sectionId}
```

示例：

```json
{
  "available": true,
  "connection": {
    "id": "connection-id",
    "baseUrl": "https://support.example.com",
    "projectId": "site-main",
    "protocolVersion": "v1"
  },
  "groupId": "sales"
}
```

这个接口只读取 Site 配置：

- 不创建 Conversation；
- 不发送 Message；
- 不调用客服 Worker；
- 不推进 Site round-robin cursor。

在线客服的分配职责固定为：

```text
Site:
Product -> Support Group

Customer Service:
Support Group -> Agent
```

Site 不负责客服坐席轮询。

---

## 用户身份：无登录、24 小时、6 位 ID

Storefront 不要求用户注册或登录。

浏览器第一次需要 Messages 时生成一个临时 ID：

```text
长度：6
组成：恰好 3 个 A-Z 字母 + 3 个数字
顺序：随机打乱
示例：A7C2D9
```

前端代码不使用 `Guest` 或“游客”作为用户名称；客服系统以这个 6 位 ID 识别短期访客。

生命周期固定：

```text
Visitor ID     24 小时
Conversation   24 小时
Message        随 Conversation 24 小时清理
```

Storefront 在本地保存 `visitorId + expiresAt`。到期直接生成新 ID，不做 Refresh Token、不做账户恢复、不做长期用户画像。

---

## 实时链路

真实聊天链路固定为：

```text
Storefront
   │
   │ HTTPS / WebSocket
   ▼
Customer Service Worker
   │
   ▼
Conversation Durable Object / realtime state
   │
   │ WebSocket
   ▼
Customer Service Admin
```

**Site Worker 不在这条链路中。**

用户发送消息：

```text
Storefront -> Customer Service Worker -> Conversation -> Agent WebSocket
```

客服回复：

```text
Customer Admin -> Customer Service Worker -> Conversation -> Storefront WebSocket
```

REST 用于初始化、历史分页和断线恢复；WebSocket 用于实时事件。

---

## Client REST v1

跨域 Client API 由客服系统实现。客服 Worker 需要允许 Product Admin 中对应 Site 域名的 CORS Origin。

为了让 GET 请求尽量避免自定义 Header 触发额外预检，`visitorId` 和 `projectId` 使用 query/body 传递。

### 会话列表

```http
GET {baseUrl}/client/v1/conversations?visitorId=A7C2D9&projectId=site-main
```

返回：

```json
{
  "conversations": [
    {
      "id": "remote-conversation-id",
      "agentName": "Alex",
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
GET {baseUrl}/client/v1/conversations/{conversationId}?visitorId=A7C2D9&projectId=site-main&before={cursor}&limit=30
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
    "productHref": "/sections/section-id/products/product-id/",
    "lastMessage": "Hello",
    "lastMessageAt": "2026-08-09T11:00:00.000Z",
    "unreadCount": 0,
    "status": "waiting",
    "createdAt": "2026-08-09T11:00:00.000Z",
    "expiresAt": "2026-08-10T11:00:00.000Z",
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

### 第一条消息：创建 Conversation

用户真正发送第一条消息时才创建 Conversation；打开聊天页面不创建空会话。

```http
POST {baseUrl}/client/v1/conversations
Content-Type: application/json
```

请求：

```json
{
  "visitorId": "A7C2D9",
  "projectId": "site-main",
  "groupId": "sales",
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

客服系统保存产品快照到 Conversation metadata，不反向读取 Site D1。

### 后续消息

```http
POST {baseUrl}/client/v1/conversations/{conversationId}/messages
Content-Type: application/json
```

```json
{
  "visitorId": "A7C2D9",
  "projectId": "site-main",
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

### 已读

```http
POST {baseUrl}/client/v1/conversations/{conversationId}/read
Content-Type: application/json
```

```json
{
  "visitorId": "A7C2D9",
  "projectId": "site-main",
  "lastMessageId": "message-id"
}
```

返回：

```json
{ "ok": true }
```

---

## WebSocket v1

Storefront 直接连接：

```text
wss://support.example.com/client/v1/realtime?visitorId=A7C2D9&projectId=site-main
```

客服后台也直接连接 Customer Service Worker 的 Agent realtime endpoint。

第一版实时事件保持最小：

```text
message.created
message.read
conversation.assigned
conversation.closed
```

事件至少携带：

```json
{
  "type": "message.created",
  "conversationId": "remote-conversation-id"
}
```

Storefront 收到事件后立即刷新对应 Conversation / conversation list。WebSocket 断开时自动重连；REST 是恢复源。

第一版不做：

```text
复杂 presence
多设备同步
消息撤回
reaction
thread
mention
复杂 ACK protocol
```

---

## Management API v1

只有 Site Product Admin 使用 Management API。

读取客服 Group：

```http
GET {baseUrl}/management/v1/groups
Accept: application/json
Authorization: Bearer <managementToken>   # 可选
X-Project-Id: <projectId>                 # 可选
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

`managementToken` 永远不进入 Storefront bundle、公开 JSON、R2 快照或浏览器网络请求。

---

## 独立客服仓库下一步实现顺序

`site` 只负责把前端和产品后台边界准备好。新的 `customer-service.git` 按下面顺序开发：

```text
1. Project + allowed Origin 配置
2. /management/v1/groups
3. 24 小时 Visitor / Conversation / Message 数据模型
4. /client/v1/conversations 创建 + clientMessageId 幂等
5. 会话列表 / 详情 / Cursor 历史分页
6. 后续消息 / 已读
7. Agent 登录与最小客服后台
8. Group -> Agent 分配
9. WebSocket realtime
10. Durable Objects 会话协调
11. 24 小时清理 / close / timeout
```

目标是个人和小团队使用的轻量实时客服系统：速度优先、职责清楚、不做 CRM 和长期账号体系。
