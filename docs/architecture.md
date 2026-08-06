# 项目架构基线

本文档记录主项目开工后的强制架构边界。若实现与本文冲突，应先修改文档并说明迁移方案，不应在代码中形成第二套隐含架构。

## 1. 核心目标

主项目是面向线下门店和线上服务的双语展示、内容管理与转化平台：

- 公开用户端支持 English / Español；
- 管理后台使用中文；
- 用户端移动端优先，并支持安装为 PWA；
- PC 端使用同一信息架构自适应展开；
- 公开浏览优先使用静态资源和 R2 快照；
- 后台写入、鉴权、发布、上传和转化跳转由 Worker 处理；
- 主项目不承担完整在线客服、直播、视频转码、游戏服务器或支付结算。

## 2. 已确认的关键决策

### 2.1 单 Worker 部署，三个独立应用边界

生产环境保持一个 Cloudflare Worker，但源码和构建产物分成三个应用：

```text
apps/
├─ storefront/   English / Español 用户端和 PWA
├─ admin/        中文管理后台，不注册 Service Worker
└─ worker/       Hono API、静态资源路由和后台任务
```

部署路由：

```text
/en/*             Storefront
/es/*             Storefront
/admin/*          Admin
/api/*            Worker API
/go/:code         转化跳转
```

要求：

- Storefront 与 Admin 分别构建，不生成一个包含全部代码的前端 Bundle；
- Storefront 的 Service Worker 作用域不得覆盖 `/admin` 和 `/api`；
- Admin 不注册 Service Worker，不长期缓存身份和后台数据；
- 两个前端可以共享 `packages/ui`、类型、验证规则和设计令牌；
- Worker 内部模块化，但不为了形式拆成多个 Worker。

### 2.2 首期不做普通用户账号系统

首期公开用户端采用匿名访客模式：

- 不提供普通用户注册、密码登录或找回密码；
- `Account / Cuenta` 首期是本地设置页，包含语言、PWA 安装、隐私说明和本地数据清理；
- 客服上下文使用匿名访客标识和短期签名令牌；
- 主项目只维护管理员身份与 RBAC；
- 未来若增加普通用户账号，必须单独设计 `users`、身份、会话、注销、数据导出和数据删除流程。

该决策用于降低首期安全面、隐私义务和开发复杂度。

## 3. 统一领域命名

内部代码、数据库和 API 使用以下固定术语：

| 内部名称 | 中文含义 | 说明 |
|---|---|---|
| `Channel` | 服务频道 | 顶层业务入口 |
| `Category` | 业务分类 | 隶属于频道，可分层 |
| `Tag` | 标签 | 可跨分类组合筛选 |
| `Listing` | 展示项目 | 统一表示可公开展示的线上或线下服务 |
| `Store` | 门店 | 线下经营主体或服务地点 |

核心枚举：

```ts
type ListingKind = 'store_service' | 'online_service';

type ConversionType =
  | 'support'
  | 'tracked_link'
  | 'direct_link';
```

要求：

- 数据库统一使用 `listings`，不同时维护 `products` 和 `services` 两套近似实体；
- 用户端文案可根据语言和场景显示为 Service、Product 或 Experience；
- 后台菜单可显示“产品与服务”，但 API 和数据库不改变内部术语；
- 频道、分类、标签、转化方式均由后台配置，不写死业务行业。

## 4. 总体架构

```text
GitHub main
    │
    │ CI / migration check / deploy / smoke test
    ▼
Cloudflare Worker（单一部署）
├─ Workers Static Assets
│  ├─ Storefront build + PWA files
│  └─ Admin build
├─ Hono API
│  ├─ /api/admin/*
│  ├─ /api/auth/*
│  ├─ /api/public/*
│  ├─ /api/upload/*
│  ├─ /api/support/*
│  └─ /go/:code
├─ D1                 后台主数据
├─ R2 Public          图片和公开快照
├─ R2 Private         备份、导出和私有文件
├─ Queues             低频异步任务
├─ Analytics Engine   转化事件
├─ Web Analytics      页面和性能数据
└─ Turnstile          登录和高风险表单
```

KV 不作为默认必需资源。只有出现明确、低频、弱一致性的配置缓存需求时才接入。

## 5. 数据边界

### 5.1 核心表

```text
admin_users
roles
permissions
role_permissions
admin_user_roles
admin_sessions

channels
channel_translations
categories
category_translations
tags
tag_translations

locations
stores
store_translations
listings
listing_translations
listing_tags
store_listings

media_assets
listing_media
banners
banner_translations
content_pages
content_page_translations
faqs
faq_translations

conversion_targets
redirect_links
support_provider_configs
support_conversation_links

settings
publish_versions
publish_jobs
audit_logs
deletion_jobs
idempotency_keys
```

具体字段由迁移文件确定。所有外键、状态、时间和常用筛选字段必须建立适当索引。

### 5.2 多语言

业务实体与翻译表分离：

```text
listings
├─ id
├─ channel_id
├─ category_id
├─ kind
├─ conversion_type
├─ cover_asset_id
├─ content_status
├─ deleted_at
└─ ...

listing_translations
├─ listing_id
├─ locale       # en / es
├─ title
├─ summary
├─ description
└─ ...
```

约束：

- `locale` 使用受控值；
- 每个实体和 locale 只能有一条翻译；
- 发布前分别校验英语和西班牙语完整度；
- 缺失翻译不得静默回退为另一种语言；
- 以后增加语言时不修改主业务表结构。

## 6. 内容状态与发布状态

业务内容状态和公开发布状态必须分离。

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

后台必须显示：

- 当前内容状态；
- 英语完整度；
- 西班牙语完整度；
- 最近成功发布版本；
- 当前发布任务状态；
- 发布失败原因；
- 公开版本与当前草稿是否存在差异。

数据库保存成功不等于公开网站发布成功。

## 7. D1 与 R2 发布模型

- D1 保存草稿、关系、权限、审核状态和后台查询数据；
- Storefront 不对常规列表和筛选持续查询 D1；
- 管理员发布时生成版本化 JSON 和必要的预渲染文件；
- 所有版本文件校验完成后，最后原子更新 `current.json`；
- 旧版本保留一段时间，回滚只切换版本指针；
- 发布任务必须有互斥锁、幂等键、可重试步骤和失败恢复；
- 快照格式和兼容规则见 `docs/public-snapshot-contract.md`。

公开浏览目标：大多数请求由 Workers Static Assets、R2 自定义域名、CDN 和浏览器缓存处理。

## 8. Storefront 与 PWA

用户端固定采用移动端优先设计：

```text
移动端信息架构
→ 移动端组件
→ 平板断点
→ PC 自适应展开
```

要求：

- `/en/*` 与 `/es/*` 路由；
- 首次访问可参考浏览器语言，但不得覆盖用户手动选择；
- 首页同时包含频道入口和内容流；
- 支持地区、频道、分类和标签组合筛选；
- PC 产品列表默认一行两列；
- 移动端根据内容密度使用单列或紧凑双列；
- 卡片不显示独立缩略图；
- 有封面图时使用封面图，否则使用相册第一张；
- 图片使用统一比例和用途尺寸规范；
- 消息入口使用独立页面，不使用右下角悬浮客服按钮；
- 所有主要操作适配触摸、单手操作、安全区域和软键盘。

PWA 必须包含：

- Manifest、完整图标和 Maskable Icon；
- `display: standalone`；
- 应用壳预缓存；
- 离线页面；
- 新版本检测和更新提示；
- Android 与 iOS 安装说明；
- 过期缓存清理；
- 敏感 API `Network Only`；
- `current.json` 使用 Network First 或短缓存；
- 版本化 JSON 和不可变图片使用长期缓存。

离线状态只能展示最近成功缓存的公开内容，不能把未被服务端确认的动态操作显示为成功。

## 9. 中文管理后台

后台以桌面端高效率为主，同时保证平板和手机基本可用。

主要模块：

- 仪表盘；
- 频道、分类和标签；
- 地区、门店和展示项目；
- 英语、西班牙语翻译编辑；
- Banner、广告位和推荐位；
- 页面与 FAQ；
- 媒体资源；
- 转化目标和跳转链接；
- 转化池和广告池；
- 客服 Provider 配置；
- R2 公开域名配置和连接测试；
- 管理员、角色和权限；
- 设置、操作日志和审计；
- 回收站、发布历史和回滚。

列表组件必须统一支持分页、字段选择、行选择、当前页全选、批量操作、危险操作确认和审计记录。

## 10. 软删除与回收站

支持删除的业务表统一包含：

```text
deleted_at
deleted_by
delete_reason
```

规则：

- 回收站查询原业务表，不把所有实体正文复制到通用软删除表；
- `deletion_jobs` 只记录延迟物理清理任务；
- 删除前检查依赖关系和媒体引用；
- 明确父实体删除时子实体的阻止、解绑或级联策略；
- 恢复时重新校验唯一约束和父实体状态；
- 批量删除设置数量上限并使用 D1 batch；
- 默认采用事务性全成全败，特殊场景才允许部分成功并返回逐项结果；
- 审计日志记录操作者、目标、原因、数量和结果；
- 物理清理必须按依赖顺序执行并可重试。

## 11. R2 媒体系统

数据库只保存对象 Key，不保存完整公开 URL：

```text
listings/{listingId}/cover-{contentHash}.webp
```

最终 URL 由 `R2_PUBLIC_BASE_URL + object_key` 生成。

上传流程：

```text
创建上传预约
→ 校验管理员权限和配额
→ 分配受控对象 Key
→ 客户端压缩并上传
→ 服务端确认对象存在
→ 校验 MIME、扩展名、大小、尺寸和校验和
→ 写入 media_assets
→ 绑定业务实体
→ 未确认对象延迟清理
```

必须进一步规定：

- 卡片、详情、门店和 Banner 的固定比例与最大尺寸；
- 每种用途的最大文件大小；
- 每个 Listing 的最大图片数量；
- 是否允许 SVG、GIF 和动画格式；
- EXIF 和定位信息移除；
- 内容哈希去重；
- 封面替换和旧对象回收；
- 无引用对象保留时间；
- 公开 Bucket 与私有 Bucket 完全分离。

客户端压缩是体验和带宽优化，不能替代服务端确认与校验。

## 12. 转化与客服边界

线上服务支持：

```text
/go/:code
```

流程：

1. 验证链接启用状态；
2. 校验目标协议和域名白名单；
3. 尝试写入 Analytics Engine；
4. 统计失败不能阻断跳转；
5. 返回 302 或 307。

支持 `tracked` 和 `direct` 两种模式。

主项目只提供客服接入层和消息中心 UI，不保存完整聊天正文。首期 Provider：

```text
disabled
mock
external_link
custom
```

Chatwoot 和 TalkJS 只保留扩展位置，不在首期实现。

未来独立客服系统通过短期上下文令牌与主站连接，浏览器直接连接客服服务的 API 或 WebSocket，主 Worker 不代理每一条消息。

## 13. SEO 与静态页面

项目不采用请求时重型 SSR。若公开内容需要搜索引擎收录，发布任务同时生成：

- 关键路由的预渲染 HTML；
- `sitemap.xml`；
- `robots.txt`；
- canonical URL；
- `hreflang`；
- Open Graph 元数据；
- 合适的结构化数据。

这些文件作为版本化发布产物生成，不在每次公开请求中查询 D1 后渲染。

## 14. 环境隔离

环境：

```text
local
preview
production
```

Preview 和 Production 必须使用独立的：

- D1 数据库；
- R2 Bucket；
- KV（若启用）；
- Queue；
- Analytics Engine 数据集；
- Cookie 名称；
- 加密密钥；
- 客服 Provider 配置；
- `current.json` 和发布版本目录。

预览发布不得覆盖生产指针或读取生产 Secret。

## 15. Worker 工程规则

- 新工程设置明确的 `compatibility_date`，并建立定期升级流程；
- 是否启用 `nodejs_compat` 由实际依赖决定，并通过构建与运行测试验证；
- 使用 Wrangler 生成绑定类型，不手写易漂移的 `Env`；
- Secret 只通过 Cloudflare Secrets 管理；
- 优先使用 D1、R2、Queue 等进程内绑定，不在 Worker 内调用 Cloudflare REST API；
- 请求级数据不得存放在模块级可变变量中；
- 所有 Promise 必须 `await`、`return`、显式 `void` 或交给 `ctx.waitUntil()`；
- 大文件和未知长度响应使用流式处理；
- 不使用 `Math.random()` 生成安全令牌；
- 统一结构化错误、错误码和请求 ID；
- 开启结构化日志和采样可观测性；
- 日志中不记录密码、Token、聊天正文或完整敏感参数。

## 16. 安全基线

- 管理后台建议由 Cloudflare Access 提供第一层保护；
- 应用内部仍执行 RBAC；
- 管理员 Cookie 使用 `HttpOnly`、`Secure` 和适当的 `SameSite`；
- 登录和高风险表单接入 Turnstile；
- 第三方 Secret 使用主密钥加密后存入 D1；
- CORS 仅允许明确的生产和预览 Origin；
- 外部跳转只允许批准协议和域名；
- 重要写操作使用幂等键；
- 所有后台写操作写入审计日志；
- Service Worker 不缓存后台、身份、客服令牌和私密消息接口；
- 部署者负责确认业务内容、年龄限制、隐私、数据保留和当地法律要求。

## 17. 可观测性、备份和恢复

这些能力从数据库和 Worker 初始化阶段开始建设，不推迟到项目末期：

- 健康检查；
- 请求 ID 和结构化日志；
- 发布任务日志；
- Worker、D1、R2 和 Queue 使用量监控；
- 数据库迁移记录和迁移前检查；
- D1 备份或导出流程；
- 恢复演练；
- Worker 版本回滚；
- 内容版本指针回滚；
- 发布失败告警和操作指引。

恢复流程必须经过实际演练，不能只保留未验证的脚本。

## 18. 架构原则

1. 移动端优先，PC 自适应。
2. Storefront 与 Admin 分开构建，单 Worker 合并部署。
3. 首期普通用户匿名使用，管理员身份独立管理。
4. 内部统一使用 Channel、Category、Tag、Listing、Store。
5. D1 是后台主数据源，R2 是公开发布层。
6. Storefront 从第一天使用正式快照协议，不先接临时列表 API。
7. 数据库只保存媒体对象 Key。
8. 高频事件不写 D1。
9. 发布状态与内容状态分离。
10. 软删除保留在原业务表，物理清理由任务处理。
11. PWA 缓存不能绕过更新、权限和数据生命周期。
12. 测试、备份、监控和安全随阶段同步建设。
13. 免费额度不足时先优化和降级，再升级套餐。
14. 安全、隐私和法律合规优先于功能数量。
