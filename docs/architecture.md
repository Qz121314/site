# 项目架构基线

本仓库 `Qz121314/site` 是一个由后台数据驱动的业务展示模板。

```text
Storefront   English 用户前端
Admin        中文管理后台
Worker       业务 API、认证、发布和静态资源路由
D1           业务数据、状态、审计和发布记录
R2           图片与不可变公开内容版本
```

当前优先完成后台数据录入和管理。实时客服、多语言和行业专属功能不在当前范围。

## 1. Cloudflare 资源边界

本项目只维护一套正式资源：

```text
Worker: service-catalog-site
D1:     service-catalog-site-db
R2:     service-catalog-site-assets
```

禁止继续创建 `preview`、`production`、`dev` 后缀资源。Pull Request 只在本地模拟 D1 和 Worker，不部署第二套 Cloudflare Worker。

Worker 绑定名称固定：

```text
DB              D1Database
ASSETS_BUCKET   R2Bucket
ASSETS          Workers Static Assets
```

## 2. 语言边界

```text
用户前端：English
后台界面：中文
公开内容：管理员直接录入英文
```

不建立翻译表、语言切换或 `/en`、`/es` 路由。公开站点使用根路径 `/`。

## 3. 单管理员认证

第一版采用单管理员密码模式，不建设账号体系。

Cloudflare Worker 手动绑定两个 Secret：

```text
ADMIN_PASSWORD   后台登录密码
SESSION_SECRET   登录会话签名密钥
```

约束：

- 登录页只输入密码；
- 密码不得写入 GitHub、`wrangler.jsonc`、D1 或普通变量；
- 不建立 `admin_users`、角色、权限和持久化会话表；
- 登录成功后签发短期签名 Cookie；
- Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Strict`；
- 修改 `SESSION_SECRET` 后全部旧会话失效；
- 登录接口限制尝试频率；
- 后台写操作统一记入 `audit_logs`，操作者为 `single_admin`。

认证接口：

```text
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/auth/session
```

## 4. D1 完整初始模型

第一版 Schema 由单一 migration 创建：

```text
migrations/0001_initial_schema.sql
```

它一次建立全部已确定的核心数据边界：

```text
media_assets          R2 对象元数据
sections              动态业务分区
conversion_methods    分区内转化方式
products              分区内产品或服务
product_media         产品图片关联和顺序
faqs                   FAQ 内容
site_settings          单例站点设置
publish_jobs           发布任务状态
publish_versions       已发布内容版本
conversion_events      转化事件
audit_logs             后台操作审计
idempotency_keys       防重复写入记录
```

数据库设计规则：

- 主键使用 Worker 生成的 UUID 字符串；
- 时间使用 UTC ISO 8601 字符串；
- 分区、产品、转化方式、媒体和 FAQ 使用软删除；
- 外键默认限制物理删除；
- 产品使用组合外键约束分区与转化方式，禁止引用其他分区的转化方式；
- 活跃分区名称、slug 和分区内产品 slug 保持唯一；
- JSON 字段通过 `json_valid` 约束；
- Dashboard 不允许手工修改表结构。

详细定义见 [D1 与 R2 数据存储基线](data-storage.md)。

## 5. 分区管理

“分区管理”只负责：

```text
分区名称
分区图标
排序
是否启用
```

分区支持系统图标或上传图片：

```text
icon_type = icon   → icon_value 保存图标标识
icon_type = asset  → icon_asset_id 引用 media_assets
```

创建分区后，后台自动生成：

```text
[分区名称]
├─ 产品管理
└─ 转化方式
```

分区排序同时决定后台动态菜单和前端首页导航顺序。停用分区不进入公开发布数据。

## 6. 分区内产品

产品必须属于一个分区。

```text
section_id
slug                 后台根据标题生成并保证分区内唯一
service_mode          online / offline
title
body
address               仅 offline 使用
cover_asset_id
conversion_method_id
is_featured
featured_order
status                draft / published / archived
published_at
created_at
updated_at
deleted_at
```

第一版不增加距离、评分、价格、销量、营业时间、复杂门店关系或行业专属字段。

产品封面规则：

```text
存在 cover_asset_id
→ 使用指定封面

不存在 cover_asset_id
→ 使用 product_media 中 sort_order 最小的图片
```

## 7. 分区内转化方式

转化方式属于一个分区，并可被该分区多个产品复用。

```text
type           url / phone / email / custom
button_label
target_value   url、phone、email 使用
config_json    custom 使用
sort_order
is_enabled
```

产品只能选择本分区的转化方式，该规则由数据库组合外键和 API 双重校验。

## 8. R2 对象结构

R2 Bucket 默认保持私有，不直接开放整个 Bucket。

```text
media/{asset_id}/original/{safe_filename}
media/{asset_id}/variants/{variant}.{extension}

public/current.json
public/versions/{content_version}/manifest.json
public/versions/{content_version}/home.json
public/versions/{content_version}/sections/{section_id}.json
public/versions/{content_version}/products/{product_id}.json
public/versions/{content_version}/faq.json
```

公开版本目录不可覆盖。只有新版本全部写入并验证完成后，才切换 `public/current.json`。

## 9. 前端数据驱动

首页结构：

```text
Location / City
后台动态分区导航
热门产品推荐
Home / Hot / Messages / FAQ
```

前端不得写死业务分区或产品内容。系统入口与业务分区分开：

```text
Hot      查询热门产品
Latest   按发布时间排序
More     展示全部启用分区
```

当前不设置 Banner。

## 10. 后台数据管理规则

所有可删除列表统一支持：

```text
行选择
当前页全选
批量删除
删除确认
软删除
回收站恢复
操作审计
```

审计日志不可编辑和软删除。批量写操作必须支持幂等键。

## 11. 迁移与部署

Pull Request：

```text
全新本地 D1
→ 完整执行所有 migration
→ lint / typecheck / test / build
→ Worker dry-run
```

`main`：

```text
build
→ apply pending D1 migrations
→ deploy service-catalog-site
→ production smoke test
```

所有结构变化必须形成新的顺序 migration。禁止修改已经在正式 D1 执行过的 migration 文件。

## 12. 路由

```text
/             English Storefront
/admin/*      中文管理后台
/api/*        业务 API
/go/:code     转化跳转
```

Storefront 与 Admin 分别构建，但共同由唯一正式 Worker 提供。

## 13. 当前开发顺序

```text
1. 完成并验证 D1 / R2 正式基线
2. 配置 ADMIN_PASSWORD 与 SESSION_SECRET
3. 实现密码登录和签名 Cookie
4. 实现分区管理 API
5. 实现中文分区管理页面
6. 创建分区后动态菜单立即出现
7. 开发分区内产品和转化方式
8. 开发媒体、热门推荐和 FAQ
9. 开发发布管线和 English Storefront
10. 项目完成后再建设独立客服系统
```
