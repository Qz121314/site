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
