# Cloudflare Personal Catalog Template

一个基于 Astro SSR 与 Cloudflare Workers、D1、R2 构建的个人目录站模板。根路径直接进入默认或第一个已发布分区；分区首页、产品目录与产品详情是核心内容，通过中文管理后台维护站点、分区、分类、产品、Hero 图片广告、转化池及图片资产。

## 当前状态

项目按空数据模板维护，可直接配置为个人作品、服务、资源或产品目录站：

- 英文公共站点
- 中文管理后台
- 多分区内容管理
- 分类与快捷筛选
- 产品目录和产品详情
- Hero 图片广告池
- 随机 CTA 转化池
- R2 图片上传、扫描和删除队列
- D1 数据库迁移
- 管理员登录与会话鉴权
- Robots、Sitemap、Canonical、Open Graph 和 JSON-LD
- GitHub Actions 自动验证、部署、线上 Smoke Test 和 Worker 回滚

项目不使用 React，也不是大型前端 SPA。公共页面由 Astro SSR 直接输出 HTML，交互使用少量原生 JavaScript。

## 核心访问链路

```text
进入网站并跳转到默认分区
  ↓
查看 Hero 图片广告
  ↓
搜索或使用快捷筛选
  ↓
按分类筛选产品目录
  ↓
查看产品详情
  ↓
点击 CTA
  ↓
转化池实时选择一个可用资源
  ↓
用户选择打开短信/链接或复制号码/链接
```

Hero 广告保持简单模型：**图片 + 跳转链接**。按钮和广告文案直接制作在图片中，系统不维护额外广告标题或按钮文案。

## 部署架构

```text
GitHub Repository
  ↓
GitHub Actions
  ├── 安装依赖
  ├── 生成 Cloudflare 类型
  ├── Astro / TypeScript 检查
  ├── Node 自动化测试
  ├── 本地 D1 Migration 验证
  ├── 数据完整性验证
  ├── Astro SSR 构建
  ├── Headless Chrome 浏览器检查
  ├── 记录 D1 Time Travel 书签
  ├── 应用远程 D1 Migration
  ├── Wrangler Deploy
  ├── 生产 Smoke Test
  └── 失败时自动回滚 Worker
        ↓
Cloudflare Worker
  ├── Astro SSR
  ├── D1 Binding
  ├── R2 Binding
  └── Static Assets
```

一个仓库对应一个 Worker、一个 D1 数据库和一个 R2 Bucket。前台、后台及 API 均由同一个 Worker 提供。

## 技术基线

版本以 `package.json` 和 `pnpm-lock.yaml` 为唯一依据。

| 技术 | 当前版本 | 用途 |
|---|---:|---|
| Node.js | 24+ | 构建、测试及运维脚本 |
| pnpm | 11.14.0 | 包管理 |
| Astro | 7.1.1 | SSR 页面、路由和 API Endpoints |
| `@astrojs/cloudflare` | 14.1.3 | Cloudflare Workers 适配器 |
| Tailwind CSS | 4.3.3 | 基础 CSS 工具链 |
| TypeScript | 6.0.3 | 类型系统 |
| Wrangler | 4.112.0 | Workers、D1、R2 和部署 |

实现约束：

- 不使用 React
- 不使用 ORM
- 不引入 Hono
- D1 使用 Prepared Statements 与 SQL Migration
- 图片由浏览器直接从 R2 公共域名加载
- 项目自身不实现访问统计，按配置加载 GA4 和 Meta Pixel

## 主要路由

```text
/                                      跳转到默认分区，未设置时进入第一个已发布分区
/{channel}                             分区首页
/{channel}?category={category}         未配置分类筛选组时的产品筛选
/{channel}/category/{category}         配置分类筛选组时的分类产品目录
/{channel}/product/{product}           产品详情
/{channel}/search?q=...                搜索结果
/privacy                               隐私政策
/disclaimer                            免责声明
/robots.txt                            Robots
/sitemap.xml                           动态 Sitemap
/admin                                 后台入口
/admin/login                           后台登录
/api/admin/*                           后台接口
/api/public/*                          公共接口
/api/health                            健康检查
/go/*                                  CTA 转化解析
```

## 视觉系统

公共站点采用入口清晰、目录优先的深色编辑风格；后台采用暖中性、高密度运营工作台风格。

样式入口统一为：

```text
src/styles/public-system.css
src/styles/admin-system.css
```

Layout 不直接导入内部样式层。`scripts/verify-style-entrypoints.mjs` 会在 CI 中锁定样式加载顺序，避免继续叠加无序覆盖。

## SEO

公共页面支持：

- Canonical URL
- Robots Meta
- Open Graph
- Twitter Card
- 动态 Sitemap
- 产品 `Product` JSON-LD
- 产品和分类 `BreadcrumbList`
- 分类目录 `ItemList`
- 正文自动生成产品 Meta Description

当 `/` 配置为默认分区跳转时，Sitemap 不提交该跳转 URL。

## 搜索

搜索覆盖：

- 分类名称
- 产品标题
- 产品标签

输入限制为 48 UTF-8 字节。系统会移除 SQL LIKE 通配字符，并在结果内优先排列标题精确匹配、标题前缀匹配和标题包含匹配，标签匹配作为补充。

## 常用命令

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm test
pnpm db:migrate:local
pnpm verify:pool-integrity
pnpm build
pnpm verify:browser-smoke
pnpm deploy
```

## 生产部署验证

生产部署完成后，CI 自动检查：

```text
/api/health
/robots.txt
/
/{channel}/category/{category}
/{channel}/product/{product}
```

部署前的本地 Worker 与 Headless Chrome Smoke Test 还会验证搜索结果、公开产品分页 API 和 CTA 转化解析接口。

如果 Worker 已部署但 Smoke Test 失败，工作流会执行 Worker 自动回滚。D1 不会自动恢复，因为 Time Travel Restore 会覆盖生产数据库并取消进行中的查询。

失败诊断附件包含：

- 部署前 Worker 状态
- 迁移前 D1 Time Travel 书签
- 构建和部署日志
- 浏览器 DOM 与移动端、桌面端截图
- Worker 回滚日志
- `recovery.md` 恢复指南

可通过可选 GitHub Secret `PRODUCTION_ORIGIN` 指定正式域名。未配置时，Smoke Test 会从 Wrangler 部署输出中提取 `workers.dev` 地址。

## GitHub Secrets

生产部署要求：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
ADMIN_PASSWORD
SESSION_SECRET
```

可选：

```text
PRODUCTION_ORIGIN
```

## 数据更新规则

后台保存以下内容后不需要重新部署：

- 站点设置
- 分区
- 分类筛选
- 分类
- 产品与图库
- Hero 图片广告
- CTA 转化资源
- Logo、Favicon 和 R2 公共域名
- GA4 和 Meta Pixel ID

只有代码、依赖、数据库结构或部署配置发生变化时才需要重新部署。

## 性能原则

- 首次目录读取 20 条产品
- Load More 每次加载 20 条
- 目录查询不读取正文和完整图库
- 目录只读取 480px 独立 WebP 缩略图，详情读取主图
- 公共 HTML、Sitemap 和公开目录接口使用一年 Cloudflare Edge Cache，内容更新后由后台手动全局刷新
- 浏览器始终重新验证 HTML，避免长期缓存副本绕过后台刷新
- 图片直接从 R2 自定义域名加载
- 视口外图片懒加载
- Hero 第一张图片优先加载
- 公共页面不加载大型客户端框架

## 维护原则

- 功能行为与视觉系统分离
- 模板只保留一个干净的 `0001_initial.sql`，新站从空 D1 数据库安装
- 测试数据和旧图片不进入模板，不保留旧字段兼容或原图回退
- 产品图片必须同时具备详情主图和目录缩略图，数据库约束会拒绝不完整关系
- 部署失败先查看 CI 诊断附件和 `recovery.md`
- 不在源码或配置文件中提交生产 Secrets
