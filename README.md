# Cloudflare 服务聚合与转化平台模板

> 面向线下服务门店与线上服务的双语展示、内容管理和转化平台模板。

用户端支持 **English / Español**，管理后台使用中文。项目以移动端 UI 为核心，PC 端基于同一信息架构自适应展开。主网站用户端支持安装为 PWA，并优先运行在 Cloudflare 免费计划资源边界内。

## 项目状态

当前阶段：**架构基线已优化，准备开始阶段 0 工程初始化。**

本仓库是可重复部署的项目模板，不绑定具体品牌、域名、地区或行业。频道、分类、标签、地区、门店、展示项目、广告位和转化方式均由中文后台动态配置，不在源码中写死。

## 文档入口

- [项目架构基线](docs/architecture.md)
- [开发阶段与交付计划](docs/development-plan.md)
- [公开快照协议](docs/public-snapshot-contract.md)

README 只保留项目入口和关键决策。详细规则以上述文档为准。

## 项目定位

平台统一承载两类业务：

1. **线下门店服务**：用户浏览门店或服务后，通过独立消息中心进入第三方客服系统完成后续转化。
2. **线上服务**：约会交友、游戏、直播、视频及其他在线服务，通过安全、可追踪的跳转链接完成转化。

主项目负责：

- English / Español 公开内容；
- 移动端优先的应用式体验；
- PWA 安装、更新和离线应用壳；
- 频道、分类、标签、地区、门店和展示项目；
- 中文管理后台；
- 图片与公开内容发布；
- 外部跳转与转化统计；
- 第三方客服接入层；
- 管理员权限、审计、部署和运维。

主项目默认不实现：

- 直播推流和视频转码；
- 游戏服务器；
- 支付结算；
- 用户间社交私信；
- 完整在线客服后端；
- 首期普通用户注册和密码登录。

## 已确认的关键优化

### 1. 单 Worker 部署，前端分开构建

生产环境仍保持一个 Cloudflare Worker，但源码拆成：

```text
apps/
├─ storefront/   English / Español 用户端 + PWA
├─ admin/        中文管理后台
└─ worker/       Hono API 和静态资源路由
```

路由：

```text
/en/*
/es/*
/admin/*
/api/*
/go/:code
```

Storefront 与 Admin 分别构建。Storefront 的 Service Worker 不得控制 `/admin` 或 `/api`，后台不注册 Service Worker。

### 2. 首期采用匿名访客模式

公开用户端首期不做注册和密码登录。

`Account / Cuenta` 页面用于：

- 语言设置；
- PWA 安装；
- 隐私说明；
- 清理本地数据。

管理员身份和权限系统独立实现。客服使用匿名访客标识和短期签名令牌。

### 3. 统一领域模型

内部代码、数据库和 API 固定使用：

```text
Channel     服务频道
Category    业务分类
Tag         标签
Listing     统一展示项目
Store       门店
```

数据库统一使用 `listings`，不同时维护两套含义近似的 `products` 和 `services` 表。

```ts
type ListingKind = 'store_service' | 'online_service';

type ConversionType =
  | 'support'
  | 'tracked_link'
  | 'direct_link';
```

用户端可根据语言和场景显示为 Service、Product 或 Experience，但内部术语保持一致。

### 4. D1 是后台主数据源，R2 是公开发布层

- D1 保存草稿、关系、权限和后台状态；
- Storefront 的常规列表与筛选不持续查询 D1；
- 发布时生成不可变、版本化的 R2 快照；
- 所有文件验证完成后才切换 `current.json`；
- 旧版本保留用于快速回滚；
- Storefront 从第一版开始使用正式快照协议，不接临时列表 API。

### 5. 发布状态与内容状态分离

```ts
type ContentStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'published'
  | 'archived';

type PublishStatus =
  | 'not_published'
  | 'queued'
  | 'building'
  | 'published'
  | 'failed';
```

数据库保存成功不等于公开网站已经发布成功。

### 6. 软删除保留在原业务表

支持删除的业务表统一包含：

```text
deleted_at
deleted_by
delete_reason
```

回收站查询原表。`deletion_jobs` 只负责延迟物理清理，不创建一张保存所有实体正文的通用软删除表。

### 7. 媒体上传采用预约、确认和回收流程

```text
创建上传预约
→ 校验权限和配额
→ 分配受控对象 Key
→ 客户端压缩并上传
→ 服务端确认和校验
→ 写入 media_assets
→ 绑定业务实体
→ 未确认对象延迟清理
```

数据库只保存 R2 对象 Key，不保存完整公开 URL。客户端压缩不能替代服务端确认与校验。

### 8. 环境资源完全隔离

`preview` 和 `production` 使用独立的：

- D1；
- R2 Bucket；
- Queue；
- Analytics 数据集；
- Cookie 名称；
- Secret 和加密密钥；
- 客服配置；
- 发布版本目录和 `current.json`。

## 用户端要求

- `/en/*` 和 `/es/*`；
- 用户主动选择语言并持久保存；
- 首次访问可参考浏览器语言，但不覆盖用户选择；
- 首页同时展示频道入口和内容流；
- 支持地区、频道、分类和标签组合筛选；
- 移动端使用底部导航、抽屉、底部弹层和单列内容流；
- PC 端基于同一组件体系自适应展开；
- PC Listing 列表默认一行两列；
- 移动端根据内容密度使用单列或紧凑双列；
- 卡片不显示独立缩略图；
- 有封面图时优先使用封面图，否则使用相册第一张；
- 图片采用统一比例和用途尺寸规范；
- 线下服务显示联系客服入口；
- 线上服务显示可配置跳转入口；
- 使用独立消息中心，不使用右下角悬浮客服图标；
- 加载、空状态、错误、离线和更新状态必须清晰；
- 适配触摸、单手操作、安全区域、软键盘和键盘导航。

推荐一级导航：

```text
English: Home / Services / Stores / Messages / Account
Español: Inicio / Servicios / Tiendas / Mensajes / Cuenta
```

## PWA 要求

Storefront 必须包含：

- Web App Manifest；
- 应用图标和 Maskable Icon；
- `display: standalone`；
- Service Worker；
- 应用壳预缓存；
- 静态资源版本缓存；
- 离线页面；
- 新版本检测与更新提示；
- Android 与 iOS 安装说明；
- 过期缓存清理；
- 安装状态检测。

缓存规则：

- 内容哈希静态资源长期缓存；
- R2 不可变图片长期缓存；
- R2 版本化 JSON 长期缓存；
- `current.json` 使用 Network First 或短缓存；
- 登录、后台、上传、客服令牌和权限接口使用 Network Only；
- 离线状态只展示最近成功缓存的公开内容；
- 未经服务端确认的动态操作不得显示为成功。

## 中文管理后台

主要模块：

- 仪表盘；
- 频道、分类和标签；
- 地区与门店；
- Listing 与双语翻译；
- Banner、广告位和推荐位；
- 页面与 FAQ；
- 媒体资源；
- 转化目标和跳转链接；
- 转化池与广告池；
- 客服 Provider；
- R2 公开域名设置和连接测试；
- 管理员、角色和权限；
- 系统设置；
- 发布历史和回滚；
- 回收站；
- 操作日志和审计。

所有涉及删除的列表必须统一支持：

- 行选择；
- 当前页全选；
- 批量删除；
- 删除确认；
- 软删除和恢复；
- 审计日志。

## 建议技术栈

### Storefront 与 Admin

- React；
- TypeScript；
- Vite；
- React Router；
- TanStack Query；
- TanStack Table；
- React Hook Form；
- Zod；
- Tailwind CSS；
- i18next 或等价类型安全国际化方案；
- Vite PWA 插件、Workbox 或等价工具；
- Vitest；
- Playwright。

### Worker

- Cloudflare Workers；
- Hono；
- TypeScript；
- Zod；
- Drizzle ORM 或轻量 SQL 层；
- Cloudflare Web Crypto；
- Wrangler 4.x。

原则：不引入重量级请求时 SSR，不在免费 Worker 请求中执行重型计算，不让公开页面访问逐次查询 D1。

## 计划仓库结构

```text
site/
├─ apps/
│  ├─ storefront/
│  │  ├─ public/
│  │  └─ src/
│  ├─ admin/
│  │  └─ src/
│  └─ worker/
│     └─ src/
│        ├─ routes/
│        ├─ services/
│        ├─ repositories/
│        ├─ middleware/
│        └─ jobs/
├─ packages/
│  ├─ db/
│  ├─ domain/
│  ├─ api-contracts/
│  ├─ shared/
│  ├─ ui/
│  ├─ i18n/
│  ├─ support-contracts/
│  └─ config/
├─ migrations/
├─ scripts/
├─ tests/
├─ docs/
├─ .github/workflows/
├─ wrangler.jsonc
├─ pnpm-workspace.yaml
└─ package.json
```

## 优化后的开发顺序

```text
阶段 0：工程初始化
阶段 1：领域模型、D1、管理员鉴权和审计
阶段 2：R2 媒体系统
阶段 3：最小 D1 → R2 发布管线
阶段 4：双语 Storefront 与 PWA
阶段 5：完整中文管理后台
阶段 6：转化与客服接入层
阶段 7：运营模块、模板化与正式验收
阶段 8：独立客服系统（另一个项目）
```

测试、备份、监控和安全不是最后阶段的任务，而是每个阶段的完成条件。

## 首个交付闭环

```text
中文后台登录
→ 创建频道、分类和标签
→ 创建门店和 Listing
→ 上传封面和相册
→ 编辑 English / Español
→ 发布到 R2 快照
→ /en 和 /es 读取正式快照
→ 列表筛选和详情
→ 联系客服或外部跳转
```

在该闭环稳定前，延后完整仪表盘、复杂广告能力、Chatwoot/TalkJS 适配器和普通用户账号系统。

## 部署与 CI

环境：

```text
local
preview
production
```

生产流程：

```text
push/merge main
→ install
→ lint
→ typecheck
→ unit and contract tests
→ PWA validation
→ build
→ migration validation
→ Wrangler deploy
→ health and smoke tests
→ current.json validation
→ PWA installability check
```

GitHub 配置：

```text
Secret:
CLOUDFLARE_API_TOKEN

Variable or Secret:
CLOUDFLARE_ACCOUNT_ID
```

真实密钥、账户 ID、域名和敏感数据不得写入源码、README、Issue 或日志。

## Worker 工程规则

- 使用明确的 `compatibility_date` 并定期升级；
- 使用 Wrangler 生成绑定类型；
- Secret 只使用 Cloudflare Secrets；
- 优先使用 D1、R2、Queue 等绑定，不在 Worker 内调用 Cloudflare REST API；
- 不使用模块级可变变量保存请求状态；
- 所有 Promise 必须被等待、返回、显式忽略或交给 `ctx.waitUntil()`；
- 大文件和未知长度响应使用流；
- 安全令牌使用 Web Crypto；
- 统一错误码、请求 ID 和结构化日志；
- 日志不记录密码、Token、聊天正文或完整敏感参数。

## 验收基线

主版本完成必须满足：

- English / Español 用户端完整可用；
- 移动端是设计和验收第一目标；
- PC 使用同一组件体系自适应；
- Storefront 可以安装为 PWA；
- Service Worker 不缓存敏感接口或控制后台；
- 中文后台完整可用；
- 频道、分类、标签和转化方式不写死；
- 所有删除列表支持选择、全选、批量删除和恢复；
- R2 公开域名可配置和测试；
- 数据库只保存媒体对象 Key；
- 公开浏览主要从 Static Assets 和 R2 读取；
- 快照发布具有幂等、校验、原子切换和回滚；
- 外部跳转安全、可统计并可降级；
- 主项目不保存完整客服消息正文；
- Preview 和 Production 资源完全隔离；
- CI、迁移、备份、恢复、监控和故障处理流程可执行；
- 无敏感信息进入源码和日志。

## 开发原则

1. 移动端优先，PC 自适应。
2. Storefront 与 Admin 分开构建，单 Worker 合并部署。
3. 首期普通用户匿名使用。
4. 先固定领域和发布协议，再开发依赖它们的 UI。
5. D1 是后台主数据源，R2 是公开发布层。
6. 数据库只保存媒体对象 Key。
7. 内容状态与发布状态分离。
8. 高频事件不写 D1。
9. 软删除保留在原业务表。
10. PWA 缓存不能绕过更新、权限和数据生命周期。
11. 测试、备份、监控和安全随阶段同步建设。
12. 免费额度不足时先优化和降级，再升级套餐。
13. 安全、隐私和法律合规优先于功能数量。
