# 前台 R2 模块化发布

前台公开内容采用手动发布的不可变 R2 模块快照。D1 是后台编辑态数据源；普通 Storefront 内容访问不通过 Worker 动态读取 D1。

## 角色边界

```text
D1
→ 后台编辑态数据源
→ CTA / 转化池实时业务状态

R2 public/modules/*
→ 已发布的不可变内容模块版本

R2 public/current.json
→ 当前线上各内容模块版本的组合指针

Worker
→ 后台 CRUD / 手动发布 / 图片写入与清理
→ /api/public/storefront/cta/{productId} 实时 CTA 可用状态
→ /go/{productId} 实时转化与跳转
→ 公开 R2 域名发现与 R2 读取 fallback
```

后台保存内容只修改 D1，不会自动改变用户前台；发布动作把指定模块的当前 D1 公开内容生成一个新的不可变 R2 版本，然后原子式更新组合指针。

CTA 和转化池不是发布内容。修改产品绑定的转化分组、转化入口、客服分组或链接后保存即实时生效，不需要重新发布 R2。

## 发布模块

前台发布拆成以下独立单元：

```text
site
→ 站点名称、Location、Logo、媒体域名、导航开关、GA4 Measurement ID

sections-index
→ 已启用分区的名称、slug、图标、顺序

faq
→ 已启用 FAQ

section:{sectionId}
→ 该分区的分类
→ 该分区的标签
→ 该分区的已发布产品摘要
→ 该分区产品详情文件
```

产品、分类、标签属于所在业务分区，因此这些内容变化只要求发布对应 `section:{sectionId}`。站点设置、FAQ 和其他业务分区不会因为某个产品内容变化而重新生成版本。

转化配置不参与 section source revision，所以只修改 CTA / 转化池不会产生“待发布”。

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

Storefront 每次启动都会调用运行时配置接口：

```text
GET /api/public/storefront/content-origin
```

这个接口直接读取后台站点设置中的 R2 Custom Domain：

```json
{ "contentOrigin": "https://content.example.com" }
```

拿到域名之后，普通站点内容直接从 R2 读取。

R2 域名不会写入前端构建变量或部署产物。后续更换域名时，在后台完成域名测试并保存即可；Storefront 下次启动会自动读取新值。部署流程只验证后台配置是否确实绑定到当前 R2 Bucket，不会反向覆盖后台设置。

schema-v2 浏览器读取流程：

```text
R2 Custom Domain
→ GET /public/current.json
→ GET 当前 site 模块
→ GET 当前 sections-index 模块
→ GET pointer 中每个当前分区的 section.json
→ 前端组合 Home 的热门 / 最新产品
→ 产品详情按产品所属分区的当前 module version 读取
→ 产品详情同时 GET /api/public/storefront/cta/{productId} 获取实时 CTA
→ FAQ 按当前 faq module version 读取
```

`current.json` 使用 revalidate；所有具体模块版本使用 immutable cache。CTA 响应使用 `no-store`，不进入 R2 immutable 缓存。

旧 schema-v1 产品快照如果带有历史 CTA 字段，Storefront 也会用实时 CTA 响应覆盖，避免旧快照继续使用过期转化配置。

## 媒体域名解耦

模块化快照中的分区图标、产品封面和图库保存 **R2 object key**，不把完整媒体 URL 重复固化进每个高频分区版本。

```text
后台站点设置（D1）
→ mediaBaseUrl / contentOrigin

section module
→ products/.../cover.webp

Storefront
→ mediaBaseUrl + object key
```

发布快照只保存 R2 object key，不保存当前媒体域名。修改 R2 Custom Domain 不需要重新构建 Storefront，也不需要重新生成产品或站点快照。

## 独立发布与回退

后台顶部保留汇总状态，同时主发布按钮跟随当前工作区：

```text
站点设置
→ 发布站点设置

FAQ 管理
→ 发布 FAQ

分区管理
→ 发布分区导航

某业务分区的 产品管理 / 分类 / 标签 / 转化池
→ 发布当前分区
```

其中转化池本身是实时业务配置；从转化池工作区点击“发布当前分区”只会发布该分区的内容变化，转化池变化本身不会生成新快照。

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
读取并校验 D1 当前公开内容
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
GA4 Measurement ID
分区 / 分类 / 标签 / 产品内容 / FAQ
```

不进入 R2、由 Worker + D1 实时处理：

```text
产品 conversion_group_id
CTA 文案 / 模式 / 可用状态
转化分组启停状态
转化池最终 URL
轮换状态
客服分组绑定
客服连接状态
客服 API Token / Secret
客服 private base URL / project private config
客服连接原始配置 JSON
后台审计信息
```

产品详情只在打开时读取一次实时 CTA 状态；真正点击 CTA 时进入 `/go/{productId}`，再次读取当前 D1 转化配置并执行 round-robin。因此首页和产品列表仍然不产生 CTA Worker 请求。

## 已退役站点设置

Facebook Pixel、Messages 导航开关和 Affiliate 检测已经从运行时模型、后台表单和新 R2 快照中移除。Messages 本身仍是 Storefront 固定消息中心入口，后续通过 Site Worker 的服务商无关接口连接独立客服系统。历史 D1 migration 中的旧列仅作为兼容遗留保留，不再读取、写入或发布；不为删除这些旧列重建生产表。

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

实时 CTA 状态：

```text
Cache-Control: no-store
```

## CORS 与前台路由

R2 Custom Domain 与 Storefront 如果不是同源，R2 Bucket CORS 必须允许 Storefront 生产 Origin 的 `GET` / `HEAD`。公开快照请求不携带 credentials。

Storefront 浏览器路由：

```text
/
/sections/{sectionSlug}/
/sections/{sectionSlug}/products/{productSlug}/
/products/{productId-or-uniqueSlug}/  兼容旧链接
```

Cloudflare Static Assets 使用 SPA fallback。`/api/*` 和 `/go/*` Worker-first；`/sections/*` 和 `/products/*` 明确走 Static Assets，避免普通前台深链接产生 Worker 内容请求。

## 不受“三版”规则影响的数据

以下属于独立业务 / 安全数据，不属于发布版本历史：

```text
audit_logs
conversion_events（预留表；当前 /go 不写入）
```

它们不按模块最近 3 版规则删除。
