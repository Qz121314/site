# 项目架构基线

本文档是当前项目的强制架构边界。若实现与本文冲突，应先修改架构文档并给出迁移方案，不能在代码中形成第二套隐含架构。

## 1. 最终项目边界

整个平台由两个独立项目组成：

```text
项目一：业务运营平台（本仓库）
├─ 用户前端 Storefront
├─ 商家后台 Admin
├─ 业务 API Worker
├─ 主业务数据库
├─ 媒体与公开内容发布
└─ 客服系统接入与转化结果展示

项目二：实时客服平台（独立仓库）
├─ 客服管理后台
├─ 客服工作台
├─ 客服账号与客服分组
├─ 产品客服路由
├─ 轮询分配与等待队列
├─ WebSocket 实时图文会话
├─ 会话、线索、跟进与转化
└─ 对外集成 API 与 Webhook
```

不再建立独立的 Storefront 仓库。用户前端与商家后台属于同一业务数据域，保留在同一个 Git 仓库和同一个业务平台部署单元中。

实时客服平台拥有独立业务、独立数据库、独立资源消耗和独立扩容需求，因此必须单独建设。

## 2. 本仓库职责

本仓库 `Qz121314/site` 是业务运营平台，负责：

- English / Español 用户前端；
- 中文商家后台；
- 频道、分类、标签、地区、门店和展示项目；
- 产品图片、Banner、页面和 FAQ；
- 管理员、商家、角色、权限与审计；
- 内容审核、发布、版本和回滚；
- D1 主业务数据；
- R2 媒体与版本化公开快照；
- 外部跳转和转化目标；
- 客服平台连接配置；
- 读取外部客服分组目录；
- 产品绑定外部客服分组；
- 接收客服平台回传的会话和转化结果。

本仓库不负责：

- 客服账号管理；
- 客服组成员管理；
- 客服轮询规则；
- 客服在线状态；
- 会话分配和等待队列；
- 实时聊天消息；
- 客服转接、跟进和原始转化记录；
- 客服系统的 WebSocket 基础设施。

## 3. 本仓库内部结构

```text
site/
├─ apps/
│  ├─ storefront/       用户前端，English / Español，移动端优先
│  ├─ admin/            中文商家后台
│  └─ worker/           Hono API、静态资源路由和后台任务
├─ packages/
│  ├─ domain/           业务领域模型
│  ├─ db/               数据访问与迁移辅助
│  ├─ api-contracts/    本项目 API 契约
│  ├─ support-contracts/客服平台集成契约
│  ├─ validation/       共享校验规则
│  ├─ ui/               可复用组件
│  └─ config/           工程配置
├─ migrations/
├─ scripts/
├─ tests/
├─ docs/
├─ wrangler.jsonc
└─ package.json
```

Storefront、Admin 和 Worker 分别构建，但共同属于业务运营平台。不能把 Storefront 和 Admin 编译成同一个前端 Bundle。

## 4. 部署边界

### 4.1 业务运营平台

本仓库只部署一个正式 Cloudflare Worker：

```text
service-catalog-site
```

建议路由：

```text
/en/*          Storefront English
/es/*          Storefront Español
/admin/*       商家后台
/api/*         业务 API
/go/:code      转化跳转
```

Storefront Service Worker 的作用域不得覆盖 `/admin`、`/api` 和 `/go`。Admin 不注册 Service Worker，不长期缓存身份或管理数据。

PR 只执行构建、类型、测试和 Worker dry-run，不创建长期 Preview Worker。正式部署只更新这一个 Worker。

### 4.2 实时客服平台

实时客服平台使用独立仓库和独立部署单元，可以部署在：

- 另一个 Cloudflare 账号；
- 其他云平台；
- 自购服务器；
- 容器平台。

业务运营平台不能依赖 Cloudflare Service Bindings。两个项目通过标准协议连接，确保可以跨账号、跨云和迁移服务器。

## 5. 两个项目的通信协议

统一使用：

```text
HTTPS REST API
WebSocket
Webhook
OpenAPI / JSON Schema
短期令牌或机器身份凭证
幂等键
请求签名
版本化接口
```

禁止：

- 共用数据库；
- 直接访问对方数据库表；
- 把 Cloudflare 专属 RPC 作为必需协议；
- 在浏览器中保存长期系统密钥；
- 建立拥有全部权限的通用接口。

## 6. 客服平台接入模型

### 6.1 系统连接

商家后台提供“客服系统接入”模块。第一版支持手动配置：

```text
系统名称
API Base URL
WebSocket Base URL
系统实例 ID
租户 ID
Client ID
Client Secret 或签名密钥
Webhook Secret
接口版本
连接状态
超时设置
```

稳定版增加一次性连接码：

```text
客服平台生成短期连接码
→ 商家后台粘贴连接码
→ 双方安全配对
→ 自动发现地址、版本和能力
→ 保存正式凭证
→ 自动同步客服分组目录
```

系统实例 ID 只用于识别，不能替代身份认证。

### 6.2 客服目录读取

客服平台是客服数据的唯一权威来源，负责：

```text
客服账号
客服分组
客服组成员
轮询策略
最大接待数
在线状态
等待队列
会话和消息
```

业务运营平台只读以下摘要：

```text
外部客服分组 ID
分组名称
分组状态
成员数量
可选客服摘要
客服平台版本和健康状态
```

本仓库可以保存只读缓存：

```text
support_connections
external_support_groups
external_support_agents
```

这些表只是外部目录镜像，不是客服数据权威来源。

### 6.3 产品绑定客服分组

产品只绑定外部客服分组，不绑定具体客服：

```text
Listing
├─ support_enabled
├─ support_connection_id
├─ external_group_id
├─ fallback_group_id
└─ offline_strategy
```

客服组成员、轮询顺序和接待规则仍然只在客服平台中设置。

用户端不接收客服名单。公开数据只包含产品是否支持咨询及必要的不可敏感路由引用。

## 7. 用户咨询流程

```text
用户浏览 Listing
→ 点击咨询
→ Storefront 调用本项目 API
→ 本项目校验 Listing、商家和客服路由
→ 服务端签名调用客服平台 HTTPS API
→ 客服平台查找产品对应客服组
→ 过滤在线且可接待客服
→ 组内轮询分配客服
→ 创建会话并返回短期令牌
→ 用户连接客服平台 WebSocket
→ 实时图文聊天
```

“轮询”指客服分配算法，不是浏览器轮询消息。消息传输使用 WebSocket；历史记录和重连补拉使用 HTTPS。

## 8. 实时客服平台职责边界

实时客服平台至少负责：

- 多租户和客服身份；
- 客服组及成员；
- 产品路由映射；
- 可用客服轮询；
- 并发安全分配；
- 客服确认接待；
- 超时重分配；
- 无客服等待队列；
- WebSocket 实时连接；
- 文本、图片和文件消息；
- 发送、送达和已读状态；
- 断线重连和消息补齐；
- 转接、关闭、跟进和转化；
- 向业务运营平台回传事件。

图像和文件必须使用预签名 URL 直传对象存储。WebSocket 只传消息元数据和对象 Key，不传大文件二进制或 Base64。

## 9. 客服结果回传

客服平台通过签名 Webhook 回传：

```text
conversation.created.v1
conversation.assigned.v1
conversation.closed.v1
lead.created.v1
conversion.completed.v1
conversion.failed.v1
```

本仓库接收后根据 `eventId` 幂等处理，并更新：

- 转化池；
- Listing 咨询和转化统计；
- 门店统计；
- 广告来源统计；
- 商家运营报表。

完整聊天正文保留在客服平台，不复制到业务主数据库。

## 10. 统一业务标识

跨项目使用不可变业务 ID：

```text
merchant_id
store_id
listing_id
conversion_target_id
campaign_id
```

客服平台拥有：

```text
support_tenant_id
support_group_id
agent_id
visitor_id
conversation_id
lead_id
conversion_id
```

跨系统事件同时携带双方业务标识，以形成完整追踪链路。

## 11. 本仓库数据与发布模型

### 11.1 主业务数据

D1 保存：

```text
admin_users
merchants
roles
permissions
channels
categories
tags
stores
listings
translations
media_assets
banners
content_pages
conversion_targets
support_connections
external_support_groups
publish_versions
audit_logs
```

业务内容状态和公开发布状态分离。

### 11.2 公开快照

Storefront 常规列表、筛选和详情优先读取 R2 版本化快照：

```text
D1 草稿与审核数据
→ 发布校验
→ 生成不可变版本目录
→ 验证 manifest
→ 原子切换 current.json
→ Storefront 读取新版本
```

前端与后台在同一个项目内，不需要系统连接码或跨项目发布 API。连接码只用于独立客服平台。

## 12. 用户端要求

- English / Español；
- 移动端优先；
- PC Listing 列表默认一行两列；
- 分类下拉菜单与标签筛选按钮；
- 卡片不显示独立缩略图；
- 有封面图时使用封面图，否则使用产品相册第一张；
- 图片比例和用途尺寸统一；
- 产品详情提供咨询入口；
- 用户聊天界面连接独立客服平台；
- PWA 缓存不得覆盖后台和敏感 API。

## 13. 商家后台要求

后台优先完成数据录入和管理核心：

- 商家、管理员、角色和权限；
- 频道、分类和标签；
- 地区、门店和 Listing；
- 双语内容；
- 媒体与 Banner；
- 客服平台接入；
- 产品选择外部客服分组；
- 转化池和广告池；
- 发布、回滚和审计；
- 软删除、回收站、选择、全选和批量删除。

任何支持删除的列表都必须统一实现选择、当前页全选、批量删除、确认、恢复和审计。

## 14. 开发顺序

当前只建设业务运营平台，顺序如下：

```text
1. 主业务领域模型和数据库
2. 管理 API 与权限
3. 中文商家后台数据录入
4. 媒体管理
5. 发布管线和公开快照
6. Storefront 用户前端
7. 客服平台接入契约和只读目录
8. 转化结果接收和统计
9. 单独建立实时客服平台仓库
10. 实现实时客服并完成联调
```

客服平台开发之前，本仓库只实现标准化集成契约和可替换的 Mock，不在本仓库内开发完整客服功能。

## 15. 最终运营闭环

```text
商家后台录入和发布 Listing
→ 用户前端展示
→ 用户点击咨询
→ 客服平台按产品对应分组轮询分配客服
→ 用户与客服实时图文沟通
→ 客服完成跟进或转化
→ 客服平台回传结果
→ 商家后台查看咨询和转化统计
```

该闭环由两个独立项目组成，但对商家、用户和客服呈现为一个完整可运营平台。
