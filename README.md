# Multi-Channel Visual Recommendation Platform

一个面向移动端与平板端的通用视觉推荐站模板。项目通过后台配置分区、分类筛选、分类、产品、Hero 广告池和 CTA 转化池，以同一套代码快速部署不同内容和推广方向的网站。

> 当前状态：需求已冻结，等待进入项目脚手架、数据库迁移和功能开发阶段。

## 1. 项目目标

项目采用“一套代码、一个部署、一个网站”的模式。

核心访问链路：

```text
进入分区
  ↓
查看 Hero 广告
  ↓
搜索或使用高频分类筛选
  ↓
进入分类产品目录
  ↓
查看产品详情
  ↓
点击 CTA，由转化池随机选择资源并跳转
```

项目不是企业官网，也不是社区、CRM 或复杂博客系统。唯一目标是以图片优先的方式展示内容，并尽可能缩短用户从浏览到转化的路径。

## 2. 核心原则

- 一个 Cloudflare Workers 部署对应一个网站。
- 一个网站可以创建多个分区，分区名称、Slug、图标和排序均由后台配置，不在代码中写死。
- 线上和线下内容使用同一套页面、数据结构和后台表单。
- 线上与线下的主要差异只来自产品内容和绑定的转化资源。
- 前台采用统一的高级暗黑视觉风格，不开发复杂主题系统。
- UI 只针对手机端和平板端设计。
- PC 端直接显示居中的平板端布局，不开发独立桌面版。
- 项目不保存浏览、点击或转化统计数据。
- 数据分析仅接入 Google Analytics 4 和 Meta Pixel。
- 图片在浏览器本地压缩，只有点击保存时才上传到 R2。

## 3. 明确不开发的功能

第一版不包含：

- 用户注册、登录、收藏和评论
- 多管理员、角色权限和团队协作
- Cloudflare Access
- CRM、聊天、社区和会员系统
- 多站点集中管理
- 多语言
- 可视化页面编辑器
- 自定义主题和自定义 CSS
- 广告展示、点击或计费统计
- CTA 点击和转化统计
- 固定、权重或轮询 CTA 模式
- 复杂图片编辑器、裁剪、旋转、滤镜和水印
- 无限滚动
- 回收站

## 4. 技术架构

```text
GitHub Repository
        ↓
Cloudflare Workers Builds / Wrangler
        ↓
Astro Full-stack Application
   ├── 前台页面和静态资源
   ├── 管理后台
   ├── Public API
   ├── Admin API
   └── CTA Redirect API
        ↓
   ├── Cloudflare D1
   └── Cloudflare R2
```

### 部署模型

```text
一个 Git 仓库
+
一个 Workers 应用
+
一个 D1 数据库
+
一个 R2 Bucket
=
一个网站
```

项目统一部署到 Cloudflare Workers，静态资源和动态请求由同一个 Worker 应用处理，不拆分 Cloudflare Pages 和独立 API Worker。

## 5. 技术版本基线

以下版本为项目初始化基线，核对日期为 **2026-07-20**。正式初始化后，以 `package.json` 和 `pnpm-lock.yaml` 为唯一版本依据。

| 技术 | 版本基线 | 用途 |
|---|---:|---|
| Node.js | 24 LTS | 本地开发和构建环境 |
| pnpm | 11.14.0 | 包管理 |
| Astro | 7.1.1 | 页面、路由、SSR、API Endpoints |
| `@astrojs/cloudflare` | 14.1.3 | Cloudflare Workers 适配器 |
| Tailwind CSS | 4.3.3 | UI 和响应式样式 |
| React | 19.2.7 | 后台交互组件和必要的前端交互岛 |
| `@astrojs/react` | 6.0.1 | Astro React 集成 |
| TypeScript | 7.0.2 | 类型系统 |
| Wrangler | 4.112.0 | 本地开发、D1 迁移和 Workers 部署 |
| Cloudflare D1 | 托管服务 | SQLite 关系数据库 |
| Cloudflare R2 | 托管服务 | 图片对象存储 |

### 后端实现约束

- 第一版直接使用 Astro Server Endpoints 和 Middleware。
- 第一版不引入 Hono。
- 第一版不引入 ORM。
- D1 通过 Worker Binding、Prepared Statements 和 SQL Migration 使用。
- `wrangler.jsonc` 使用当天或部署当天的 `compatibility_date`。
- 启用 `nodejs_compat`。
- 通过 `wrangler types` 生成 Cloudflare Binding 类型，不手写 `Env` 类型。

## 6. 视觉与响应式规范

前台采用统一的高级暗黑娱乐风格：

- 深黑、暗紫背景
- 香槟金、玫瑰红或紫色作为强调色
- 图片优先
- 卡片底部渐变遮罩
- 半透明悬浮底部导航
- 较大圆角
- 克制的阴影、发光和过渡动画

### 响应式断点

| 设备 | 宽度 | 布局 |
|---|---:|---|
| 手机 | `< 768px` | 页面全宽，分类 2 列，产品 2 列 |
| 平板 | `>= 768px` | 分类 4 列，产品 4 列 |
| PC | `>= 768px` | 继续使用平板布局，最大宽度 960px 并居中 |

不设计桌面侧边栏、超宽多栏详情页或独立 PC 导航。

## 7. 信息架构

```text
网站
├── 分区 Channel
│   ├── Hero 广告池
│   ├── 搜索
│   ├── 分类筛选 Category Filter
│   ├── 分类 Category
│   │   └── 产品目录页
│   │       └── 产品详情页
│   └── 无分类产品目录
└── CTA 转化池
```

### 分区 Channel

- 支持创建多个分区。
- 分区名称不能写死为任何固定名称。
- 分区名称、Slug、图标、排序、状态和 Hero 广告池均由后台管理。
- 已启用分区自动生成固定底部导航。
- 根路径 `/` 自动跳转到站点设置中的默认分区。

## 8. 分区首页

分区首页固定排版：

```text
LOGO
  ↓
Hero 广告轮播
  ↓
搜索框
  ↓
分类筛选按钮（没有则隐藏）
  ↓
分类列表（没有则直接显示产品目录）
  ↓
固定底部分区导航
```

### 有分类时

- 分区首页只显示分类，不同时显示全部产品。
- 点击分类后进入独立产品目录页。
- 分类手机端一行 2 个，平板和 PC 一行 4 个。

### 没有分类时

- 隐藏分类筛选区域。
- 隐藏分类列表。
- 分区首页直接显示该分区的产品瀑布流。

## 9. 分类筛选

“分类筛选”不是父子分类，也不产生独立内容页面。

它的唯一作用是：

> 将高频筛选词做成快捷按钮，帮助用户快速过滤当前分区中的分类卡片。

示例：

```text
[全部] [美西] [美中] [美东] [热门]
```

规则：

- 系统自动生成“全部”按钮，后台不需要录入。
- “全部”显示文字可以在站点设置中修改。
- 单次只选择一个筛选项。
- 筛选只影响分类卡片，不直接筛选产品。
- 点击筛选按钮不跳转页面。
- 按钮保持单行横向滚动，不堆叠成多行。
- 没有启用的筛选项时，整个筛选区域隐藏。
- 一个分类可以关联多个筛选项。
- 一个筛选项可以关联多个分类。
- 删除筛选项只删除关联关系，不删除分类或产品。

## 10. 分类

分类是正式的内容入口，点击后进入产品目录页。

分类字段：

- 名称
- Slug
- 所属分区
- 分类图片
- 关联分类筛选项
- 排序
- 状态

分类图片可选；没有图片时显示统一的暗色渐变占位视觉，不显示破图。

分类存在产品时禁止直接删除，必须先迁移产品、将产品设为无分类或删除产品。

## 11. 产品目录

产品目录使用图片优先的瀑布流布局。

产品卡片显示：

- 产品封面图
- 产品名称
- 标签

不显示：

- 长正文
- 复杂参数
- 大量说明文字
- 分区名称重复信息

### 加载规则

- 首次加载 20 条。
- 点击“加载更多”后追加 20 条。
- 没有更多内容时隐藏按钮或显示“已加载全部”。
- 使用稳定的游标分页，避免重复和漏项。

### 排序规则

```text
featured DESC
sort_order ASC
created_at DESC
```

即置顶产品优先，再按后台手动排序，最后按创建时间倒序。

## 12. 产品详情页

统一详情页结构：

```text
封面图
图库
产品名称
正文
CTA 按钮
```

规则：

- 产品封面必填。
- 产品图库可为空。
- 目录页只读取封面图。
- 详情页先显示封面，再显示图库。
- 正文使用简单富文本编辑器。
- 富文本仅支持段落、标题、粗体、列表和安全链接。
- 不允许自定义 JavaScript 或任意 HTML。
- 产品可以绑定一个分类，也可以只绑定分区。
- 产品 CTA 文字可以自定义。

## 13. 搜索

搜索仅限当前分区，搜索范围：

- 分类名称
- 产品名称
- 产品标签

不搜索产品长正文。

搜索结果页先显示匹配分类，再显示匹配产品。空关键词不提交，搜索框支持清空。

## 14. Hero 广告池

Hero 是分区首页顶部的广告位。

### 数据关系

```text
Channel
  ↓
Ad Pool
  ↓
Advertisement
```

每条广告只包含：

- 图片
- 目标链接
- 打开方式：当前窗口或新窗口
- 排序
- 启用状态

### 前台规则

- 每个分区可以绑定一个广告池。
- 一个广告池支持多条广告。
- 默认每 5 秒自动轮播。
- 支持移动端触摸滑动。
- 支持平板和 PC 的鼠标拖动、箭头和分页圆点。
- 只有一条广告时不显示控制器。
- 没有启用广告时隐藏整个 Hero 区域。
- 第一张图片立即加载，其余图片延迟或预加载。
- Hero 只在分区首页展示，分类页和产品详情页不重复展示。
- 项目不保存广告展示和点击统计。

## 15. CTA 转化池

产品不直接保存最终链接，而是绑定一个转化组。

```text
Product
  ↓
Conversion Group
  ↓
Conversion Resources
```

### 第一版唯一选择规则

```text
随机
```

用户点击 CTA 后：

1. 请求 `/go/{productSlug}`。
2. 读取产品绑定的转化组。
3. 从全部启用资源中等概率随机选择一个。
4. 返回跳转响应。

如果只有一个启用资源，直接使用该资源。如果没有启用资源，前台隐藏 CTA。

支持的资源类型：

- URL
- 电话
- WhatsApp
- Telegram
- Email

不实现固定、权重和轮询模式，不保存 CTA 点击或转化数据。

## 16. 图片上传

图片上传必须遵循以下流程：

```text
选择本地图片
  ↓
浏览器本地自动压缩
  ↓
显示本地缩略图
  ↓
拖拽排序或删除待上传图片
  ↓
点击保存
  ↓
上传压缩后的图片到 R2
  ↓
保存业务数据和图片顺序到 D1
```

### 必须支持

- 本地自动压缩
- 本地缩略图预览
- 多图拖拽排序
- 删除当前待上传图片
- 已有图片和新图片混合排序
- 点击保存时才上传到 R2

### 不支持

- 裁剪
- 旋转
- 翻转
- 滤镜
- 水印
- 手动画质调节
- 复杂图片编辑器

### 压缩规则

- 默认输出 WebP。
- 浏览器不支持时回退 JPEG。
- 默认最长边不超过 1600px。
- 默认质量约 82%。
- 保留原图比例，不自动裁剪。
- Hero 广告建议由管理员预先准备为 16:9。

浏览器不得获得 R2 Access Key、Secret Access Key 或 Cloudflare API Token。上传请求必须经过管理员 Session 验证，由 Worker 通过 R2 Binding 写入 Bucket。

## 17. R2 图片库

后台提供独立图片库，用于检测 R2 中的图片和数据库引用关系。

### 扫描方式

- 打开图片库时显示最近一次扫描结果。
- 管理员手动点击“扫描 R2”。
- 使用 R2 分页列举 `images/` 前缀对象。
- 对比 D1 中的图片资产记录。
- 对比站点设置、分区、分类、产品和广告中的实际引用。

### 图片状态

- 正常引用：R2 有文件，D1 有记录，业务数据有引用。
- 未引用：R2 有文件，D1 有记录，但没有任何业务引用。
- R2 未登记：R2 有文件，但 D1 没有资产记录。
- 文件缺失：D1 有记录或业务引用，但 R2 没有文件。

### 清理规则

- 支持筛选未引用图片。
- 支持筛选 R2 未登记图片。
- 支持批量勾选和批量删除。
- 删除前必须二次确认。
- 有任何有效引用的图片禁止删除。
- 默认保护上传不足 24 小时的图片，不参与批量清理。
- 删除产品、替换图片或移除图片引用时，不立即删除 R2 对象，由图片库统一清理。

## 18. 后台登录与安全

不使用 Cloudflare Access，不开发用户系统。

后台采用：

```text
Worker Secret 单管理员密码
+
签名 Session Cookie
```

需要配置：

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

安全规则：

- 管理员密码和 Session Secret 只保存在 Worker Secrets。
- 密码不写入 GitHub、D1 或日志。
- 使用常量时间方式比较密码。
- Session 默认有效期 12 小时。
- Cookie 使用 `HttpOnly`、`Secure` 和 `SameSite=Strict`。
- 修改认证 Secret 后旧 Session 失效。
- 登录接口增加基础失败限流。
- 所有后台写操作需要 CSRF 防护。
- `/admin/*` 和 `/api/admin/*` 统一经过鉴权 Middleware。
- 后台页面设置 `noindex`。

## 19. 后台模块

```text
Admin
├── 站点设置
├── 分区管理
├── 分类筛选
├── 分类管理
├── 产品管理
├── 广告池管理
├── 转化池管理
└── 图片库
```

### 站点设置

- 网站名称
- 网站描述
- Logo
- Favicon
- 默认分区
- R2 公开访问域名
- GA4 ID
- Meta Pixel ID
- 18+ 提示开关
- 全站 `noindex` 开关
- 分类筛选“全部”按钮文字
- 隐私政策内容
- 免责声明内容

### R2 公开域名

R2 Bucket 和网站部署完成后，再在 Cloudflare 控制台绑定自定义域名，然后在后台录入：

```text
https://media.example.com
```

数据库图片字段只保存 R2 Object Key，不保存完整 URL。前台通过 `r2_public_base_url + object_key` 生成最终地址，更换媒体域名时不需要批量修改图片记录。

## 20. 数据模型

第一版主要数据表：

```text
site_settings
channels
category_filters
categories
category_filter_relations
products
product_images
ad_pools
advertisements
conversion_groups
conversion_resources
image_assets
```

### 主要关系

```text
Channel
├── Category Filter ←→ Category
├── Category
│   └── Product
├── Unclassified Product
└── Hero Ad Pool
    └── Advertisement

Product
└── Conversion Group
    └── Conversion Resource
```

### Slug 唯一约束

- `channels.slug`：全站唯一。
- `categories.slug`：同一分区内唯一。
- `products.slug`：同一分区内唯一。
- `category_filters.slug`：同一分区内唯一。

Slug 默认根据名称生成，后台允许手动修改。

### 状态字段

分区、分类和产品：

```text
draft
published
disabled
```

广告、广告池、筛选项、转化组和转化资源：

```text
enabled
disabled
```

公开页面只读取已发布和已启用数据。

## 21. 前台路由

```text
/
/{channel}
/{channel}/category/{category}
/{channel}/product/{product}
/{channel}/search?q={keyword}
/go/{product}
```

行为：

- `/` 跳转到默认分区。
- `/{channel}` 显示分区首页。
- `/{channel}/category/{category}` 显示分类产品目录。
- `/{channel}/product/{product}` 显示产品详情。
- `/{channel}/search` 显示当前分区搜索结果。
- `/go/{product}` 执行随机 CTA 资源选择和跳转。

后台路由：

```text
/admin/login
/admin/*
/api/admin/*
/api/public/*
```

## 22. 数据删除规则

| 数据 | 删除规则 |
|---|---|
| 分区 | 存在分类或产品时禁止删除 |
| 分类筛选 | 允许删除，只删除分类关联关系 |
| 分类 | 存在产品时禁止删除 |
| 产品 | 允许删除，图片变为未引用候选 |
| 广告池 | 被分区绑定时禁止删除 |
| 转化池 | 被产品绑定时禁止删除 |
| 图片 | 存在任何引用时禁止删除 |

第一版不做回收站。

## 23. 缓存和数据更新

- 公开分区页和产品详情页使用短时缓存，目标 TTL 为 5 分钟。
- CTA 跳转接口不得缓存。
- 后台页面和 Admin API 不得缓存。
- 后台保存后使相关公开数据失效或重新验证。
- 静态构建资源使用带哈希文件名和长期缓存。
- R2 图片通过自定义域名和 Cloudflare Cache 提供。

## 24. SEO、统计和合规预留

SEO：

- 页面 Title 和 Description
- Canonical
- Open Graph 图片
- `sitemap.xml`
- `robots.txt`
- 全站 `noindex` 开关

统计：

- 仅注入 GA4 和 Meta Pixel 配置。
- 项目数据库不保存浏览、点击和转化记录。

基础合规预留：

- 18+ 进入提示开关。
- 18+ 确认状态仅保存在本地 Cookie。
- 隐私政策页面。
- 免责声明页面。
- 网站内容、广告、服务和外链必须面向合法成年人，并符合实际运营地区的法律和第三方平台规则。

## 25. Cloudflare Bindings 与 Secrets

建议 Binding 名称：

```text
DB            → Cloudflare D1
MEDIA_BUCKET  → Cloudflare R2
```

Worker Secrets：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

非敏感站点设置保存在 D1，不写入 Worker Secrets。

## 26. 建议项目目录

```text
site/
├── src/
│   ├── components/
│   │   ├── admin/
│   │   ├── ads/
│   │   ├── categories/
│   │   ├── products/
│   │   └── shared/
│   ├── layouts/
│   ├── lib/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── images/
│   │   ├── r2/
│   │   ├── validation/
│   │   └── utils/
│   ├── pages/
│   │   ├── admin/
│   │   ├── api/
│   │   ├── [channel]/
│   │   └── index.astro
│   └── styles/
├── migrations/
├── public/
├── astro.config.mjs
├── wrangler.jsonc
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

## 27. 开发和部署目标流程

### 本地开发

```bash
pnpm install
pnpm dev
```

### 类型检查和构建

```bash
pnpm check
pnpm build
```

### D1 迁移

```bash
pnpm wrangler d1 migrations apply DB --local
pnpm wrangler d1 migrations apply DB --remote
```

### 设置 Secrets

```bash
pnpm wrangler secret put ADMIN_PASSWORD
pnpm wrangler secret put SESSION_SECRET
```

### 部署

```bash
pnpm build
pnpm wrangler deploy
```

最终部署可接入 Cloudflare Workers Builds：GitHub `main` 分支更新后自动构建和部署。

## 28. MVP 验收标准

满足以下条件视为第一版完成：

- 后台可以使用 Worker Secret 密码登录和退出。
- 后台可以维护站点设置和 R2 公开域名。
- 后台可以新增、编辑、排序、启用和停用分区。
- 后台可以维护分类筛选及其与分类的多对多关系。
- 后台可以维护分类和产品。
- 分区有分类时显示分类，没有分类时直接显示产品。
- 分类筛选按钮能够即时过滤分类卡片。
- 产品目录首次显示 20 条并支持每次加载 20 条。
- Hero 广告池支持多图自动轮播和手动滑动。
- 产品详情页能够通过随机转化池完成跳转。
- 图片能够在本地压缩、预览、排序和删除。
- 未点击保存时图片不会上传 R2。
- 图片库能够扫描 R2、检测引用并批量清理未引用图片。
- 手机端和平板端布局完整，PC 使用居中的平板布局。
- GA4 和 Meta Pixel 可以通过后台配置接入。
- 项目自身不保存公共访问统计。

## 29. 开发阶段建议

```text
阶段一：项目脚手架、Workers 配置、D1 Migration
阶段二：后台认证、站点设置、分区和分类系统
阶段三：产品、富文本、图片上传和 R2 图片库
阶段四：前台首页、分类目录、详情页和搜索
阶段五：Hero 广告池、随机 CTA 转化池
阶段六：SEO、GA4、Meta Pixel、部署和验收
```

---

本 README 是当前项目的需求和技术基线。后续实现如果与本文冲突，应先更新本文并记录变更，再修改数据库或代码。