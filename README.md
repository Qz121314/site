# 业务展示与运营模板

本仓库 `Qz121314/site` 是一个完全由后台数据驱动的业务展示模板。

```text
Storefront   English 用户前端
Admin        中文管理后台
Worker       业务 API、认证、发布和静态资源路由
```

模板不预设任何行业。分区、产品、转化方式、热门内容和 FAQ 全部由后台录入。

## 当前开发顺序

```text
Worker Secret 单管理员登录
→ D1 数据库基础
→ 分区管理
→ 动态分区菜单
→ 分区内产品管理
→ 分区内转化方式管理
→ 媒体、热门推荐与 FAQ
→ 发布管线
→ English Storefront
```

实时客服和多语言不在当前范围。

## 单管理员登录

第一版不建立管理员账号和权限体系。后台登录页只输入密码。

Cloudflare Worker 手动绑定：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

密码和会话密钥不写入 GitHub、D1 或 `wrangler.jsonc`。登录成功后使用签名的安全 Cookie 维持短期会话。

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

## 管理规则

所有支持删除的列表统一实现：

- 行选择和当前页全选；
- 批量删除和删除确认；
- 软删除和回收站恢复；
- 操作审计。

## 文档

- [项目架构基线](docs/architecture.md)
- [开发阶段与交付计划](docs/development-plan.md)

架构和实现发生冲突时，以 `docs/architecture.md` 为准。
