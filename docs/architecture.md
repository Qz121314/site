# 项目架构基线

本仓库 `Qz121314/site` 是一个由后台数据驱动的业务展示模板。

```text
Storefront   English 用户前端
Admin        中文管理后台
Worker       业务 API、认证、发布和静态资源路由
D1           后台业务数据与审计
R2           图片和公开数据快照
```

当前优先完成后台数据录入和管理。实时客服、多语言和行业专属功能不在当前范围。

## 1. 语言边界

```text
用户前端：English
后台界面：中文
公开内容：管理员直接录入英文
```

不建立翻译表、语言切换或 `/en`、`/es` 路由。公开站点使用根路径 `/`。

## 2. 单管理员认证

第一版采用单管理员密码模式，不建设账号体系。

Cloudflare Worker 手动绑定两个 Secret：

```text
ADMIN_PASSWORD   后台登录密码
SESSION_SECRET   登录会话签名密钥
```

约束：

- 登录页只输入密码，不输入用户名；
- 密码不得写入 GitHub、`wrangler.jsonc`、D1 或普通明文变量；
- 不建立 `admin_users`、角色、权限和密码哈希表；
- 不建立持久化会话表；
- 登录成功后签发短期、带签名的 Cookie；
- Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Strict`；
- 修改 `ADMIN_PASSWORD` 后旧密码立即失效；
- 修改 `SESSION_SECRET` 后所有现有会话立即失效；
- 登录接口必须限制尝试频率；
- 后台写操作统一记入审计日志，操作者标识为 `single_admin`。

认证接口：

```text
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/auth/session
```

未来确实需要多管理员时，再单独升级为账号和权限系统，第一版不提前增加该复杂度。

## 3. 核心业务模型

```text
Section            分区
Product            产品或服务
ConversionMethod   转化方式
MediaAsset         媒体资源
FAQ                常见问题
SiteSetting        站点设置
AuditLog           操作日志
```

模板不预设按摩、直播、游戏、视频、博彩或其他行业。所有业务名称和内容均由后台录入。

## 4. 分区管理

“分区管理”只负责：

```text
分区名称
分区图标
排序
是否启用
```

建议字段：

```text
sections
├─ id
├─ name
├─ icon_key
├─ sort_order
├─ is_enabled
├─ created_at
├─ updated_at
└─ deleted_at
```

分区创建后，后台自动生成动态菜单：

```text
[分区名称]
├─ 产品管理
└─ 转化方式
```

分区排序同时决定后台动态菜单和前端首页导航顺序。停用分区不进入前端发布数据。

## 5. 分区内产品

产品必须属于一个分区。

```text
products
├─ id
├─ section_id
├─ service_mode          online / offline
├─ title
├─ body
├─ cover_asset_id
├─ address               仅 offline 使用
├─ conversion_method_id
├─ is_featured
├─ featured_order
├─ status
├─ published_at
├─ created_at
├─ updated_at
└─ deleted_at
```

第一版不增加距离、评分、价格、销量、营业时间、复杂门店关系或行业专属字段。

## 6. 分区内转化方式

转化方式属于一个分区，并可被该分区的多个产品复用。

```text
conversion_methods
├─ id
├─ section_id
├─ name
├─ type
├─ button_label
├─ config_json
├─ sort_order
├─ is_enabled
├─ created_at
├─ updated_at
└─ deleted_at
```

产品只能选择本分区已启用的转化方式。

## 7. 前端数据驱动

首页结构：

```text
Location / City
后台动态分区导航
热门产品推荐
Home / Hot / Messages / FAQ
```

不设置 Banner。前端不得写死业务分区或产品内容。

系统入口与业务分区分开：

```text
Hot      查询热门产品
Latest   按发布时间排序
More     展示全部启用分区
```

## 8. 数据管理规则

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

第一版审计表：

```text
audit_logs
├─ id
├─ action
├─ entity_type
├─ entity_id
├─ before_json
├─ after_json
├─ request_id
├─ ip_hash
└─ created_at
```

D1 不保存后台登录密码或会话签名密钥。

## 9. 数据与发布

```text
后台录入 D1
→ 校验完整性
→ 生成不可变公开快照
→ 写入 R2
→ 切换 current.json
→ Storefront 读取新版本
```

Storefront 常规浏览不逐次查询 D1。

## 10. 路由与部署

本仓库只部署一个正式 Cloudflare Worker：

```text
/             English Storefront
/admin/*      中文管理后台
/api/*        业务 API
/go/:code     转化跳转
```

PR 只执行校验；`main` 通过验证后更新唯一正式 Worker。

## 11. 当前开发顺序

```text
1. 配置单管理员 Worker Secrets
2. 创建并绑定 D1
3. 建立 sections 与 audit_logs 初始迁移
4. 实现密码登录和签名 Cookie
5. 实现分区管理 API
6. 实现中文分区管理页面
7. 创建分区后动态菜单立即出现
8. 开发分区内产品和转化方式
9. 开发媒体、热门推荐和 FAQ
10. 开发发布管线和 English Storefront
11. 项目完成后再建设独立客服系统
```
