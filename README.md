# Cloudflare 服务聚合与转化平台模板

> 面向线下服务门店与线上服务的双语展示、内容管理和转化平台模板。
>
> 用户端支持 **English / Español**，管理后台使用中文。项目以**移动端 UI 为核心**，PC 端基于同一信息架构自适应展开。主网站用户端必须支持 PWA 安装到手机桌面。项目优先运行在 Cloudflare 免费计划上，并通过静态化、R2 公开快照、CDN 缓存和轻量 API 设计，尽可能减少 Worker 与 D1 的动态消耗。

## 1. 项目状态

当前阶段：**架构与开发计划已确定，准备从零初始化工程。**

本仓库是可重复部署的项目模板，不绑定具体品牌、域名、地区或业务分类。所有服务频道、分类、标签、地区、门店、产品、广告位和转化方式均由中文后台动态配置，不在源码中写死。

## 2. 项目定位

平台统一展示两类业务：

1. **线下服务门店**：用户浏览门店或服务产品后，进入独立的站内消息中心咨询客服，由第三方客服系统完成后续转化。
2. **线上服务**：约会交友、游戏、直播、视频及其他在线服务，通过可追踪跳转链接完成转化。

平台自身主要负责：

- 双语内容展示；
- 移动端优先的应用式用户体验；
- 主网站 PWA 安装与离线应用壳；
- 服务发现、分类、标签和地区筛选；
- 门店、产品、图片、页面和广告管理；
- 外部跳转与转化统计；
- 第三方客服系统接入；
- 后台权限、审计和运营数据；
- Cloudflare 资源管理和自动部署。

本模板默认**不实现**直播推流、视频转码、游戏服务器、支付结算、用户间社交私信或完整在线客服服务。这些高成本或强实时能力应由独立系统提供。

## 3. 已确定的产品要求

### 3.1 用户端

- 支持英语和西班牙语；
- 用户可主动选择语言并持久保存；
- 首次访问可参考浏览器语言，但不得覆盖用户已经选择的语言；
- 推荐路由：`/en/*` 与 `/es/*`；
- 所有用户端页面以移动端交互和视觉密度为设计基线；
- 移动端优先使用底部导航、抽屉、全屏选择器和单列内容流；
- PC 端基于同一组件和信息架构自适应展开，不单独维护另一套前端；
- 首页采用服务频道入口与产品内容流并存的结构，不做只有分类入口的空首页；
- 服务频道、分类和标签全部由后台动态创建；
- 支持地区、服务频道、分类与产品标签组合筛选；
- 分类数量较多时，移动端采用分层选择、搜索或底部弹层，PC 端可展开为侧边筛选；
- PC 产品列表默认一行两列；
- 移动端产品列表根据内容密度采用单列或紧凑双列；
- 产品卡片不显示独立缩略图；
- 有封面图时优先使用封面图，没有封面图时使用产品相册第一张；
- 产品图片采用统一比例和尺寸规范；
- 线下服务显示“联系客服”入口；
- 线上服务显示可配置的外部跳转入口；
- 提供独立消息中心页面，不使用右下角悬浮客服图标；
- 所有主要操作必须适配触摸操作、单手使用、安全区域和手机软键盘；
- 加载、空状态、错误、离线和更新状态必须有明确反馈。

推荐一级导航：

```text
English: Home / Services / Stores / Messages / Account
Español: Inicio / Servicios / Tiendas / Mensajes / Cuenta
```

### 3.2 移动优先与响应式规范

设计顺序固定为：

```text
移动端信息架构
→ 移动端页面和组件
→ 平板断点
→ PC 端自适应展开
```

不采用“先设计桌面页面，再压缩到手机”的方式。

主要规范：

- 移动端是产品设计和验收的第一目标；
- PC 端允许增加留白、侧栏、多列和悬停辅助，但不得改变核心操作逻辑；
- 组件默认使用流式宽度和内容驱动高度；
- 避免固定像素宽度造成小屏溢出；
- 使用 CSS Grid、Flexbox、Container Queries 或等价响应式方案；
- 表格在手机端转换为卡片、分组列表或可横向滚动的精简视图；
- 弹窗在手机端优先转换为全屏页或底部弹层；
- 表单在手机端采用单列，关键提交操作固定在易触达区域；
- 消息中心在手机端使用“会话列表 → 独立聊天页”，PC 端使用“会话列表 + 当前聊天”；
- 图片、字体、脚本按移动网络条件控制体积和加载优先级；
- 支持系统深色模式属于可选增强，不作为首期硬性要求。

### 3.3 PWA 要求

主网站用户端必须具备可安装 PWA 能力，可从支持的手机浏览器添加到桌面并以独立应用窗口运行。

必须包含：

- Web App Manifest；
- 应用名称、短名称、主题色和背景色；
- 完整的应用图标与 Maskable Icon；
- `display: standalone` 或等价应用模式；
- Service Worker；
- 应用壳预缓存；
- 静态资源版本缓存；
- 新版本检测与更新提示；
- 离线页面；
- 安装状态检测；
- Android 和 iOS 添加到主屏幕说明；
- PWA 相关文件通过 Workers Static Assets 提供。

PWA 缓存必须遵守：

- HTML 应用壳可缓存，但要能够检测新版本；
- 带内容哈希的 JS、CSS、字体和图标使用长期缓存；
- R2 版本化 JSON 与不可变图片可使用长期缓存；
- `current.json` 等版本指针使用网络优先或短缓存；
- 登录、权限、后台、客服令牌和其他敏感 API 不写入长期离线缓存；
- 离线状态下不得把未发送成功的动态操作显示为成功；
- Service Worker 更新后清理过期缓存，避免长期占用设备空间。

PWA 的目标是增强安装、启动速度和弱网体验，不承诺在完全离线时使用所有动态业务功能。

### 3.4 中文管理后台

后台界面仅使用中文，但所有公开内容支持英语和西班牙语两个语言版本。

后台以桌面端高效率操作为主，同时保证平板和手机具备基本可用性；首期不要求主项目管理后台安装为 PWA。

主要模块：

- 仪表盘；
- 服务频道管理；
- 分类管理；
- 标签管理；
- 地区与门店管理；
- 产品与服务管理；
- Banner、广告位与推荐位；
- 页面与 FAQ 管理；
- 媒体资源管理；
- 外部转化链接管理；
- 转化池与广告池；
- 在线客服服务商绑定；
- R2 存储与公开域名设置；
- 用户、角色与权限；
- 系统设置；
- 操作日志与审计。

后台所有涉及删除的列表必须支持：

- 行选择；
- 当前页全选；
- 批量删除；
- 删除确认；
- 软删除或回收站；
- 审计日志。

FAQ 正文支持普通文本与 Markdown。

### 3.5 多语言数据结构

不在业务表中不断增加 `title_en`、`title_es` 等字段。采用实体表与翻译表分离：

```text
services
├─ id
├─ section_id
├─ category_id
├─ status
├─ cover_asset_id
├─ conversion_type
└─ ...

service_translations
├─ service_id
├─ locale        # en / es
├─ title
├─ summary
├─ description
└─ ...
```

以后增加其他语言时，不需要修改主要业务表结构。

## 4. 总体技术架构

```text
GitHub Repository
       │
       │ main 分支自动构建与部署
       ▼
Cloudflare Worker（单一主项目部署）
├─ Workers Static Assets
│  ├─ English / Español 移动优先用户端
│  ├─ PWA Manifest / Service Worker / Icons
│  └─ 中文管理后台
│
├─ 轻量 Worker API
│  ├─ /api/admin/*          后台管理
│  ├─ /api/auth/*           身份与会话
│  ├─ /api/public/*         少量必须动态的公开接口
│  ├─ /api/support/*        第三方客服接入网关
│  ├─ /api/upload/*         上传授权与媒体管理
│  └─ /go/:code             转化统计后跳转
│
├─ D1                       业务主数据
├─ R2 Public                公开图片与公开目录快照
├─ R2 Private               备份、导出、私有文件
├─ KV                       极少量配置与短缓存
├─ Queues                   低频异步任务
├─ Analytics Engine         转化事件与运营事件
├─ Web Analytics            页面访问与性能数据
└─ Turnstile                防机器人
```

主项目保持一个 Worker 部署，代码内部模块化。在线客服系统未来作为独立第三方项目、独立仓库、独立 Worker 和独立数据库开发。

## 5. 建议技术栈

### 前端

- React；
- TypeScript；
- Vite；
- React Router；
- TanStack Query；
- TanStack Table；
- React Hook Form；
- Zod；
- Tailwind CSS；
- i18next 或等价的类型安全国际化方案；
- Web App Manifest；
- Service Worker；
- Workbox、Vite PWA 插件或等价标准化 PWA 工具；
- Vitest；
- Playwright。

### Worker 后端

- Cloudflare Workers；
- Hono；
- TypeScript；
- Zod；
- Drizzle ORM 或轻量 SQL 查询层；
- Cloudflare Web Crypto；
- Wrangler 4.x。

原则：不引入重量级 SSR 框架，不在免费 Worker 请求中执行重型计算，不让每一个公开页面访问都查询 D1。

## 6. Cloudflare 免费计划资源预算

以下数值依据 Cloudflare 官方文档，最后核对日期为 **2026-08-05**。Cloudflare 可能调整限制，正式部署前应再次检查官方文档。

| 产品 | 免费计划关键额度 | 本项目用途 |
|---|---:|---|
| Workers | 100,000 动态请求/天；10ms CPU/请求；128MB 内存 | API、后台、鉴权、跳转 |
| Static Assets | 静态资源请求免费且不限量；单版本最多 20,000 个文件 | React、PWA、JS、CSS、字体和静态页面壳 |
| D1 | 5,000,000 行读取/天；100,000 行写入/天 | 业务主数据和后台查询 |
| D1 存储 | 免费账户最多 10 个数据库；单库 500MB；总计 5GB | 平台数据库、测试数据库 |
| D1 Time Travel | 7 天 | 短期恢复保障 |
| R2 Standard | 10GB/月；100万 Class A；1000万 Class B；出口流量免费 | 图片、快照、备份 |
| KV | 100,000 读/天；1,000 写/天；1GB | 极少量配置与短缓存 |
| Queues | 10,000 次操作/天；免费层消息最多保留 24 小时 | 发布、Webhook、清理任务 |
| Analytics Engine | 100,000 数据点写入/天；10,000 查询/天 | 业务点击与转化事件 |
| Turnstile | 最多 20 个 Widget；验证请求不限量 | 登录、表单和高风险操作 |
| Workers Builds | 3,000 构建分钟/月；1 个并发构建 | CI/CD |
| Web Analytics | 免费、隐私优先 | 页面访问和 Web 性能 |

官方文档：

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Static Assets billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 custom-domain cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)
- [Workers KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)
- [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)
- [Workers Builds limits](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)
- [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/about/)

## 7. 免费额度优先架构

### 7.1 核心目标

目标不是让所有请求都经过 Worker，而是让大多数访问走以下路径：

```text
浏览器 / 已安装 PWA
├─ 应用 JS/CSS/HTML ──────> Workers Static Assets + 浏览器缓存
├─ 产品图片 ──────────────> R2 自定义域名 + CDN Cache
└─ 已发布目录 JSON ───────> R2 自定义域名 + CDN Cache
```

只有以下操作调用 Worker：

- 后台管理；
- 登录与权限验证；
- 内容发布；
- 上传授权；
- 转化跳转；
- 客服上下文令牌；
- 必须实时校验的动态操作。

架构目标是让公开浏览流量中至少 **90%** 不调用 Worker。该比例是设计目标，不是流量保证。

### 7.2 D1 作为主数据源，R2 作为公开发布层

D1 保存草稿、正式数据、关系、权限和后台状态，但用户端不直接频繁查询 D1。

后台发布内容时生成不可变的公开快照：

```text
catalog/
├─ current.json
└─ versions/
   └─ 2026-08-05T190000Z-a1b2c3/
      ├─ manifest.json
      ├─ en/
      │  ├─ home.json
      │  ├─ sections/{slug}.json
      │  ├─ services/{id}.json
      │  └─ search-index.json
      └─ es/
         ├─ home.json
         ├─ sections/{slug}.json
         ├─ services/{id}.json
         └─ search-index.json
```

发布策略：

1. 后台写入 D1；
2. 管理员点击发布；
3. Worker 或 Queue 生成新版本快照；
4. 快照写入 R2；
5. 最后更新 `current.json` 指向新版本；
6. 前端读取新版本；
7. 旧版本延迟清理，用于快速回滚。

缓存策略：

- `current.json`：短缓存，例如 30～60 秒；
- 带版本号的 JSON：`public, max-age=31536000, immutable`；
- 图片：不可变 Key + 长缓存；
- 内容变化时生成新 Key，不覆盖旧文件。

这样可以避免：

- 首页每次访问查询 D1；
- 分类筛选不断调用 Worker；
- 热门产品消耗大量 D1 行读取；
- 图片访问持续消耗 R2 源站读取操作。

### 7.3 前端筛选优先在浏览器完成

公开产品列表、频道、标签和地区索引从 R2 快照加载。常规筛选在浏览器本地完成。

当数据量增加时：

- 按服务频道拆分文件；
- 按地区拆分文件；
- 按语言拆分文件；
- 使用轻量搜索索引；
- 列表分页或游标加载；
- 不让客户端一次下载整个数据库。

后台搜索仍可使用 D1，并要求分页、索引和字段选择。

### 7.4 D1 使用规则

- 所有外键、状态、时间和常用筛选字段建立索引；
- 禁止公开列表执行 N+1 查询；
- 禁止无条件 `SELECT *`；
- 列表必须分页；
- 批量操作使用 D1 batch；
- 页面浏览量和点击量不得逐次写入 D1；
- 高频统计进入 Analytics Engine；
- D1 只保存必要汇总结果；
- 定期清理软删除数据和无引用媒体记录。

### 7.5 KV 使用规则

KV 免费层写入额度较低，因此不能作为主数据库，也不能用于每次请求都变化的数据。

KV 只用于：

- 极少变化的运行配置；
- 短期功能开关；
- 发布版本指针的备用缓存；
- 非关键的只读缓存。

不用于：

- 点击计数；
- 会话消息；
- 产品数据；
- 订单或线索；
- 高频限流计数。

### 7.6 Queues 使用规则

一条成功处理的消息通常产生写入、读取、删除三次操作，因此免费层不适合逐条处理页面访问或点击。

Queues 仅用于低频任务：

- 公开快照发布；
- Webhook 重试；
- 媒体垃圾回收；
- 定时汇总；
- 低频通知；
- 备份任务编排。

### 7.7 Analytics 使用规则

- 页面访问、访客和性能：Cloudflare Web Analytics；
- 产品点击、客服入口点击、外部转化：Analytics Engine；
- 关键业务事件每次最多写一个数据点；
- 高流量时允许采样非关键事件；
- Analytics Engine 写入失败不能阻断用户跳转；
- D1 只保存按日或按产品汇总后的数据。

### 7.8 转化跳转

线上服务使用内部短链接：

```text
/go/{code}
```

流程：

1. 验证跳转记录启用；
2. 校验目标协议与域名白名单；
3. 尝试写入 Analytics Engine；
4. 即使统计失败也继续跳转；
5. 返回 302/307 到目标地址。

后台可配置两种模式：

- `tracked`：经过 `/go/{code}`，记录转化；
- `direct`：直接跳转，用于应急降级或超高流量场景。

### 7.9 PWA 缓存与免费流量优化

PWA 主要缓存应用壳和已版本化的公开资源，以降低重复下载和弱网等待时间。

建议策略：

- 应用壳：预缓存；
- 内容哈希静态资源：Cache First；
- R2 不可变图片：Cache First，并限制本地缓存总量；
- R2 版本化公开 JSON：Stale While Revalidate 或 Cache First；
- `current.json`：Network First，失败时允许使用最近一次有效版本；
- 动态身份和权限接口：Network Only；
- 后台写操作和客服令牌：Network Only；
- 离线访问仅展示最近成功缓存的公开内容；
- 本地缓存不是业务数据库，不保存必须由服务端确认的最终状态。

PWA 缓存可以减少重复静态读取，但不能用来绕过内容更新、权限校验或数据销毁规则。

## 8. R2 存储与自定义域名

### 8.1 Bucket 规划

```text
site-public-media
├─ 产品封面
├─ 产品相册
├─ 门店图片
├─ Banner
├─ 公开二维码
└─ 公开目录快照

site-private-files
├─ D1 导出
├─ 后台导出文件
├─ 未审核文件
├─ 临时文件
└─ 私有备份
```

公开 Bucket 绑定自定义域名，私有 Bucket 不公开。

### 8.2 域名配置流程

域名由部署者手动设置：

1. 在 Cloudflare R2 控制台创建公开 Bucket；
2. 在 Bucket 的 `Settings → Public access → Custom Domains` 中绑定域名；
3. 等待 SSL 和域名状态正常；
4. 在中文后台填写 R2 公开基础域名；
5. 后台执行连接测试；
6. 测试成功后启用。

例如：

```text
https://media.example.com
```

不使用 `r2.dev` 作为生产图片地址。

### 8.3 数据库存储对象 Key

数据库只保存：

```text
products/{productId}/cover-{contentHash}.webp
```

不保存：

```text
https://media.example.com/products/...
```

最终 URL 在返回前端时拼接：

```text
R2_PUBLIC_BASE_URL + object_key
```

更换 R2 自定义域名时，只修改后台配置，不批量修改业务数据。

### 8.4 图片优化

为节省 R2 存储和读取操作：

- 后台上传前进行客户端压缩；
- 默认生成 WebP 或 AVIF；
- 限制原图尺寸和单文件大小；
- 卡片、详情和 Banner 使用明确尺寸规范；
- 默认不保留无必要的原始大图；
- 使用内容哈希或 UUID 生成不可变文件名；
- 替换图片时写入新对象，不覆盖旧 Key；
- 无引用对象进入延迟垃圾回收。

Cloudflare Images 不作为免费模板的必要依赖。

## 9. 第三方客服接入设计

在线客服最终独立开发，本仓库只提供服务商无关的接入层和站内消息中心界面。

### 9.1 主项目职责

- `/en/messages` 和 `/es/mensajes` 消息中心；
- PC 会话列表 + 当前聊天窗口；
- 移动端会话列表与独立聊天页；
- 产品客服入口；
- 游客身份与登录用户身份；
- 客服服务商配置；
- 产品上下文签名；
- Provider 能力检测；
- 异常降级；
- 不保存完整聊天消息正文。

### 9.2 Provider 类型

首期预留：

```text
disabled       不启用
mock           开发和演示
external_link  外部客服地址
chatwoot       预留适配器
talkjs         预留适配器
custom         未来自研客服系统
```

首期真正实现 `disabled`、`mock`、`external_link` 和 `custom` 协议骨架。其他适配器根据需要开发。

### 9.3 统一能力模型

```ts
interface SupportCapabilities {
  guestSupport: boolean;
  conversationList: boolean;
  realtimeMessages: boolean;
  readReceipts: boolean;
  attachments: boolean;
  productContext: boolean;
  manualDestroy: boolean;
  automaticBurning: boolean;
  strictCryptographicDeletion: boolean;
  maxDistinctProducts24h?: number;
  maxActiveConversations?: number;
  supportedLocales: Array<'en' | 'es'>;
}
```

第三方系统不支持的能力，前端不得作出虚假承诺。

### 9.4 自研客服系统默认业务规则

未来独立客服系统默认实现：

- 游客可直接咨询；
- 同一游客滚动 24 小时最多咨询 5 个不同产品；
- 重复咨询同一产品恢复原会话，不重复计数；
- 同时最多 2 个进行中的客服会话；
- 最后一次有效互动 24 小时后自动销毁；
- 单个会话最长生命周期默认 72 小时；
- 支持用户主动立即销毁；
- 消息加密存储并优先通过密钥销毁实现密码学删除；
- 客服系统自行负责排队、分配、实时通信、限额和销毁。

### 9.5 客服坐席端 PWA 要求

未来独立客服系统的**客服坐席工作台**必须作为移动优先 PWA 开发，可添加到客服人员的手机桌面。

客服坐席端必须支持：

- Android 和 iOS 添加到主屏幕；
- 独立应用窗口；
- 中文界面；
- 移动端会话队列；
- 会话接入、回复、转接、关闭和快捷回复；
- 在线、离线和忙碌状态切换；
- 未读数量和新消息提示；
- 断线重连；
- 弱网和离线状态提示；
- 新版本更新提示；
- 手机软键盘、安全区域和后台恢复适配；
- PC 端自适应为多栏客服工作台。

动态消息不能仅依赖 Service Worker 缓存。离线时可以保存未提交草稿，但必须等服务端确认后才能显示为发送成功。

主网站中的用户消息中心 PWA 与未来客服坐席端 PWA 属于两个独立应用，使用不同 Manifest、Service Worker、图标、缓存空间和部署域名。

### 9.6 免费流量优化

自研客服上线后，浏览器应直接连接客服服务的 API/WebSocket。主 Worker 只签发短期产品上下文令牌，不代理每一条聊天消息。

```text
主站 → 获取短期客服上下文令牌 → 浏览器直连客服系统
```

这样客服消息不会消耗主项目每天的 Worker 动态请求额度。

## 10. 安全设计

- 管理后台建议使用 Cloudflare Access 作为第一层保护；
- 应用内部仍保留 RBAC；
- 登录、公开表单和高风险操作接入 Turnstile；
- Cookie 使用 `HttpOnly`、`Secure`、适当的 `SameSite`；
- API Secret 仅使用 Worker Secrets；
- 后台动态保存的第三方 Secret 使用主密钥加密后写入 D1；
- 所有上传验证 MIME、扩展名、大小和对象路径；
- R2 私有 Bucket 不配置公开域名；
- 外部跳转只允许批准的协议和域名；
- CORS 只允许明确的生产与测试 Origin；
- 后台操作写入审计日志；
- 删除默认采用软删除与延迟物理清理；
- 重要写操作使用幂等键；
- 不在日志中记录密码、Token、消息正文或完整敏感参数；
- Service Worker 不缓存后台敏感响应、身份令牌或客服私密消息接口。

部署者必须自行确认所在司法辖区的年龄限制、内容规范、隐私政策、数据保留、约会交友、成人内容、游戏、直播和博彩相关法律，以及 Cloudflare 和第三方服务商的可接受使用政策。

## 11. 主要数据模型

计划的核心表：

```text
admin_users
roles
permissions
role_permissions
admin_user_roles

sections
section_translations
categories
category_translations
tags
tag_translations

locations
stores
store_translations
services
service_translations
service_tags
store_services

media_assets
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
soft_delete_records
```

具体字段在数据库设计阶段通过迁移文件确定。

## 12. 计划仓库结构

```text
site/
├─ apps/
│  ├─ web/
│  │  ├─ public/
│  │  │  ├─ manifest.webmanifest
│  │  │  └─ icons/
│  │  └─ src/
│  │     ├─ public/          英语/西班牙语用户端
│  │     ├─ admin/           中文管理后台
│  │     ├─ messages/        统一消息中心 UI
│  │     └─ pwa/             安装、更新和离线逻辑
│  └─ worker/
│     └─ src/
│        ├─ routes/
│        ├─ services/
│        ├─ repositories/
│        ├─ middleware/
│        └─ jobs/
│
├─ packages/
│  ├─ db/
│  ├─ shared/
│  ├─ ui/
│  ├─ i18n/
│  ├─ support-contracts/
│  └─ config/
│
├─ migrations/
├─ scripts/
├─ tests/
├─ .github/workflows/
├─ wrangler.jsonc
├─ pnpm-workspace.yaml
└─ package.json
```

## 13. 部署与环境

### 13.1 GitHub 配置

已使用项目专用 Cloudflare API Token，并验证以下权限：

- Worker 创建、更新、删除；
- D1 创建、查询、删除；
- R2 Bucket 与对象操作；
- KV 创建、读写、删除；
- Queue 创建与删除。

域名和 R2 自定义域名由部署者手动配置，因此模板不要求 Zone ID 或 DNS 写权限。

GitHub Actions 使用：

```text
Secret:
CLOUDFLARE_API_TOKEN

Variable 或 Secret:
CLOUDFLARE_ACCOUNT_ID
```

不得把真实密钥写入源码、README、Issue 或聊天记录。

### 13.2 环境

```text
local       本地开发
preview     PR 或开发分支预览
production  main 分支生产环境
```

生产部署流程：

```text
push/merge main
→ 安装依赖
→ lint
→ typecheck
→ unit tests
→ PWA manifest/service worker validation
→ build
→ 数据库迁移检查
→ Wrangler deploy
→ smoke test
→ PWA installability check
```

数据库迁移必须向前兼容。高风险迁移采用“先加字段、再迁移数据、最后删除旧字段”的多阶段方式。

## 14. 开发阶段计划

### 阶段 0：工程初始化

- [ ] 初始化 pnpm workspace；
- [ ] 创建 React/Vite 用户端与后台；
- [ ] 创建 Hono Worker；
- [ ] 配置 TypeScript、ESLint、格式化和测试；
- [ ] 建立移动优先设计令牌、断点和组件规范；
- [ ] 配置 PWA Manifest、Service Worker 和图标管线；
- [ ] 配置 Wrangler；
- [ ] 配置 CI/CD；
- [ ] 创建开发、预览和生产配置；
- [ ] 建立错误处理、日志和响应规范。

### 阶段 1：数据库与后台基础

- [ ] 建立 D1 schema 和迁移机制；
- [ ] 管理员、角色、权限；
- [ ] 服务频道、分类、标签；
- [ ] 地区、门店和产品；
- [ ] 英语/西班牙语翻译编辑；
- [ ] 草稿、发布、下架和归档；
- [ ] 统一列表、选择、全选和批量删除；
- [ ] 操作审计。

### 阶段 2：R2 媒体系统

- [ ] 公开与私有 Bucket 绑定；
- [ ] 上传授权；
- [ ] 客户端图片压缩；
- [ ] 媒体资源表；
- [ ] R2 公开域名后台设置；
- [ ] 域名连接测试；
- [ ] 图片引用检查；
- [ ] 延迟垃圾回收。

### 阶段 3：双语移动优先用户端与 PWA

- [ ] `/en` 与 `/es` 路由；
- [ ] 移动端首页服务频道 + 产品内容流；
- [ ] 移动端底部导航；
- [ ] 分类、标签、地区移动筛选；
- [ ] 门店列表与详情；
- [ ] 产品列表与详情；
- [ ] 移动端单列或紧凑双列卡片；
- [ ] PC 自适应一行两列卡片；
- [ ] 语言选择持久化；
- [ ] 手机安全区域和软键盘适配；
- [ ] PWA 安装流程；
- [ ] 应用图标与启动样式；
- [ ] 离线应用壳和离线页面；
- [ ] Service Worker 更新提示；
- [ ] 空状态、错误状态和骨架屏；
- [ ] 可访问性和键盘操作。

### 阶段 4：公开快照与免费流量优化

- [ ] D1 → R2 版本化发布；
- [ ] `current.json` 原子切换；
- [ ] 长缓存与不可变对象 Key；
- [ ] PWA 公开资源运行时缓存；
- [ ] Service Worker 过期缓存清理；
- [ ] 分区搜索索引；
- [ ] 旧版本回滚；
- [ ] 发布失败恢复；
- [ ] Worker/D1 使用量监控；
- [ ] 高流量降级策略。

### 阶段 5：转化与客服接入层

- [ ] 外部转化目标；
- [ ] `/go/{code}` 安全跳转；
- [ ] Analytics Engine 转化事件；
- [ ] 移动优先独立消息中心 UI；
- [ ] PC 多栏消息中心自适应；
- [ ] Support Provider 接口；
- [ ] `disabled` Provider；
- [ ] `mock` Provider；
- [ ] `external_link` Provider；
- [ ] `custom` 协议骨架；
- [ ] 后台客服绑定和连接测试；
- [ ] 客服能力检测与功能降级。

### 阶段 6：运营与平台能力

- [ ] Banner、广告位与推荐位；
- [ ] FAQ 和内容页面；
- [ ] 转化池和广告池；
- [ ] 数据仪表盘；
- [ ] Web Analytics；
- [ ] Turnstile；
- [ ] 备份和恢复流程；
- [ ] 安全检查。

### 阶段 7：模板化与发布验收

- [ ] 删除所有写死品牌和演示数据依赖；
- [ ] 首次部署向导；
- [ ] 配置示例；
- [ ] 数据种子；
- [ ] 完整测试；
- [ ] 性能预算；
- [ ] 手机优先视觉与操作验收；
- [ ] PC 自适应验收；
- [ ] Android PWA 安装与更新验收；
- [ ] iOS 添加到主屏幕与独立窗口验收；
- [ ] 离线和弱网验收；
- [ ] 英语和西班牙语缺失翻译检测；
- [ ] Cloudflare 免费额度压力测试；
- [ ] 部署与恢复文档。

### 阶段 8：独立客服系统（另一个项目）

主项目稳定后，新建独立客服仓库，开发：

- 多租户；
- Site 与域名绑定；
- 客服账号与工作台；
- 移动优先客服坐席端 PWA；
- Android 和 iOS 主屏幕安装；
- PC 多栏客服工作台自适应；
- WebSocket 与 Durable Objects；
- 游客咨询限额；
- 24 小时焚毁；
- 消息加密；
- 客服队列与分配；
- API、SDK 和 Webhook；
- 与本模板的 `custom` Provider 对接。

## 15. 免费额度监控与升级触发条件

建议设置内部预警线，而不是等到额度耗尽：

| 指标 | 预警建议 |
|---|---:|
| Worker 动态请求 | 达到 50,000/天开始检查；达到 80,000/天启用降级 |
| D1 行读取 | 达到 2,500,000/天检查慢查询与索引 |
| D1 行写入 | 达到 50,000/天检查高频写入 |
| R2 存储 | 达到 7GB 清理原图和无引用文件 |
| KV 写入 | 达到 500/天检查误用 |
| Queue 操作 | 达到 6,000/天减少非关键任务 |
| Analytics Engine | 达到 70,000 数据点/天开始采样 |

高流量降级顺序：

1. 降低非关键事件采样率；
2. 暂停低优先级后台任务；
3. 将部分 tracked 跳转切换为 direct；
4. 延长公开快照缓存；
5. 禁止高成本筛选或导出；
6. 必要时升级 Workers Paid。

当动态业务长期接近免费额度，或需要更复杂的实时功能时，优先升级 Cloudflare Workers Paid，而不是破坏架构或牺牲安全性。

## 16. 验收标准

项目主版本完成必须满足：

- 用户端英语和西班牙语完整可用；
- 用户端以移动端 UI 为设计和验收核心；
- PC 端基于同一组件体系自适应，不维护重复页面；
- 主网站能够作为 PWA 添加到支持的手机桌面；
- PWA Manifest、图标、Service Worker、离线页和更新流程完整；
- PWA 不缓存敏感动态接口；
- 后台中文完整可用；
- 服务频道和业务类型不写死；
- 门店、产品、分类、标签、地区和媒体可管理；
- 所有删除列表支持选择、全选和批量删除；
- R2 自定义域名可通过后台配置并测试；
- 数据库只保存 R2 对象 Key；
- 用户端公开浏览主要从 Static Assets 与 R2 读取；
- 产品筛选不依赖每次调用 Worker；
- 外部转化链接安全、可统计、可降级；
- 独立消息中心和客服 Provider 接口完成；
- 主项目不保存第三方客服消息正文；
- 未来客服系统的坐席端 PWA 要求已经写入接口与独立项目计划；
- CI、部署、迁移、备份和恢复流程可执行；
- 免费额度监控和降级策略完成；
- 无密钥、账户 ID、真实域名或敏感数据进入源码。

## 17. 开发原则

1. **移动端优先设计，PC 端自适应展开。**
2. **先做正确的数据边界，再做 UI。**
3. **公开读取静态化，后台写入动态化。**
4. **D1 是主数据源，R2 是公开发布层。**
5. **数据库只保存媒体对象 Key。**
6. **分类、频道、标签和转化方式不得写死。**
7. **客服是第三方系统，主项目只保留标准接口。**
8. **不为兼容第三方而降低自研客服的高级能力。**
9. **高频事件不写 D1。**
10. **PWA 缓存不能绕过权限、更新和数据生命周期。**
11. **免费额度不足时先优化和降级，再升级套餐。**
12. **安全、隐私和法律合规优先于功能数量。**

---

本 README 是当前项目的架构基线和开发计划。后续如修改核心业务规则、移动端与 PWA 要求、Cloudflare 资源边界、客服协议或数据生命周期，应同步更新本文档。