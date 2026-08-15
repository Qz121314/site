# 独立客服系统接入与 Messages 协议

## 1. 固定职责边界

当前架构已经收敛为两套独立系统：

```text
Site
├─ Product / Section / Category
├─ 在线客服转化组
├─ Customer Service Connection
├─ Storefront Messages UI
└─ 公开客服路由发现

Customer Service
├─ Visitor / Conversation / Message
├─ Agent
├─ 分区 / 分类 / 指定产品负责范围
├─ Client REST / Media
├─ WebSocket realtime
└─ Durable Object / D1
```

边界固定：

> **Site 负责决定“这个产品使用哪一个已验证客服系统”，Customer Service 负责决定“这个会话分给哪一个客服”。**

Site Worker 不代理 Visitor 与客服之间的 Conversation、Message、图片上传或 WebSocket 流量。

---

## 2. 总体链路

### 2.1 管理面

```text
Site Admin
   │
   │ 读取连接验证上下文
   ▼
Site Worker
   │
   │ baseUrl + verifyToken 仅返回给已登录管理员
   ▼
Admin Browser
   │
   │ POST {baseUrl}/integration/v1/verify
   │ Authorization: Bearer <verifyToken>
   │ + 当前在线客服产品目录
   ▼
Customer Service Worker
   │
   │ 返回 clientApiUrl / realtimeUrl / protocolVersion
   ▼
Admin Browser
   │
   │ 提交 verification-result
   ▼
Site Worker / D1
```

验证请求由 **Admin Browser 直接访问 Customer Service Worker**。Site Worker 不保存远端管理会话，也不充当客服系统 API 代理。

### 2.2 用户运行时

```text
Storefront
   │
   │ GET /api/public/storefront/support/route/:productId
   ▼
Site Worker
   │
   │ 返回 verified connection + 产品分流上下文
   ▼
Storefront
   │
   ├─ Client REST ───────────────┐
   ├─ Media upload/read ─────────┼──> Customer Service Worker
   └─ WebSocket realtime ────────┘
                                      │
                                      ▼
                              section/category/product scope
                                      │
                                      ▼
                                    Agent
```

从 Conversation 创建开始，Site Worker 不再位于聊天数据路径中。

---

## 3. Site 侧连接模型

管理员录入的核心字段：

```text
name
baseUrl
verifyToken
isEnabled
```

其中：

- `baseUrl`：客服系统公网根地址，例如 `https://support.example.com`；
- `verifyToken`：只用于管理员验证连接，绝不公开给 Storefront；
- `isEnabled`：关闭后该连接不再参与公开客服路由；
- `clientApiUrl` / `realtimeUrl`：不是手工猜测或硬编码，而是客服系统验证成功后返回并由 Site 保存；
- `verifiedAt`：只有验证成功的连接才能进入公开运行时配置。

更换客服系统域名时，修改连接并重新验证即可，不需要重新构建 Storefront。

---

## 4. Integration v1：验证与产品目录同步

客服系统公开控制面端点：

```http
GET  {baseUrl}/integration/v1/status
POST {baseUrl}/integration/v1/verify
```

`status` 返回最小协议状态：

```json
{
  "ok": true,
  "protocolVersion": "v1"
}
```

验证请求：

```http
POST {baseUrl}/integration/v1/verify
Authorization: Bearer <verifyToken>
Content-Type: application/json
```

Site Admin 会把当前属于该客服连接的在线客服产品目录一并同步：

```json
{
  "productCatalog": {
    "products": [
      {
        "id": "product-id",
        "title": "Product title",
        "href": "/sections/west/products/product-id/",
        "coverUrl": "https://media.example.com/product.webp",
        "sectionId": "west",
        "sectionName": "West",
        "categoryId": "massage",
        "categoryName": "Massage",
        "isEnabled": true
      }
    ]
  }
}
```

客服系统当前接受最多 5000 个产品。同步采用“先禁用旧目录，再 upsert 本次目录”的方式，因此客服后台看到的是 Site 当前权威产品集合。

验证成功返回：

```json
{
  "ok": true,
  "protocolVersion": "v1",
  "clientApiUrl": "https://support.example.com/client/v1",
  "realtimeUrl": "wss://support.example.com/client/v1/realtime",
  "productCatalog": {
    "productCount": 128
  }
}
```

客服系统在兼容迁移阶段可能仍返回 `groups`，但**当前 Site 不使用它做运行时路由**。

---

## 5. Site Admin 验证流程

当前 Site Admin 使用两段式流程，避免把验证 Token 暴露到公开配置：

```text
1. GET  /api/admin/customer-service/connections/:id/verification-context
2. Admin Browser -> Customer Service /integration/v1/verify
3. POST /api/admin/customer-service/connections/:id/verification-result
```

第一步只在管理员认证后返回：

```json
{
  "baseUrl": "https://support.example.com",
  "verifyToken": "***"
}
```

第二步由浏览器直接向客服系统验证，并附带产品目录。

第三步把客服系统返回的协议结果交回 Site Worker，Site 保存：

```text
clientApiUrl
realtimeUrl
protocolVersion
verifiedAt
productCount / audit metadata
```

验证失败时连接不能进入 Storefront 公共运行时。

---

## 6. Site 公开客服配置

公开接口挂载在：

```text
/api/public/storefront
```

### 6.1 已验证连接发现

```http
GET /api/public/storefront/support/connections
```

返回：

```json
{
  "connections": [
    {
      "id": "connection-id",
      "clientApiUrl": "https://support.example.com/client/v1",
      "realtimeUrl": "wss://support.example.com/client/v1/realtime",
      "protocolVersion": "v1"
    }
  ]
}
```

只返回：

- 已启用；
- 未删除；
- 已验证；
- `clientApiUrl` 与 `realtimeUrl` 完整。

此接口永远不返回 `verifyToken`、管理员 Cookie 或客服登录凭据。

### 6.2 产品客服路由发现

```http
GET /api/public/storefront/support/route/{productId}?sectionId={sectionId}
```

Site 在这里解析：

```text
Product
→ 在线客服转化组
→ Customer Service Connection
```

返回：

```json
{
  "available": true,
  "connection": {
    "id": "connection-id",
    "clientApiUrl": "https://support.example.com/client/v1",
    "realtimeUrl": "wss://support.example.com/client/v1/realtime",
    "protocolVersion": "v1"
  },
  "product": {
    "id": "product-id",
    "sectionId": "west",
    "sectionName": "West",
    "categoryId": "massage",
    "categoryName": "Massage",
    "title": "Product title"
  }
}
```

这里不会创建 Conversation，也不会选择 Agent。Customer Service 使用这份产品上下文匹配自己的动态负责范围。

---

## 7. Visitor 身份

Storefront 不要求注册或登录。浏览器第一次需要 Messages 时生成临时 Visitor ID：

```text
长度：6
组成：恰好 3 个 A-Z 字母 + 3 个数字
顺序：随机打乱
示例：A7C2D9
```

Storefront 本地保存 `visitorId + expiresAt`。到期生成新 ID，不引入 Refresh Token、长期画像或账户恢复流程。

当前客服数据生命周期以 24 小时短期会话为基线。

---

## 8. Client REST v1

Storefront 使用验证结果中的 `clientApiUrl`，并直接访问 Customer Service Worker。

### 会话列表

```http
GET {clientApiUrl}/conversations?visitorId=A7C2D9
```

### 会话详情 / 历史分页

```http
GET {clientApiUrl}/conversations/{conversationId}?visitorId=A7C2D9&before={cursor}&limit=30
```

### 创建 Conversation

只有用户真正发送第一条消息时才创建 Conversation：

```http
POST {clientApiUrl}/conversations
Content-Type: application/json
```

```json
{
  "visitorId": "A7C2D9",
  "clientMessageId": "uuid",
  "message": "Hello",
  "product": {
    "id": "product-id",
    "sectionId": "west",
    "sectionName": "West",
    "categoryId": "massage",
    "categoryName": "Massage",
    "title": "Product title",
    "href": "/sections/west/products/product-id/",
    "coverUrl": "https://media.example.com/product.webp"
  }
}
```

没有远端 Group 参数。客服系统根据：

```text
product.id
sectionId
categoryId
```

匹配 Agent 的负责范围。

### 后续消息

```http
POST {clientApiUrl}/conversations/{conversationId}/messages
Content-Type: application/json
```

```json
{
  "visitorId": "A7C2D9",
  "clientMessageId": "uuid",
  "body": "Hello again"
}
```

### 已读

```http
POST {clientApiUrl}/conversations/{conversationId}/read
Content-Type: application/json
```

```json
{
  "visitorId": "A7C2D9",
  "lastMessageId": "message-id"
}
```

### 图片

图片上传和读取同样直接访问 Customer Service 的媒体接口，由 Storefront `support-media-gateway` 负责初始化、上传、完成和内容读取；Site Worker 不中转图片字节。

---

## 9. WebSocket v1

Storefront 使用验证后的 `realtimeUrl`：

```text
wss://support.example.com/client/v1/realtime?visitorId=A7C2D9
```

实时模型是 **WebSocket-first**：

```text
首次进入 / 历史分页
→ REST

message.created
message.read
conversation.assigned
conversation.closed
→ WebSocket 增量事件

断线重连 / 网络恢复
→ REST reconciliation
```

不再用固定 30 秒轮询 Conversation 列表。

当前事件可以携带：

```text
conversation summary
message delta
media delta
reader / lastMessageId
```

Storefront 收到有效 delta 后直接更新 React Query cache，不再为每条实时事件重新 GET 整个 Conversation。只有未知旧事件或 realtime recovery 才回到 REST 对账。

---

## 10. Customer Service 内部分流

Site 只选客服系统，不选客服坐席。

Customer Service 负责范围模型：

```text
整个分区
→ section scope
→ 该分区当前 + 未来新增产品动态覆盖

指定分类
→ category scope
→ 所选分类动态覆盖

指定产品
→ product scope
→ 仅明确产品
```

候选客服还必须满足：

```text
账号启用且可登录
status = online
last_seen_at 在有效窗口内
未超过 max_active_conversations
```

排序：

```text
active conversation 最少
→ last_assigned_at 最旧
→ agent id
```

候选选择、容量判断和 Conversation assignment 在同一个 SQLite CTE + UPDATE 中完成，避免并发请求使用过期容量快照。

只有没有任何 section/category/product scope 命中时，客服系统才使用旧 `support_groups / group_agents` 关系作为兼容回退。

---

## 11. 安全边界

固定规则：

- `verifyToken` 只存在 Site Admin 控制面；
- 公开 Site 接口只返回验证后的 Client REST / WebSocket 地址；
- Storefront 不携带客服管理员 Token；
- Site Worker 不持有 Visitor 聊天会话；
- Visitor REST 使用临时 Visitor ID；
- Customer Service Client API 允许必要 CORS；
- 管理员验证请求使用 Bearer Token；
- 客服 Agent 登录和 Session 由独立客服系统管理；
- 聊天媒体保存在客服系统自己的存储边界内。

---

## 12. 故障行为

### Site 路由不可用

当产品没有启用在线客服转化组、连接未验证或连接停用时：

```json
{ "available": false }
```

Storefront 不应尝试创建远端 Conversation。

### Customer Service 暂时不可达

Storefront 将远端请求错误归一化为 Messages 暂不可用，不把远端内部错误或 Token 暴露给用户。

### WebSocket 断线

自动指数退避重连；连接恢复后执行一次 REST reconciliation。

### 没有在线客服

Conversation 可以保持未分配。客服登录、在线恢复或已有会话关闭释放容量后，Customer Service 重新尝试分流。

---

## 13. 当前实现原则

该协议面向个人和小团队，保持以下约束：

```text
不做代理聊天网关
不做 CRM
不做长期用户账户体系
不把产品展开复制成海量静态客服绑定
不增加无必要的轮询
不增加远端 Group 二次映射
```

当前稳定主链路：

```text
Site Product
→ Site 在线客服转化组
→ 已验证 Customer Service Connection
→ Storefront 直连 Customer Service
→ Customer Service 动态 scope 分流
→ Agent
```
