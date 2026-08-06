# 业务运营平台

本仓库承载一个完整的业务运营平台：

- **Storefront**：English / Español 用户展示前端；
- **Admin**：中文商家管理后台；
- **Worker**：业务 API、静态资源路由、发布与集成任务。

实时在线客服不在本仓库开发。客服账号、客服分组、轮询分配、等待队列、WebSocket 图文会话、跟进和转化由独立的 `support-platform` 项目负责。

## 最终项目边界

```text
项目一：Qz121314/site
├─ 用户前端
├─ 商家后台
├─ 业务 API
├─ D1 主业务数据库
├─ R2 媒体和公开快照
└─ 客服平台接入与转化结果展示

项目二：Qz121314/support-platform
├─ 客服管理后台
├─ 客服工作台
├─ 客服组和客服成员
├─ 产品客服路由
├─ 轮询分配和等待队列
├─ WebSocket 实时图文会话
└─ 会话、线索、跟进和转化
```

两个项目通过标准 HTTPS API、WebSocket 和签名 Webhook 连接，不依赖 Cloudflare Service Bindings，可以部署在不同 Cloudflare 账号、不同云平台或自购服务器。

## 当前开发范围

当前先完成本仓库的业务数据和商家后台核心：

```text
领域模型和数据库
→ 管理 API 与权限
→ 中文后台数据录入
→ 媒体管理
→ 发布和公开快照
→ Storefront 用户前端
→ 客服平台接入契约
→ 转化结果展示
```

在业务运营平台的数据模型和发布链路稳定前，不在本仓库中开发实时客服后端。

## 仓库结构

```text
site/
├─ apps/
│  ├─ storefront/       用户前端和 PWA
│  ├─ admin/            中文商家后台
│  └─ worker/           Hono API 和静态资源路由
├─ packages/
│  ├─ domain/
│  ├─ db/
│  ├─ api-contracts/
│  ├─ support-contracts/
│  ├─ ui/
│  └─ config/
├─ migrations/
├─ scripts/
├─ tests/
├─ docs/
├─ wrangler.jsonc
└─ package.json
```

Storefront、Admin 和 Worker 分别构建，但共同属于同一个业务运营平台。

## Cloudflare 部署

本仓库只维护一个正式 Worker：

```text
service-catalog-site
```

路由：

```text
/en/*          English Storefront
/es/*          Español Storefront
/admin/*       商家后台
/api/*         业务 API
/go/:code      转化跳转
```

PR 只执行校验，不创建长期 Preview Worker。`main` 通过验证后部署唯一正式 Worker。

## 数据职责

### 本仓库拥有

- 商家和管理员；
- 角色、权限和审计；
- 频道、分类和标签；
- 地区、门店和 Listing；
- English / Español 内容；
- 图片、Banner、页面和 FAQ；
- 发布版本与公开快照；
- 外部客服平台连接；
- 产品绑定的外部客服组引用；
- 客服平台回传的咨询与转化统计结果。

### 客服平台拥有

- 客服账号；
- 客服分组和成员；
- 轮询规则；
- 在线状态和接待上限；
- 会话分配和等待队列；
- 实时消息和附件；
- 转接、跟进与原始转化记录。

两套系统不能共用数据库，也不能直接修改对方数据表。

## 客服接入方式

商家后台提供“客服系统接入”模块，保存：

```text
API 地址
WebSocket 地址
系统实例 ID
租户 ID
接口版本
Client ID
加密凭证
Webhook Secret
连接状态
```

连接后，后台只读客服平台的分组目录。产品可以选择外部客服组，但客服成员、轮询规则和接待设置必须在客服平台中管理。

用户点击产品咨询按钮后的流程：

```text
Storefront
→ 本项目 API 校验产品
→ HTTPS 调用客服平台创建会话
→ 客服平台在产品对应分组中轮询分配客服
→ 返回短期会话令牌
→ 用户连接客服平台 WebSocket
```

客服平台通过签名 Webhook 回传会话和转化事件。

## 用户端要求

- English / Español；
- 移动端优先；
- PC 产品列表默认一行两列；
- 分类下拉菜单和标签筛选按钮；
- 卡片不显示独立缩略图；
- 有封面图时使用封面图，否则使用产品图片第一张；
- 图片尺寸和比例统一；
- 产品详情提供实时客服咨询入口；
- PWA 缓存不得覆盖 `/admin` 和敏感 API。

## 商家后台要求

- 商家、管理员、角色和权限；
- 频道、分类和标签；
- 地区、门店和 Listing；
- 双语内容编辑；
- 图片和媒体；
- Banner、广告位和推荐位；
- 客服平台接入和外部客服组选择；
- 转化池和广告池；
- 发布、回滚、回收站和审计。

所有涉及删除的列表必须支持：

- 行选择；
- 当前页全选；
- 批量删除；
- 删除确认；
- 软删除和恢复；
- 审计日志。

## 文档

- [项目架构基线](docs/architecture.md)
- [开发阶段与交付计划](docs/development-plan.md)
- [公开快照协议](docs/public-snapshot-contract.md)
- [阶段 0 状态](docs/phase-0-status.md)

架构和实现发生冲突时，以 `docs/architecture.md` 为准。
