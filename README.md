# Multi-Channel Visual Recommendation Platform

一个面向手机端和平板端的通用视觉推荐站模板。项目通过后台维护分区、分类筛选、分类、产品、Hero 广告池、随机 CTA 转化池和 R2 图片资产，以一套代码部署一个网站。

> 当前状态：第一阶段项目脚手架、D1 初始迁移、后台登录和自动部署流程已经实现；正在进入核心后台功能开发。

## 1. 项目目标

核心访问链路：

```text
进入分区
  ↓
查看 Hero 广告
  ↓
搜索或使用分类筛选按钮
  ↓
进入分类产品目录
  ↓
查看产品详情
  ↓
点击 CTA，由转化池随机选择资源并跳转
```

项目不是企业官网、社区、CRM 或复杂博客系统。核心目标是图片优先展示，并缩短从浏览到转化的路径。

## 2. 部署模型

```text
一个 GitHub 仓库
+
一个 Cloudflare Worker
+
一个 Cloudflare D1 数据库
+
一个 Cloudflare R2 Bucket
=
一个网站
```

只部署一个 Worker。该 Worker 同时处理：

- Astro SSR 前台页面
- 后台管理页面
- 登录和鉴权
- Public API
- Admin API
- 产品“加载更多”接口
- 搜索接口
- R2 上传、扫描和清理接口
- CTA 随机跳转接口

不拆分前台 Worker、后台 Worker、API Worker 或图片 Worker。

## 3. 语言规则

### 前台

前台系统界面统一使用英语，包括：

- 搜索框占位文字
- `All`
- `Load More`
- `No More Results`
- `Search Results`
- 返回、空状态、错误状态和 CTA 默认文字
- 18+ 提示界面
- 隐私政策和免责声明的默认页面标题

产品名称、分类名称、广告内容和正文由管理员录入，正式运营数据原则上使用英语。

### 后台

后台管理界面统一使用中文，包括：

- 导航菜单
- 表单标签
- 操作按钮
- 校验提示
- 成功和错误提示
- 图片库状态
- 删除确认

第一版不开发多语言切换功能。

## 4. 域名和路由

假设网站正式域名为：

```text
https://example.com
```

### 前台和后台

```text
https://example.com/                         前台根地址
https://example.com/{channel}                分区首页
https://example.com/{channel}/category/...   分类产品目录
https://example.com/{channel}/product/...    产品详情
https://example.com/admin                    后台管理界面
https://example.com/admin/login              后台登录
https://example.com/api/admin/*              后台管理接口
https://example.com/api/public/*             前台公开接口
https://example.com/go/*                     CTA 跳转接口
```

后台没有独立域名。后台地址始终是：

```text
网站域名 + /admin
```

部署初期可以通过 Workers 默认域名访问，例如：

```text
https://site.<workers-subdomain>.workers.dev/admin
```

### R2 图片域名

图片使用独立的 R2 自定义域名，例如：

```text
https://media.example.com
```

绑定流程：

1. 先在 Cloudflare 控制台中为 R2 Bucket 绑定自定义域名。
2. 绑定成功后，在后台“站点设置”中录入 `https://media.example.com`。
3. 后台录入只负责告诉网站使用哪个公开基础地址，不会自动完成 DNS 或 R2 域名绑定。

数据库只保存 R2 Object Key：

```text
images/products/xxx.webp
```

前台动态拼接：

```text
r2_public_base_url + object_key
```

因此更换媒体域名时，不需要批量修改产品图片记录。

## 5. 技术架构

```text
GitHub
  ↓
GitHub Actions
  ├── 安装依赖
  ├── 类型检查
  ├── 构建 Astro
  ├── 应用 D1 Migration
  ├──同步 Worker Secrets
  └── Wrangler Deploy
        ↓
Cloudflare Worker
  ├── Astro SSR
  ├── D1 Binding
  └── R2 Binding
```

不使用 Cloudflare Workers Builds。GitHub Actions 负责构建和部署，避免消耗 Cloudflare Workers Builds 的构建分钟。

## 6. 技术版本基线

以下版本为项目初始化基线，核对日期为 **2026-07-20**。项目初始化后，以 `package.json` 和 `pnpm-lock.yaml` 为唯一版本依据。

| 技术 | 版本基线 | 用途 |
|---|---:|---|
| Node.js | 24 LTS | 构建环境 |
| pnpm | 11.x | 包管理 |
| Astro | 7.1.1 | SSR 页面、路由和 API Endpoints |
| `@astrojs/cloudflare` | 14.x | Cloudflare Workers 适配器 |
| Tailwind CSS | 4.3.3 | UI 和响应式样式 |
| React | 19.2.7 | 后台交互组件和必要的交互岛 |
| TypeScript | 6.0.3 | 类型系统；Astro 检查器兼容版本 |
| Wrangler | 4.x | D1、R2、Secrets 和 Worker 部署 |
| Cloudflare D1 | 托管服务 | SQLite 关系数据库 |
| Cloudflare R2 | 托管服务 | 图片对象存储 |

实现约束：

- 使用 Astro Server Endpoints 和 Middleware。
- 第一版不引入 Hono。
- 第一版不引入 ORM。
- D1 使用 Worker Binding、Prepared Statements 和 SQL Migration。
- 使用 `wrangler.jsonc`。
- 启用 `nodejs_compat`。
- 使用 `wrangler types` 生成 Binding 类型。

## 7. SSR 和数据更新规则

项目不是纯静态数据站，而是：

```text
Astro SSR 动态页面
+
长期缓存的静态资源和 R2 图片
```

后台保存数据后：

```text
写入 D1 / R2
  ↓
用户刷新或重新访问页面
  ↓
Worker 读取最新数据
  ↓
前台显示最新内容
```

后台更新以下内容不需要重新部署：

- 站点设置
- 分区
- 分类筛选
- 分类
- 产品
- 产品排序
- Hero 广告
- 广告排序
- CTA 转化资源
- Logo 和 Favicon
- R2 公开域名
- GA4 和 Meta Pixel ID

只有修改代码、数据库结构、依赖或部署配置时才需要 GitHub Actions 重新部署。

第一版不做 WebSocket 实时推送。“实时更新”指后台保存后，用户刷新或重新请求即可看到新数据。

## 8. 性能原则

- 首次目录只查询 20 条产品。
- 点击 `Load More` 每次再加载 20 条。
- 目录查询只读取封面、名称、Slug 和标签，不读取长正文及完整图库。
- D1 为分区、分类、状态和排序建立组合索引。
- Astro 首屏直接输出 HTML，前台不做大型 React SPA。
- React 主要用于后台和少量交互组件。
- 图片不通过 Worker 代理，浏览器直接从 R2 自定义域名加载。
- 产品图片在浏览器本地压缩后再上传。
- 视口外图片使用懒加载。
- Hero 第一张图片优先加载，其余图片延迟加载或预加载。
- CSS、JavaScript 和图片使用长期缓存。
- 动态 HTML 第一版不设置长缓存，保证后台更新后刷新即生效。

## 9. 视觉和响应式

前台采用统一的高级暗黑娱乐风格：

- 深黑和暗紫背景
- 香槟金、玫瑰红或紫色强调色
- 图片优先
- 卡片底部渐变遮罩
- 半透明悬浮底部导航
- 较大圆角
- 克制的阴影、发光和过渡动画

| 设备 | 宽度 | 布局 |
|---|---:|---|
| 手机 | `< 768px` | 页面全宽，分类 2 列，产品 2 列 |
| 平板 | `>= 768px` | 分类 4 列，产品 4 列 |
| PC | `>= 768px` | 使用平板布局，最大宽度 960px，页面居中 |

不设计独立桌面侧边栏或超宽桌面版。

## 10. 信息架构

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

### 分区

- 支持创建多个分区。
- 分区名称不能写死为 Escorts、Dating 或其他固定名称。
- 名称、Slug、图标、排序、状态和 Hero 广告池由后台配置。
- 已启用分区自动生成底部导航。
- `/` 自动跳转到默认分区。

## 11. 分区首页

固定顺序：

```text
LOGO
  ↓
Hero 广告轮播
  ↓
搜索框
  ↓
分类筛选按钮（没有则隐藏）
  ↓
分类列表（没有分类则显示产品目录）
  ↓
固定底部分区导航
```

有分类时，只显示分类卡片，不同时显示全部产品。没有启用分类时，直接显示该分区的产品目录。

## 12. 分类筛选

分类筛选不是父子分类，也不产生独立页面。它只负责将高频筛选词显示成快捷按钮，以过滤当前分区中的分类卡片。

规则：

- 系统自动生成 `All` 按钮。
- 后台可修改 `All` 的显示文字。
- 单次只选择一个筛选项。
- 按钮单行横向滚动。
- 点击后不跳转页面。
- 一个分类可以关联多个筛选项。
- 一个筛选项可以关联多个分类。
- 删除筛选项只删除关联关系，不删除分类和产品。
- 没有启用筛选项时隐藏整个区域。

## 13. 分类和产品

分类字段：

- 名称
- Slug
- 所属分区
- 分类图片
- 关联分类筛选项
- 排序
- 状态

产品字段：

- 名称
- Slug
- 所属分区
- 所属分类，可为空
- 封面图片，必填
- 图库，可为空
- 标签
- 富文本正文
- CTA 文字
- 转化组
- 排序
- 置顶
- 状态

目录卡片显示：

- 产品封面
- 产品名称
- 标签

首次加载 20 条，点击 `Load More` 追加 20 条。

排序：

```text
featured DESC
sort_order ASC
created_at DESC
```

详情页：

```text
封面图
图库
产品名称
正文
CTA 按钮
```

富文本只允许段落、标题、粗体、列表和安全链接，不允许任意 HTML 或 JavaScript。

## 14. 搜索

搜索仅限当前分区，搜索：

- 分类名称
- 产品名称
- 产品标签

不搜索长正文。搜索结果先显示匹配分类，再显示匹配产品。

## 15. Hero 广告池

每个分区可以绑定一个广告池。广告池支持多条广告。

每条广告包含：

- 图片
- 目标链接
- 打开方式：当前窗口或新窗口
- 排序
- 启用状态

前台规则：

- 默认每 5 秒自动轮播。
- 支持触摸滑动、鼠标拖动、箭头和分页圆点。
- 只有一条广告时隐藏控制器。
- 没有广告时隐藏整个 Hero。
- Hero 只在分区首页展示。
- 不保存广告展示或点击统计。

## 16. CTA 转化池

产品绑定一个转化组，转化组包含一个或多个启用资源。

第一版唯一选择模式：

```text
随机等概率
```

点击 CTA：

1. 请求 `/go/{productSlug}`。
2. 读取产品绑定的转化组。
3. 从启用资源中等概率随机选择一个。
4. 返回跳转响应。

支持：

- URL
- 电话
- WhatsApp
- Telegram
- Email

不实现固定、权重和轮询模式，不保存 CTA 点击或转化统计。没有启用资源时隐藏 CTA。

## 17. 图片上传

流程：

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
保存图片顺序和业务数据到 D1
```

必须支持：

- 本地自动压缩
- 本地缩略图预览
- 多图拖拽排序
- 删除当前待上传图片
- 已有图片和新图片混合排序
- 只有点击保存时才上传到 R2

不支持裁剪、旋转、翻转、滤镜、水印和复杂图片编辑。

默认规则：

- WebP 输出，必要时回退 JPEG
- 最长边不超过 1600px
- 默认质量约 82%
- 保留原始比例
- Hero 建议管理员准备 16:9 图片

浏览器不得获得任何 R2 Access Key 或 Cloudflare API Token。上传必须经过后台 Session，由 Worker 通过 R2 Binding 写入 Bucket。

## 18. R2 图片库

后台提供图片库，用于检测 R2 对象、D1 图片记录和业务引用。

状态：

- 正常引用
- 未引用
- R2 存在但 D1 未登记
- D1 有记录但 R2 文件缺失

规则：

- 图片库手动执行“扫描 R2”。
- 支持按状态筛选。
- 支持批量勾选和批量删除。
- 删除前二次确认。
- 有任何有效引用的图片禁止删除。
- 上传不足 24 小时的图片默认不参与批量清理。
- 删除产品或替换图片时不立即删除 R2 文件，由图片库统一清理。

## 19. 后台登录和安全

不使用 Cloudflare Access，不开发用户系统。

后台采用：

```text
Worker Secret 单管理员密码
+
签名 Session Cookie
```

Worker Secrets：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

规则：

- Session 默认有效期 12 小时。
- Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Strict`。
- `/admin/*` 和 `/api/admin/*` 统一鉴权。
- 后台写操作启用 CSRF 防护。
- 登录失败增加基础限流。
- 后台页面设置 `noindex`。
- 密码和 Secret 不写入 GitHub、D1 或日志。

## 20. 后台模块

```text
后台
├── 站点设置
├── 分区管理
├── 分类筛选
├── 分类管理
├── 产品管理
├── 广告池管理
├── 转化池管理
└── 图片库
```

站点设置：

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
- 分类筛选 `All` 文字
- 隐私政策内容
- 免责声明内容

## 21. 数据模型

主要表：

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

Slug 约束：

- `channels.slug` 全站唯一
- `categories.slug` 同一分区内唯一
- `products.slug` 同一分区内唯一
- `category_filters.slug` 同一分区内唯一

状态：

```text
draft
published
disabled
enabled
```

公开页面只读取已发布和已启用数据。

## 22. 删除规则

| 数据 | 删除规则 |
|---|---|
| 分区 | 存在分类或产品时禁止删除 |
| 分类筛选 | 可删除，只删除关联关系 |
| 分类 | 存在产品时禁止删除 |
| 产品 | 可删除，图片变为未引用候选 |
| 广告池 | 被分区绑定时禁止删除 |
| 转化池 | 被产品绑定时禁止删除 |
| 图片 | 存在任何引用时禁止删除 |

第一版不做回收站。

## 23. SEO、统计和合规预留

SEO：

- Title 和 Description
- Canonical
- Open Graph
- `sitemap.xml`
- `robots.txt`
- 全站 `noindex` 开关

统计：

- 只注入 GA4 和 Meta Pixel。
- 项目数据库不保存浏览、点击和转化数据。

合规预留：

- 18+ 进入提示开关
- 18+ 确认状态只保存在本地 Cookie
- 隐私政策
- 免责声明
- 内容、广告、服务和外链必须符合运营地区法律与第三方平台规则

## 24. Cloudflare Bindings

```text
DB            → Cloudflare D1
MEDIA_BUCKET  → Cloudflare R2
```

## 25. GitHub Actions 自动部署

只使用 GitHub Actions，不连接 Cloudflare Git Integration，避免重复部署。

触发规则：

```text
push 到 main
  ↓
GitHub Actions 自动构建和部署
```

只修改以下路径时不触发部署：

```text
README.md
docs/**
```

工作流使用并发控制；有更新的部署开始时，取消尚未完成的旧部署，只保留最新版本。

工作流文件：

```text
.github/workflows/deploy.yml
```

工作流需要四个 GitHub Repository Secrets：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
ADMIN_PASSWORD
SESSION_SECRET
```

其中：

- `CLOUDFLARE_API_TOKEN`：GitHub Actions 调用 Wrangler 部署 Cloudflare。
- `CLOUDFLARE_ACCOUNT_ID`：指定部署目标 Cloudflare 账户。
- `ADMIN_PASSWORD`：后台管理员登录密码。
- `SESSION_SECRET`：签名后台 Session Cookie 的随机密钥。

工作流会将 `ADMIN_PASSWORD` 和 `SESSION_SECRET` 同步为 Worker Secrets。GitHub Secret 并不会自动成为 Worker Secret，必须由工作流显式上传。

## 26. 四个 GitHub Secrets 的设置步骤

### 26.1 创建 `CLOUDFLARE_API_TOKEN`

Cloudflare 中文界面路径可能因版本略有变化，对照如下：

```text
右上角头像
→ 我的个人资料（My Profile）
→ API 令牌（API Tokens）
→ 创建令牌（Create Token）
→ 创建自定义令牌（Create Custom Token）
→ 开始（Get started）
```

令牌名称：

```text
site-github-actions
```

权限建议：

```text
账户（Account）
├── Workers 脚本（Workers Scripts）→ 编辑（Edit）
├── D1 → 编辑（Edit）
└── Workers R2 存储（Workers R2 Storage）→ 编辑（Edit）
```

账户资源：

```text
包括（Include）
→ 指定账户（Specific account）
→ 选择本项目所在账户
```

Zone 资源不需要配置，因为工作流第一版不自动修改 DNS 或绑定自定义域名。

然后：

```text
继续以显示摘要（Continue to summary）
→ 创建令牌（Create Token）
→ 复制令牌（Copy token）
```

Token 只显示一次。复制后立即保存到 GitHub Secret，不要写入代码、README、聊天或本地明文文件。

### 26.2 获取 `CLOUDFLARE_ACCOUNT_ID`

方法一：

```text
Cloudflare 控制台
→ Workers 和 Pages（Workers & Pages）
→ 概述（Overview）
→ 账户详细信息（Account details）
→ Account ID
→ 点击复制
```

方法二：

```text
Cloudflare 账户主页
→ 账户名称右侧菜单
→ 复制账户 ID（Copy account ID）
```

Account ID 是 32 位账户标识，不是密码。

### 26.3 设置 `ADMIN_PASSWORD`

自行生成一个强密码，作为以后访问以下地址时的后台登录密码：

```text
https://example.com/admin
```

建议：

- 至少 16 个字符
- 包含大小写字母、数字和符号
- 不与 Cloudflare、GitHub 或邮箱密码相同
- 使用密码管理器保存

### 26.4 设置 `SESSION_SECRET`

生成一个独立的随机字符串，用于签名 Session Cookie。

要求：

- 至少 48 个随机字节，建议 64 个以上随机字符
- 不能与 `ADMIN_PASSWORD` 相同
- 不需要人工记忆
- 使用密码管理器保存

可用密码管理器的“随机密码生成器”生成 64 至 96 个字符。

### 26.5 将四个值加入 GitHub

打开仓库：

```text
Qz121314/site
→ Settings（设置）
→ Secrets and variables（机密和变量）
→ Actions
→ Secrets（机密）
→ Repository secrets（存储库机密）
→ New repository secret（新建存储库机密）
```

依次添加：

| Name / 名称 | Secret / 机密值 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare 创建后只显示一次的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `ADMIN_PASSWORD` | 自定义后台登录密码 |
| `SESSION_SECRET` | 独立随机长字符串 |

每个 Secret 点击：

```text
Add secret（添加机密）
```

保存后 GitHub 不会再次显示 Secret 明文，这是正常行为。只能更新或删除。

## 27. 安全约束

绝不能提交到 GitHub：

```text
CLOUDFLARE_API_TOKEN
ADMIN_PASSWORD
SESSION_SECRET
.dev.vars
.env
私钥
R2 Access Key
```

GitHub Actions 仅在 `main` 分支 push 时部署，不使用不受信任的 PR 工作流访问生产 Secrets。

## 28. 建议项目目录

```text
site/
├── .github/workflows/deploy.yml
├── src/
│   ├── components/
│   ├── layouts/
│   ├── lib/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── images/
│   │   ├── r2/
│   │   └── validation/
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

## 29. MVP 验收标准

- 前台系统界面为英语，后台管理界面为中文。
- 后台可通过 Worker Secret 密码登录和退出。
- 后台可维护站点设置和 R2 公开域名。
- 后台可维护分区、分类筛选、分类和产品。
- 分区有分类时显示分类；没有分类时直接显示产品。
- 分类筛选按钮即时过滤分类卡片。
- 产品目录首次显示 20 条，每次加载更多 20 条。
- Hero 广告池支持自动轮播和手动滑动。
- 产品详情通过随机转化池完成跳转。
- 图片支持本地压缩、预览、排序和删除。
- 未点击保存时图片不上传 R2。
- 图片库可扫描 R2、检测引用并批量清理未引用图片。
- 后台保存数据后，前台刷新即可显示最新数据，不需要重新部署。
- 手机和平板布局完整，PC 使用居中的平板布局。
- GitHub Actions 可从 `main` 自动部署到 Cloudflare。
- GA4 和 Meta Pixel 可通过后台配置。
- 项目自身不保存公开访问统计。

---

本 README 是当前项目的需求、技术和部署基线。后续实现如果与本文冲突，应先更新本文并记录变更，再修改数据库或代码。
