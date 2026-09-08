# 业务展示与运营平台

`Qz121314/site` 是面向个人运营者和小团队的业务展示、内容运营、转化与客服接入平台。仓库同时包含 Mobile-first Storefront、中文 Admin、Cloudflare Worker、D1 数据层和 R2 内容/媒体层。

Site 负责产品内容、公开展示、转化入口和客服系统接入；独立 `customer-service` 系统负责 Conversation、Message、Agent 分流和客服侧实时数据。Site 不维护客服会话账本，也不代理正常聊天流量。

## Runtime topology

```text
Browser
├─ Storefront (React/Vite)
│  ├─ public bootstrap / published content
│  ├─ product browsing / Article / Messages
│  ├─ CTA /go handoff
│  └─ direct customer-service client traffic
│
└─ Admin (React/Vite)
   └─ authenticated Worker Admin API
        │
        ├─ D1
        │  └─ editable business data, settings, metadata, state, audit
        │
        └─ R2
           ├─ media objects
           └─ immutable published content snapshots

Cloudflare Worker
├─ Admin/public APIs
├─ auth/session boundary
├─ publication and rollback
├─ media management
├─ conversion routing
└─ same-origin /public/* content delivery
```

主要运行组件：

- `apps/storefront`：English 用户前端，Mobile-first。
- `apps/admin`：中文运营后台。
- `apps/worker`：Hono API、认证、上传、转化、发布和静态内容路由。
- D1：当前可编辑业务数据、主题/导航配置、媒体元数据、状态和审计。
- R2：图片/GIF/视频素材与不可变公开内容版本。
- `packages/storefront-ui`：Storefront 共享 UI、Theme Tokens 与视觉契约。

## 产品模型

平台不预设行业。管理员通过分区组织业务，并在分区内管理产品、分类、标签和转化池。

```text
Site
├─ Section
│  ├─ Product
│  ├─ Category
│  ├─ Tag
│  └─ Conversion Pool
├─ Article Center
├─ Theme Center
├─ Asset Library
├─ Customer Service Connections
├─ Messages Article placements
├─ Bottom Navigation / Home Layout / Hero
└─ Publication history / rollback
```

产品正文与 Article 正文使用安全 Markdown。公开业务内容由后台维护；Storefront 只硬写系统必要 UI，不应把运营营销内容固化在前端代码中。

## Storefront

Storefront 以手机浏览体验为第一优先级，同时提供桌面扩展布局。主要用户路径是：

```text
Home
→ Browse / Section
→ Product Detail
→ CTA
→ Messages / external conversion target
```

核心能力包括：

- Home Hero、快捷分区、热门/最新与推荐产品；
- 分区内搜索、分类单选和标签多选；
- 产品详情、结构化图片/GIF/视频和 Markdown；
- `/go/:productId` 实时 CTA 分发；
- Messages / Customer Service 接入；
- Messages promotional Article cards；
- Article generic detail route；
- PWA 安装与 Service Worker；
- runtime Theme、Bottom Navigation 和媒体域名配置。

产品浏览移动端保持双列与 1:1 产品媒体基线。分类/标签是筛选和检索信息，不作为产品封面装饰重新叠加。

### App Shell and viewport

Storefront App Shell 是持久界面的 owner，负责 Header、Bottom Navigation、route action host、Safe Area 和 VisualViewport 几何。业务 route 提供内容和 action intent，不直接向 `document.body` 创建第二套全局 fixed chrome。

运行时会测量实际 Header/Bottom Chrome 和可视 viewport；浏览器地址栏、旋转和虚拟键盘造成的 viewport 变化由共享 viewport runtime 处理。Route 页面不应依赖设备型号或复制固定高度常量。

### Request model

正常 schema-v2 启动以一个 Storefront bootstrap 为主入口，复用已经发布的 pointer/site/sections/home 信息，并带上当前 Theme、Bottom Navigation、`mediaBaseUrl` 和 Messages Article metadata。首屏配置优先并入现有 bootstrap，而不是增加独立全局请求。

路由内容按需读取：

- Section 读取当前分区 snapshot；搜索/分类/标签在已加载数据上本地完成。
- Product Detail 优先复用 bootstrap、Browse search index 或已访问 Section 中的产品摘要，再读取对应 detail。
- Article detail 按需读取 Article 内容，不把完整 Markdown body 塞入 bootstrap。
- Support runtime 仅在进入 Messages/客服 CTA，或浏览器已有有效客服 identity 时激活。

请求数量和 bootstrap/lazy-loading 边界属于稳定 runtime architecture contract。

## Article Center status

原 FAQ 内容能力已经抽象为 **Article Center**。Article 是独立、可复用的 Markdown content asset：

```text
Article
≠ FAQ presentation
≠ Message
≠ Conversation
≠ Customer Service data
```

截至当前 C3 baseline，已经完成：

- Admin Article Center 管理与 Markdown 编辑体验；
- reusable Article 数据/公开内容契约；
- Admin Messages Article placement 配置，可选择 0..N 个 Article；
- placement 可保存独立背景素材引用；
- Storefront bootstrap 可携带 active Messages Article 的轻量 metadata；
- Storefront Messages 顶部按 placement 顺序呈现 promotional Article Cards，并支持独立背景媒体；
- Article unread 与 support unread 独立计算；
- Messages badge 可以组合 support unread + Article unread；
- generic Article route：`/articles/:articleId/`。

兼容边界仍然保留：历史 FAQ storage/publication module 和 `/faq/`、`/faq/:id/` 路由继续可读，旧 FAQ 内容不会因为 Article Center 抽象而失效。兼容命名不代表新内容模型仍以 FAQ 为中心。

Storefront Messages Article Cards 只消费现有 bootstrap metadata，不为列表新增 Article、媒体 metadata 或 support request。打开 Messages 本身不会标记 Article 已读；只有成功进入对应 generic Article detail 后才按 Article ID 记录 read state。背景媒体继续使用当前 `mediaBaseUrl + object_key` abstraction，加载失败时退化为无背景但仍可访问的 Article Card。

## Conversion and Customer Service

转化池属于单一 Section，主要支持：

```text
customer_service
link
```

`/go/:productId` 是产品 CTA 的正式实时分发入口。外部链接由 Site 解析当前转化配置；客服模式生成 handoff context 并进入 Storefront Messages。

Customer Service 是独立系统。Site 只保存经过验证的连接信息和公开 client/realtime endpoints，并负责把权威 Product/Section/Category context 交给 Storefront。之后 Conversation、Message、媒体和 WebSocket 流量由浏览器直接访问客服系统。

首次普通访客不会仅因为页面存在 Messages 入口就创建客服 visitor identity、读取 conversations 或建立 WebSocket。客服 runtime 在用户明确进入 Messages/CTA 或已有有效 identity 后才激活。

## Admin

Admin 是中文、小团队、高密度运营工作区，采用统一两级导航和 Workspace/Page Header 信息架构。主要模块包括：

- Dashboard；
- Article Center；
- Product / Category / Tag / Conversion Pool；
- Theme Center；
- Asset Library；
- Customer Service Connections；
- Experience settings：Messages Articles、Bottom Navigation、Home Layout、Hero/PWA 等；
- System/Site settings；
- Publish / History / Rollback。

Admin 共享控件由 `apps/admin/src/components/ui` source-owned component layer 管理；Storefront 不继承 Admin skin。Admin 与 Storefront 可以共享数据和设计 token 语义，但保持各自明确的 UI ownership。

Admin workspace 的壳层负责两级导航、窄屏 Drawer、页面标题和唯一的内容滚动 owner。桌面端导航与内容区域各自滚动，窄屏时页面内容保持完整可达；页面与业务组件不得再创建竞争性的固定高度或全局滚动容器。最终 UI 回归验收覆盖 820、1024、1366、1440 和 1920px，并检查水平溢出、长表单/保存区可达性以及 Drawer 的键盘焦点行为。

## Theme and presentation

主题采用“一套业务组件 + Theme Tokens + 多主题 recipe”的模型。主题可以控制颜色、明暗模式、字体、按钮、媒体、motion、navigation 和表面层级，但不能替换业务路由结构或执行第三方程序代码。

外部主题导入只转换为受控 Theme Tokens；不执行外部 React/JavaScript/HTML，也不加载任意第三方 CSS。保存后的主题由本站自己的 runtime 读取。

## Asset Library and media

Asset Library 是全站日常媒体入口，支持 JPG/PNG/WebP/GIF/MP4/WebM、文件夹、搜索/筛选、分页、上传队列、失败重试、移动和删除。

D1 媒体记录保存稳定 `object_key`；公开媒体 URL 由当前 `mediaBaseUrl + object_key` 生成。更换 R2 Custom Domain 不要求重写业务记录。

公开内容 JSON 与公开媒体是两个边界：

- published JSON 虽存储在 R2，但 Storefront 通过站点同源 `/public/*` 读取；
- 图片/GIF/视频可通过配置的 R2 Custom Domain 公开读取；
- 后台管理通过 Worker R2 binding 完成上传、删除和校验。

## Publication model

平台把版本化内容和实时运营状态分开。

版本化内容发布：

```text
D1 editable data
→ validation
→ immutable R2 module snapshots
→ current pointer
→ Storefront public read
```

主要包括 Site 内容、Sections index、各 Section 内容和 Article/FAQ-compatible content。后台保留 dirty state、模块发布、全量发布、历史版本和 rollback。

实时配置不要求为了每次变化重新生成所有 R2 内容快照。Theme、Bottom Navigation、媒体域名、CTA/Conversion 和其他实时运营配置由对应 runtime/public API 契约提供。

## Data and security boundaries

- Admin 使用单管理员安全登录，不维护组织/RBAC 系统。
- Admin secrets 只存在 Cloudflare runtime configuration，不写入 GitHub、D1 或公开前端。
- D1 schema 由 repository migrations 管理。
- R2 不作为任意第三方代码执行渠道。
- Storefront public content 不暴露 Admin auth data、客服验证 Token 或内部运营凭证。
- Site 与独立 Customer Service 保持数据边界；客服业务数据不复制进 Site D1。

## Repository layout

```text
apps/
  storefront/       public React/Vite application
  admin/            operator React/Vite application
  worker/           Cloudflare Worker

packages/
  storefront-ui/    shared Storefront UI and theme contracts

migrations/         D1 schema migrations
tests/              repository / Worker / browser contracts
docs/               architecture, integration and development documentation
scripts/            repository tooling and release helpers
```

## Quick start

使用 repository 声明的 Node/pnpm 版本与脚本。首次开发先安装依赖，然后运行：

```bash
pnpm install
pnpm preflight:dev
```

具体开发、测试、数据库和部署步骤不在 README 重复维护；以 `AGENTS.md` 和下面的 development docs 为准。

## Documentation

工程契约入口：

- [`AGENTS.md`](AGENTS.md) — 每次修改必须先读的 hard engineering contract。
- [`docs/development/workflow.md`](docs/development/workflow.md) — development / PR operational workflow。
- [`docs/development/formatting.md`](docs/development/formatting.md) — formatting 与 commit gate。
- [`docs/development/testing.md`](docs/development/testing.md) — test-layer ownership 与验证策略。
- [`docs/development/cloudflare-ci.md`](docs/development/cloudflare-ci.md) — change-aware Cloudflare CI / remote-resource budget。
- [`docs/development/database.md`](docs/development/database.md) — D1 migration/release 操作。
- [`docs/development/deployment.md`](docs/development/deployment.md) — build/deploy/smoke/release 操作。

专项文档：

- [`docs/customer-service-integration.md`](docs/customer-service-integration.md) — Customer Service 集成协议。
- `docs/` 下其他 architecture/product documents — 对应模块的长期设计与历史决策。

README 只描述当前产品与 runtime architecture；工程执行规则只在 `AGENTS.md` 与 `docs/development/*` 中维护。
