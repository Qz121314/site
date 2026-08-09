# 业务展示与运营平台

`Qz121314/site` 是一个面向个人运营者和小团队的、由后台数据驱动的业务展示与转化平台。

```text
Storefront   English 用户前端，Mobile-first
Admin        中文运营后台
Worker       Hono API、认证、上传、转化、发布与静态资源路由
D1           业务数据、主题、媒体元数据、状态、审计与发布记录
R2           图片 / GIF / 视频素材与不可变公开内容版本
```

项目不预设具体行业。分区、产品、分类、标签、转化方式、主题、素材、热门内容和 FAQ 都由后台管理。

## 项目状态

当前版本已经达到 **Feature Complete（既定功能范围完成）**，中文后台管理系统也已按个人运营者和小团队的既定范围完成收口。

后台收口表示现有管理模块、错误恢复、未保存保护、批量删除、发布与回退链路已经形成完整闭环；不表示继续引入 AI、广告池、复杂权限或企业审批等范围外能力。

现阶段不再以“继续增加功能”为目标，后续工作主要是：

```text
真实功能验收
→ Bug / 边界修复
→ 移动端真实设备检查
→ UI 细节收口
→ 生产运行验证
```

当前没有必须补齐的业务模块。

## 产品定位与设计原则

本项目面向个人运营者或小团队，不按大型企业后台方向设计。

核心原则：

```text
简洁
高效
稳定
易维护
Mobile-first
```

功能优先解决真实运营需求，不为了“功能数量”堆叠低频模块。后台保持直接的单管理员操作流程；只有出现明确需求时才增加新的系统复杂度。

### 明确不在当前范围内

以下能力不是当前项目目标，也不应在常规优化中被当成“缺失功能”补充：

```text
AI 管理 / AI 生成功能
广告池 / 广告投放管理
复杂管理员账号、角色、组织与 RBAC
大型组织审批 / 协作工作流
多语言翻译系统
自建实时聊天 / 坐席 / 工单系统
Cloudflare Stream 视频转码平台
完整网页拖拽可视化设计器
在线下载并执行第三方 React / JavaScript / 任意 CSS 主题代码
```

普通产品视频继续使用 R2 + HTML `<video>`；主题继续使用安全 Design Tokens，而不是执行第三方程序代码。

## 当前功能总览

```text
Cloudflare Worker + D1 + R2
│
├─ 单管理员安全登录
├─ 站点设置 / Logo / GA4 / 媒体域名
├─ Mobile-first 主题中心
│  ├─ 6 套官方主题
│  ├─ shadcn Registry Theme 导入
│  └─ JSON Theme 导入
├─ 全站素材中心
│  ├─ JPG / PNG / WebP / GIF / MP4 / WebM
│  ├─ 文件夹
│  ├─ 搜索 / 筛选 / Cursor 分页
│  ├─ 上传队列 / 失败重试
│  ├─ 批量移动 / 删除
│  └─ R2 存储清理
├─ 分区管理
│  └─ 每个分区独立：产品 / 分类 / 标签 / 转化池
├─ 客服连接管理
├─ FAQ / Markdown
├─ 热门 / 最新产品
├─ 模块化发布 / 历史版本 / Rollback
├─ 实时转化 CTA / /go 路由
└─ English Storefront
```

## Storefront：Mobile-first 用户前端

真实用户主要来自移动端，因此前端和主题系统都以手机为第一设计目标。

设计顺序：

```text
手机基础体验
→ 720px 以上增强
→ 980px 以上 PC 扩展
```

核心移动端基线：

- 产品列表保持双列浏览；
- 产品列表 / 封面使用 **1:1 正方形**；
- Hero 控制首屏占用，不挤压主要内容；
- 搜索、筛选、CTA 和底部导航保持适合触控的尺寸；
- 底部导航考虑 Safe Area；
- 深色和自定义主题的导航、Markdown、代码块、骨架屏等公共表面全部由 Theme Tokens 驱动；
- 图片 / 视频失败时显示稳定占位，不暴露浏览器破图；
- 内容暂时加载失败可原地重试，未发布 / 不存在资源使用明确的 404 语义。

### 前端结构

```text
站点品牌 / Location
动态分区导航
主题化 Hero
热门产品
最新产品
分区产品列表
分类 / 标签 / 搜索筛选
FAQ
产品详情
图片 / GIF / 视频媒体
实时 CTA
移动端底部导航
```

用户前端为 English；公开业务内容由管理员直接录入英文。

## 主题中心

主题系统采用：

> **一套业务组件 + Theme Tokens + 多套主题来源**

不同主题不会复制 ProductCard、Hero、ProductDetail、BottomNav 等业务代码。

### 官方主题

```text
Marketplace   通用业务目录 / 本地服务
Noir          深色 / 成人内容 / 会员展示
Live          直播 / 娱乐 / 强视觉入口
SaaS          软件 / 工具 / 企业服务
Travel        文旅 / 景区 / 本地体验
Tech          科技 / 硬件 / 创新产品
```

主题控制颜色、明暗模式、表面层级、边框、阴影、圆角、Hero 氛围等视觉 Token；业务数据结构保持一致。

### 主题来源

主题中心当前支持：

```text
官方精选
shadcn Registry Theme URL
JSON 导入
```

外部主题导入流程：

```text
外部 Theme JSON
→ Worker 安全读取 / 校验
→ 转换为本站标准 Theme Tokens
→ 手机实时预览
→ 可调整品牌强调色
→ 点击“保存并应用”
→ D1 保存标准化主题定义
→ Storefront 使用本站自己的 Theme Runtime
```

已保存主题不依赖原始第三方 URL 持续在线。

### 外部主题安全边界

主题库不会执行第三方代码：

- 不执行外部 React / JavaScript / HTML；
- 不加载任意第三方 CSS；
- Registry 只接受公开 HTTPS 地址；
- 限制 Theme JSON 大小；
- 拒绝 localhost、私网和明显内部地址；
- 只接受受控的颜色 / Theme Token 值；
- 导入只进入预览，必须显式点击 **保存并应用** 才持久化。

外部主题仍必须使用本站固定的 Mobile-first 业务结构、双列 1:1 产品卡和触控交互。

### 产品媒体比例

**1:1 是产品浏览基线，不是全站媒体强制裁切规则。**

```text
产品列表封面      1:1
后台产品缩略图    1:1
产品详情图片      使用内容合适比例
GIF              保留动画与源比例
视频             保留源视频比例
Logo / 图标       按品牌容器适配
Hero / Banner     使用主题需要的横向比例
Markdown 正文图   保留源比例并限制最大显示尺寸
```

## 全站素材中心

素材中心是全站唯一的日常媒体管理入口。

**产品录入不提供本地文件上传。** 产品图片、GIF 和视频必须先进入素材中心，再从产品编辑器选择已有素材。

### 支持格式

```text
静态图片   JPG / PNG / WebP
动图       GIF
视频       MP4 / WebM
```

技术类型：

```text
image
animated_image
video
```

业务用途：

```text
general
product
logo
icon
favicon
hero
background
content
```

技术类型与业务用途分离，一个素材可以被不同业务位置复用。

### 文件夹与浏览

素材中心提供轻量的一层文件夹：

- 新建 / 重命名 / 删除文件夹；
- 删除文件夹不会删除素材，素材回到“未分组”；
- 移动文件夹关系只修改 D1，不改 R2 `object_key`；
- 支持普通多文件上传；
- 支持选择本地文件夹上传，使用顶层目录名创建 / 复用素材文件夹；
- 本地多级子目录会扁平化到同一个顶层素材文件夹；
- 支持文件夹、媒体类型、用途和文本搜索；
- 使用服务端 Cursor 分页，每页按当前接口策略加载素材，不受旧的固定大列表上限影响；
- 已加载选择在继续分页时保持稳定。

### 上传队列

素材上传通过可见队列处理：

```text
queued
processing
uploaded
reused
error
```

- 最多 **3 个文件并发**；
- 一个文件失败不会中断整个批次；
- 失败文件保留本地 File 对象，可显式重试；
- 上传队列使用同步 single-flight 锁，快速重复触发也不会启动第二套并发池；
- 批次结束后统一刷新素材和文件夹数据。

### R2 静态图片压缩基线

**JPG / PNG / WebP 原图禁止直接进入 R2。**

```text
本地 JPG / PNG / WebP
→ 浏览器读取原图
→ 最长边压缩到不超过 1200px
→ WebP quality 0.82
→ 浏览器不支持 WebP 时回退 JPEG
→ multipart 中只放压缩后的文件
→ Worker 校验 compression profile / 输出格式 / sourceByteSize
→ R2 只保存 optimized 文件
```

Worker 会拒绝绕过压缩协议的静态图片请求，因此这个约束不是单纯依赖后台 UI。

Logo 和分区图标独立上传入口也必须经过对应浏览器压缩协议。

GIF 为保持动画、MP4 / WebM 为避免在浏览器后台引入重型转码链路，当前不使用静态图片 Canvas 压缩。

当前媒体大小策略：

```text
压缩后的静态图片 / GIF   默认最大 20 MB
视频                     默认最大 60 MB
```

### 产品选择素材

产品媒体区负责：

```text
从素材中心选择
→ 查看 1:1 缩略图
→ 文件夹 / 图片 / GIF / 视频筛选
→ 搜索
→ 最多 12 个产品媒体
→ 排序
→ 指定图片或 GIF 封面
→ 从产品解除引用
```

产品移除媒体只解除产品关系，不删除素材中心文件。视频不能作为产品封面。

### 存储清理

日常素材管理与底层 R2 清理分离：

```text
素材中心
→ 日常上传、整理、复用、移动、删除

存储清理
→ 扫描历史 R2 图片对象
→ 检查实时业务引用
→ 检查最近发布快照保护
→ 只删除服务端确认安全的孤立对象
```

## 分区驱动业务模型

“分区”是主要业务隔离边界。

创建分区后，后台自动生成：

```text
[分区名称]
├─ 产品管理
├─ 分类管理
├─ 标签管理
└─ 转化池
```

分类、标签、产品和转化分组都限制在当前 `section_id`，不允许跨分区错误引用。

### 产品管理

产品支持：

- Draft / Published / Archived；
- 线上 / 线下服务模式；
- 分类；
- 最多 12 个标签；
- 可选转化分组；
- Markdown 正文；
- 最多 12 个结构化媒体；
- 图片 / GIF 封面；
- 热门推荐和排序；
- 搜索、状态筛选、回收站、选择 / 全选、批量删除、恢复；
- 排序在搜索 / 筛选状态下自动禁用，避免隐藏项排序错误。

发布产品时会校验分类、标签、转化分组、媒体和线下地址等必要条件。

### 分类 / 标签

分类和标签都属于单一分区，支持新增、编辑、启停、排序、搜索、回收站、批量删除和恢复。

产品编辑器允许在录入过程中快速创建当前分区的新分类 / 标签。

### 转化池

转化池属于单一分区，管理产品 CTA 的目标。

主要模式：

```text
customer_service   外部客服入口
link               外部链接入口
```

转化配置保存后通过 D1 实时生效，不要求重新发布 R2 内容快照。

`/go/:productId` 是正式转化跳转入口，并负责需要轮换场景下的生产游标推进。

## 客服管理

客服管理只负责配置**外部客服系统连接**，不在本项目内实现聊天系统。

当前保持轻量的 first-party `generic_v1` 对接契约，不引入复杂第三方 REST 映射器。

后台提供连接管理、启停、测试和回收站；转化池可以引用可用客服连接中的入口。

## Markdown

产品正文和 FAQ 正文使用安全 Markdown。

支持：

```text
标题 / 段落 / 有序和无序列表 / 引用
粗体 / 斜体 / 删除线
链接 / 行内代码 / 代码块 / 分割线
Markdown 图片
```

安全边界：

- 不开放任意 HTML；
- 图片只允许站内路径或 HTTP / HTTPS；
- 拒绝 `javascript:`、`data:` 等不安全来源；
- 视频作为结构化媒体处理，不通过任意 HTML 注入正文；
- Markdown 图片加载失败时前端显示稳定占位。

## FAQ

FAQ 是全站公共内容，不属于单一分区。

支持新增、编辑、Markdown、排序、搜索 / 筛选、启停、删除和恢复；前端在 FAQ 为空或临时请求失败时提供明确状态和重试入口。

## 后台管理体验

Admin 保持中文、小团队、高密度工作台风格。

当前已经具备：

- URL Hash + `localStorage` 工作区记忆；
- 浏览器 Back / Forward；
- 关键页面显式未保存状态；
- 离开页面 / 退出登录前的未保存保护；
- Product Editor、Theme Center、Site Settings 的明确 dirty state；
- 共享确认 / 输入 Dialog；
- 全局 React Error Boundary；
- Admin 请求层统一 mutation 通知；
- 非 Auth Admin API 401 的全局 session-expired 处理；
- 登录接口与会话检查不会被误判成“活动会话过期”；
- 高风险批量写接口使用 idempotency key；
- 高频保存 / 删除 / 排序操作有 working / saving 状态，避免普通重复提交。

## 简化管理员登录

后台采用单管理员密码，不维护管理员账号表、角色表或组织权限。

Cloudflare Worker 需要手动绑定：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

绑定值不写入 GitHub、D1 或 `wrangler.jsonc`。

认证保留必要安全措施：

- 签名 Session；
- HttpOnly Cookie；
- Secure；
- SameSite=Strict；
- 会话 TTL；
- 登录限速；
- 写操作审计；
- 会话失效时后台统一返回登录界面。

部署启用 `keep_vars`，重新发布 Worker 时保留 Cloudflare Dashboard 手动配置的变量。

## 发布模型

项目把“内容发布”和“实时运营状态”分开。

### 模块化内容发布

以下内容使用模块化版本：

```text
站点内容
分区导航
FAQ
各业务分区内容
```

流程：

```text
D1 当前业务数据
→ 发布校验
→ 生成不可变 R2 JSON 版本
→ 更新 current pointer
→ Storefront 读取公开内容
```

后台提供：

- Dirty 状态；
- 当前模块发布；
- 全部发布；
- 发布任务状态；
- 历史版本；
- Rollback；
- 发布失败反馈。

### 实时状态

主题和转化属于实时运行能力：

- 主题保存后由 `/api/public/theme` 读取当前 D1 Theme Runtime；
- 产品 CTA / 转化目标使用当前 D1 状态；
- 转化配置变化不需要为了更新 CTA 重新生成产品 R2 快照；
- `/go/:productId` 负责实际跳转和轮换游标。

这样内容版本保持稳定，同时运营入口可以即时生效。

## R2 媒体与公开内容访问

Cloudflare 正式资源：

```text
Worker: service-catalog-site
D1:     service-catalog-site-db
R2:     service-catalog-site-assets
```

当前只维护一套正式资源，不建立 Preview / Production 后缀资源。

R2 有两种访问路径：

```text
ASSETS_BUCKET Worker Binding
→ 后台上传、删除、校验和维护

R2 Custom Domain
→ 用户前端公开读取图片、GIF、视频和公开内容对象
```

数据库媒体记录只保存 `object_key`，公开媒体 URL 统一生成：

```text
{media_base_url}/{object_key}
```

`media_base_url` 只由后台“站点设置”维护。Storefront 每次启动都通过运行时接口读取当前值；前端源码、构建变量和部署脚本都不保存当前 R2 自定义域名。更换绑定在同一 Bucket 上的自定义域名时，完成后台域名测试并保存即可，不需要修改代码、重新构建前端或重写已发布快照。

生产环境不依赖 `r2.dev`。

如果 R2 Custom Domain 暂时无法被浏览器直接读取，Storefront 对 `/public/*` 保留同源 Worker fallback，避免整个站点因直接 R2 读取异常而不可用。

## 路由

```text
/                        English Storefront
/sections/:slug/         分区深链接
/sections/:sectionSlug/products/:productSlug/  产品规范深链接
/products/:id-or-unique-slug/                  兼容旧产品深链接
/admin/*                  中文管理后台
/api/*                    Worker API
/go/:productId            实时转化跳转
/public/*                 当前公开内容与版本读取
```

Storefront 和 Admin 都由同一个正式 Cloudflare Worker 提供。

## 语言边界

```text
用户前端：English
后台界面：中文
公开内容：管理员直接录入英文
```

不建立翻译表、语言切换或 `/en`、`/es` 路由。

## 数据库规则

- D1 schema 只通过 `migrations/*.sql` 演进；
- PR 必须在全新的本地 D1 上完整执行全部 migration；
- `main` 正式部署前自动应用尚未执行的远程 migration；
- 不在 Cloudflare Dashboard 手工修改表结构；
- 业务关系由外键、触发器 / CHECK 和 API 校验共同保护；
- 普通可删除业务实体使用软删除 / 回收站；
- 高风险写操作保留审计；
- 批量删除 / 排序等接口在需要时使用 idempotency key 防重。

## CI 与自动部署

GitHub Actions 工作流：`.github/workflows/ci.yml`。

运行要求：

```text
Node.js >= 22
pnpm 11.x
```

PR 和 `main` 都先执行完整验证：

```text
pnpm install --frozen-lockfile
→ 本地 D1 migrations
→ lint
→ typecheck
→ tests
→ build
→ wrangler deploy --dry-run
```

只有 `main` push 验证成功后才执行正式部署：

```text
远程 D1 migrations
→ 解析并校验 R2 Custom Domain
→ 配置 R2 CORS
→ 直接 R2 读取探测
→ 使用当前 R2 Origin 构建生产静态资源
→ wrangler deploy --keep-vars
→ Production smoke test
```

生产 smoke 当前覆盖：

- `/api/health`；
- `/api/public/theme` Theme Runtime；
- `/public/current.json`；
- R2 直接读取 / CORS 或同源 fallback；
- 未登录 Admin session；
- Storefront / Admin SPA；
- Storefront 分区 / 产品深链接。

## 本地开发

安装：

```bash
pnpm install
```

应用本地 D1 migration：

```bash
pnpm db:migrate:local
```

启动 Storefront、Admin 和 Worker：

```bash
pnpm dev
```

常用质量命令：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm cf:check
```

## 仓库结构

```text
site/
├─ apps/
│  ├─ storefront/       English 用户前端
│  ├─ admin/            中文运营后台
│  └─ worker/           Cloudflare Worker / API
├─ packages/
│  ├─ shared/           通用 Markdown / 数据工具
│  ├─ config/           跨应用配置
│  └─ storefront-ui/    Storefront 与主题预览共用的真实展示组件 / CSS
├─ migrations/          D1 migrations
├─ scripts/             构建 / 发布辅助脚本
├─ config/              Cloudflare / R2 配置
├─ docs/                架构与数据设计文档
├─ .github/workflows/   CI / Deploy
├─ wrangler.jsonc
└─ package.json
```

## 文档

- [项目架构基线](docs/architecture.md)
- [D1 与 R2 数据存储基线](docs/data-storage.md)
- [开发阶段与交付计划](docs/development-plan.md)
- [发布验收清单](docs/acceptance-checklist.md)

README 用于说明**当前产品范围、已实现能力和运行方式**；`docs/` 保留更细的架构 / 数据设计背景。功能行为、migration 与文档发生变化时，应同步维护，避免 README 重新变成历史版本。
