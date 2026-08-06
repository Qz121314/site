# 业务展示与运营模板

本仓库 `Qz121314/site` 是一个完全由后台数据驱动的业务展示模板。

```text
Storefront   English 用户前端
Admin        中文管理后台
Worker       业务 API、发布和静态资源路由
```

模板不预设按摩、直播、游戏、视频、博彩或任何其他行业。分区、产品、转化方式、热门内容和 FAQ 全部由后台录入。

## 当前范围

当前优先开发中文后台的数据录入和管理：

```text
管理员与权限
→ 分区管理
→ 动态分区菜单
→ 分区内产品管理
→ 分区内转化方式管理
→ 媒体管理
→ 热门推荐与 FAQ
→ 发布管线
→ English Storefront
```

实时在线客服和多语言不在当前开发范围。

## 分区驱动模型

“分区管理”只负责：

```text
分区名称
分区图标
排序
是否启用
```

创建分区后，后台自动生成对应业务菜单：

```text
[分区名称]
├─ 产品管理
└─ 转化方式
```

产品和转化方式都在所属分区内部管理。

## 语言边界

```text
用户前端：English
后台界面：中文
公开内容：管理员直接录入英文
```

当前不建立翻译表，不提供语言切换，不使用 `/en` 或 `/es` 路由。

## 前端结构

首页第一版：

```text
Location / City
后台动态分区导航
热门产品轮播
Home / Hot / Messages / FAQ
```

不设置 Banner 轮播。热门推荐中的每一项必须对应真实产品。

产品公开字段保持通用：

```text
封面图
分区标签
标题
正文
地址（仅线下产品）
```

## 仓库结构

```text
site/
├─ apps/
│  ├─ storefront/       English 用户前端
│  ├─ admin/            中文管理后台
│  └─ worker/           Hono API 和静态资源路由
├─ packages/
├─ migrations/
├─ scripts/
├─ tests/
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

本仓库只维护一个正式 Cloudflare Worker。PR 只执行校验，不创建长期 Preview Worker。

## 管理规则

所有支持删除的列表必须统一实现：

- 行选择；
- 当前页全选；
- 批量删除；
- 删除确认；
- 软删除；
- 回收站恢复；
- 操作审计。

## 文档

- [项目架构基线](docs/architecture.md)
- [开发阶段与交付计划](docs/development-plan.md)

架构和实现发生冲突时，以 `docs/architecture.md` 为准。
