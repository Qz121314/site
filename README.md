# 业务展示与运营模板

本仓库 `Qz121314/site` 是一个完全由后台数据驱动的业务展示模板。

```text
Storefront   English 用户前端
Admin        中文管理后台
Worker       业务 API、认证、发布和静态资源路由
D1           业务数据、状态、审计和发布记录
R2           图片与不可变公开内容版本
```

模板不预设任何行业。分区、产品、转化方式、热门内容和 FAQ 全部由后台录入。

## 当前开发顺序

```text
D1 / R2 正式数据基线
→ Worker Secret 单管理员登录
→ 分区管理
→ 动态分区菜单
→ 分区内产品管理
→ 分区内转化方式管理
→ 媒体、热门推荐与 FAQ
→ 发布管线
→ English Storefront
```

实时客服和多语言不在当前范围。

## Cloudflare 正式资源

```text
Worker: service-catalog-site
D1:     service-catalog-site-db
R2:     service-catalog-site-assets
```

当前项目只有一个正式环境，不建立 Preview 或 Production 后缀资源。

## 单管理员登录

第一版不建立管理员账号和权限体系。后台登录页只输入密码。

Cloudflare Worker 手动绑定：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

密码和会话密钥不写入 GitHub、D1 或 `wrangler.jsonc`。登录成功后使用签名安全 Cookie 维持短期会话。

## 分区驱动模型

“分区管理”只负责：

```text
分区名称
分区图标
排序
是否启用
```

创建分区后，后台自动生成：

```text
[分区名称]
├─ 产品管理
└─ 转化方式
```

## 语言边界

```text
用户前端：English
后台界面：中文
公开内容：管理员直接录入英文
```

不建立翻译表、语言切换或 `/en`、`/es` 路由。

## 前端结构

```text
Location / City
后台动态分区导航
热门产品推荐
Home / Hot / Messages / FAQ
```

不设置 Banner。产品公开字段保持通用：封面图、分区标签、标题、正文和可选地址。

## 仓库结构

```text
site/
├─ apps/
│  ├─ storefront/
│  ├─ admin/
│  └─ worker/
├─ packages/
├─ migrations/
├─ scripts/
├─ docs/
├─ wrangler.jsonc
└─ package.json
```

Storefront、Admin 和 Worker 分别构建，但共同部署为一个业务平台。

## 路由

```text
/             English Storefront
/admin/*      中文管理后台
/api/*        业务 API
/go/:code     转化跳转
```

本仓库只维护一个正式 Cloudflare Worker。

## 数据库规则

- 表结构只能通过 `migrations/*.sql` 修改；
- PR 必须在全新的本地 D1 上完整执行所有 migration；
- `main` 部署前自动应用尚未执行的正式 D1 migration；
- 不允许在 Cloudflare Dashboard 中手工改表；
- 所有业务关系由外键和数据库约束保护；
- 所有可删除业务实体使用软删除与操作审计。

## 文档

- [项目架构基线](docs/architecture.md)
- [D1 与 R2 数据存储基线](docs/data-storage.md)
- [开发阶段与交付计划](docs/development-plan.md)

架构和实现发生冲突时，以 `docs/architecture.md` 和 `docs/data-storage.md` 为准。
