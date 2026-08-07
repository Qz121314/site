# 前台 R2 模块化发布

前台公开内容采用手动发布的不可变 R2 模块快照。D1 是后台编辑态数据源；普通 Storefront 内容访问不通过 Worker 动态读取 D1。

## 角色边界

```text
D1
→ 后台编辑态数据源

R2 public/modules/*
→ 已发布的不可变模块版本

R2 public/current.json
→ 当前线上各模块版本的组合指针

Worker
→ 后台 CRUD / 手动发布 / 图片写入与清理 / /go 动态转化
→ 仅提供一个窄的公开 R2 域名发现接口，不提供产品/FAQ/分区内容 API
```

后台保存只修改 D1，不会自动改变用户前台。发布动作把指定模块的当前 D1 公开态生成一个新的不可变 R2 版本，然后原子式更新组合指针。

## 发布模块

前台发布拆成以下独立单元：

```text
site
→ 站点名称、Location、Logo、媒体域名、导航开关、公开 Analytics/Affiliate 开关

sections-index
→ 已启用分区的名称、slug、图标、顺序

faq
→ 已启用 FAQ

section:{sectionId}
→ 该分区的分类
→ 该分区的标签
→ 该分区的已发布产品摘要
→ 该分区产品详情文件
→ CTA 文案 / 模式 / /go/{productId}
```

产品、分类、标签属于所在业务分区，因此这些高频变化只要求发布对应 `section:{sectionId}`。站点设置、FAQ 和其他业务分区不会因为某个产品变化而重新生成版本。

## 首次从旧快照迁移

旧 schema-v1 `public/current.json` 和 `public/versions/*` 仍可由 Storefront 读取，避免部署代码后立即中断旧前台。

第一次使用模块化发布时：

```text
检测到没有 schema-v2 组合指针
→ 读取当前 D1 公开态
→ 一次性生成 site
→ 生成 sections-index
→ 生成 faq
→ 为每个当前启用分区生成 section:{id}
→ 所有必要模块就绪
→ 最后把 public/current.json 切换为 schemaVersion: 2
```

完成这次 bootstrap 后，后续即可单独发布任意板块。

## R2 对象结构

```text
public/
├─ current.json
└─ modules/
   ├─ site/
   │  └─ {contentVersion}/
   │     ├─ manifest.json
   │     └─ site.json
   ├─ sections-index/
   │  └─ {contentVersion}/
   │     ├─ manifest.json
   │     └─ sections.json
   ├─ faq/
   │  └─ {contentVersion}/
   │     ├─ manifest.json
   │     └─ faq.json
   └─ sections/
      └─ {sectionId}/
         └─ {contentVersion}/
            ├─ manifest.json
            ├─ section.json
            └─ products/{productId}.json
```

任何 `{contentVersion}` 目录一经生成不得覆盖。修改必须生成新的版本。

## schema-v2 组合指针

`public/current.json` 不再代表“整个站点只有一个内容版本”，而是一个很小的当前组合：

```json
{
  "schemaVersion": 2,
  "contentVersion": "pointer-revision",
  "publishedAt": "...",
  "site": { "contentVersion": "...", "manifestKey": "...", "sourceRevision": "...", "publishedAt": "..." },
  "sectionsIndex": { "contentVersion": "...", "manifestKey": "...", "sourceRevision": "...", "publishedAt": "..." },
  "faq": { "contentVersion": "...", "manifestKey": "...", "sourceRevision": "...", "publishedAt": "..." },
  "sections": {
    "section-a": { "contentVersion": "...", "manifestKey": "...", "sourceRevision": "...", "publishedAt": "..." }
  }
}
```

例如只发布 `section:section-a` 时，新的 `public/current.json` 只会替换 `sections.section-a` 的引用；site、FAQ 和其他分区引用保持原版本。

## Storefront 读取流程

优先使用构建变量：

```text
PUBLIC_CONTENT_ORIGIN=https://content.example.com
→ GitHub Actions 映射为 VITE_PUBLIC_CONTENT_ORIGIN
```

如果生产构建没有该变量，Storefront 会调用：

```text
GET /api/public/storefront/content-origin
```

这个接口只返回已经公开的 R2 Custom Domain：

```json
{ "contentOrigin": "https://content.example.com" }
```

它不返回站点内容、D1 产品数据、客服配置、Token 或转化目标。拿到域名之后，实际公开内容仍然全部直接从 R2 读取。

schema-v2 浏览器读取流程：

```text
R2 Custom Domain
→ GET /public/current.json
→ GET 当前 site 模块
→ GET 当前 sections-index 模块
→ GET pointer 中每个当前分区的 section.json
→ 前端组合 Home 的热门 / 最新产品
→ 产品详情按产品所属分区的当前 module version 读取
→ FAQ 按当前 faq module version 读取
```

`current.json` 使用 revalidate；所有具体模块版本使用 immutable cache。

## 媒体域名解耦

模块化快照中的分区图标、产品封面和图库保存 **R2 object key**，不把完整媒体 URL 重复固化进每个高频分区版本。

```text
site module
→ mediaBaseUrl

section module
→ products/.../cover.webp

Storefront
→ mediaBaseUrl + object key
```

因此修改 R2 Custom Domain 时只需要发布 `site`，不需要重新生成所有产品分区版本。

## 独立发布与回退

后台顶部保留汇总状态，同时主发布按钮跟随当前工作区：

```text
站点设置
→ 发布站点设置

FAQ 管理
→ 发布 FAQ

分区管理
→ 发布分区导航

某业务分区的 产品管理 / 产品录入 / 分类 / 标签 / 转化池
→ 发布当前分区
```

弹出的板块发布面板可以：

```text
选择任意发布模块
查看该模块当前状态
发布该模块
查看该模块最近 3 个成功版本
只回退该模块
发布全部待更新模块
```

未保存到 D1 的浏览器编辑态仍然禁止发布和回退。

## 每个模块独立保留最近 3 版

保留预算不再由整个站点共享，而是按 `module_key` 独立计算：

```text
site                     最近 3 版
sections-index           最近 3 版
faq                      最近 3 版
section:section-a        最近 3 版
section:section-b        最近 3 版
...
```

因此高频发布 `section:section-a` 100 次，不会挤掉低频 `site` 或 `section:section-b` 的回退版本。

自动清理范围：

```text
该模块第 4 版及更早的 R2 module objects
对应 publish_module_versions
对应 publish_module_jobs 的超预算历史
```

当前正在使用的模块版本永远受保护。

## 图片清理保护

素材是否允许物理删除，需要同时检查：

```text
当前 D1 引用
+
所有仍保留的模块版本 media_keys_json
```

只要任意最近保留的模块版本仍引用该图片，就属于“快照保护”，不能物理删除。这样频繁发布某个产品分区不会导致另一个低频分区或站点 Logo 的可回退历史失去图片。

## 发布安全顺序

单模块发布：

```text
读取并校验 D1 当前公开态
→ 计算该模块 source revision
→ 如果与该模块线上 revision 相同：no-op
→ 写入新的 immutable module objects
→ 写入 manifest
→ 记录 D1 module version
→ 最后更新 public/current.json 对应模块引用
→ 更新 D1 current marker / job published
→ 清理该模块超出最近 3 版的历史
```

如果不可变对象生成失败，不能修改当前 pointer。如果 pointer 已切换但最终 D1 状态写入失败，发布器必须恢复旧 `public/current.json`。

## 公开 / 私有数据边界

允许进入 R2：

```text
站点名称 / Location
Logo 与产品媒体 object key
公开媒体域名
导航开关
GA4 Measurement ID / Facebook Pixel ID
Affiliate 启用状态与平台名称
分区 / 分类 / 标签 / 产品 / FAQ
CTA 文案、模式、/go/{productId}
```

不得进入 R2：

```text
客服 API Token / Secret
客服 private base URL / project private config
客服连接原始配置 JSON
Affiliate 原始配置 JSON
转化池最终 URL
远程客服私有路由细节
后台审计信息
```

客服连接和最终转化目标始终由 Worker + D1 在 `/go/:code` 请求时动态解析。

## 缓存

模块版本文件：

```text
Cache-Control: public, max-age=31536000, immutable
```

当前组合指针：

```text
Cache-Control: public, max-age=30, must-revalidate
```

公开 R2 域名发现接口：

```text
Cache-Control: public, max-age=300, stale-while-revalidate=3600
```

## CORS 与前台路由

R2 Custom Domain 与 Storefront 如果不是同源，R2 Bucket CORS 必须允许 Storefront 生产 Origin 的 `GET` / `HEAD`。公开快照请求不携带 credentials。

Storefront 浏览器路由：

```text
/
/sections/{sectionId}/
/products/{productId}/
```

Cloudflare Static Assets 使用 SPA fallback。`/api/*` 和 `/go/*` Worker-first；`/sections/*` 和 `/products/*` 明确走 Static Assets，避免普通前台深链接产生 Worker 内容请求。

## 不受“三版”规则影响的数据

以下属于独立业务 / 安全数据，不属于发布版本历史：

```text
audit_logs
conversion_events
```

它们不按模块最近 3 版规则删除。
