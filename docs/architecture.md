# 项目架构基线

本文档是当前项目的强制架构边界。实现与本文冲突时，应先修正文档和迁移方案，不能在代码中形成第二套隐含架构。

## 1. 当前项目范围

本仓库 `Qz121314/site` 是一个可重复部署的业务展示与运营模板，包含：

```text
Storefront   英文用户前端
Admin        中文管理后台
Worker       业务 API、发布和静态资源路由
D1           后台主业务数据
R2           图片和公开数据快照
```

当前只开发后台数据录入、数据管理、发布和用户展示能力。

实时在线客服属于未来独立项目，不在当前阶段开发，也不在当前数据库中建立客服账号、客服分组、会话或消息模型。

## 2. 语言边界

当前版本不做多语言。

```text
用户前端：English
管理后台：中文操作界面
公开内容：单一英文内容
```

后台字段标签和操作提示使用中文，但分区名称、产品标题、产品正文、按钮文案等公开内容由管理员直接录入英文。

禁止建立翻译表、locale 路由、语言切换和 `/en`、`/es` 双路径。公开站点使用根路径 `/`。

## 3. 核心业务模型

第一版只保留以下核心实体：

```text
Section            分区
Product            产品或服务
ConversionMethod   转化方式
MediaAsset         媒体资源
FAQ                常见问题
SiteSetting        站点设置
AdminUser          后台管理员
AuditLog           操作日志
```

不预设按摩、直播、游戏、视频、博彩或任何其他行业。所有业务名称和内容均由后台录入。

## 4. 分区模型

### 4.1 分区管理的唯一职责

“分区管理”只负责新增和维护分区，不直接管理产品。

管理员新增分区时仅配置：

```text
分区名称
分区图标
排序
是否启用
```

内部字段：

```text
id
name
icon_key / icon_asset_id
sort_order
is_enabled
created_at
updated_at
deleted_at
```

分区名称是公开前端显示名称，应录入英文。后台可以用中文字段说明提示管理员填写。

### 4.2 动态后台菜单

分区创建后，后台自动生成一个对应的业务菜单。

示例：

```text
分区管理中创建：Massage

后台导航自动生成：
Massage
├─ 产品管理
└─ 转化方式
```

后台固定菜单与动态菜单结构：

```text
仪表盘
分区管理

动态分区菜单
├─ [分区 A]
│  ├─ 产品管理
│  └─ 转化方式
├─ [分区 B]
│  ├─ 产品管理
│  └─ 转化方式
└─ ...

媒体管理
热门推荐
FAQ 管理
发布管理
系统设置
回收站
操作日志
```

分区排序决定后台动态菜单和前端分区导航顺序。

分区禁用后：

- 仍可在“分区管理”中查看和重新启用；
- 不显示在前端分区导航；
- 不允许继续公开发布该分区的新内容；
- 后台动态业务菜单默认隐藏，或在管理员选择“显示停用分区”时查看。

## 5. 分区内产品管理

产品必须属于一个分区。

第一版产品通用字段：

```text
所属分区
服务形式：online / offline
产品标题
产品正文
封面图
产品图片
地址（仅 offline 可填写）
转化方式
是否热门
热门排序
状态
发布时间
```

建议数据结构：

```text
products
├─ id
├─ section_id
├─ service_mode
├─ title
├─ body
├─ cover_asset_id
├─ address
├─ conversion_method_id
├─ is_featured
├─ featured_order
├─ status
├─ published_at
├─ created_at
├─ updated_at
└─ deleted_at
```

产品不包含行业专属字段。模板不能写死按摩师、主播、游戏服务器、赔率等业务字段。

线下产品仅比线上产品多一个可选地址字段。当前不需要距离、评分、价格、销量、营业状态或复杂门店关系。

## 6. 分区内转化方式

每个分区拥有自己的转化方式列表。

管理员点击某个分区菜单中的“转化方式”，可以新增、编辑、启用、停用和删除该分区可用的转化方式。

基础字段：

```text
转化方式名称
类型
按钮文案
目标配置
排序
是否启用
```

建议数据结构：

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

第一版每个产品选择一个主要转化方式。后期确有需要时再扩展为多转化方式。

转化方式属于分区并可被该分区内多个产品复用，避免每个产品重复录入相同配置。

## 7. 前端数据驱动原则

用户前端不能写死任何业务分区或产品内容。

首页分区导航来源：

```text
后台已启用分区
→ 按 sort_order 排序
→ 生成前端分区导航
→ 超出首页显示数量时进入 More
```

“Hot”“Latest”“More”属于系统功能入口，不是业务分区：

```text
Hot      查询 is_featured = true 的产品
Latest   按 published_at 倒序
More     展示全部已启用分区
```

首页第一版结构：

```text
顶部：Location / City
分区导航：后台动态生成
热门推荐：后台标记为热门的产品轮播
底部导航：Home / Hot / Messages / FAQ
```

当前不设置 Banner 轮播。热门推荐中的每一项必须对应一个真实产品。

产品公开展示保持简单：

```text
封面图
分区标签
标题
正文摘要或正文截断
地址（仅线下产品）
```

## 8. 后台数据管理规则

所有支持删除的管理页面必须统一具备：

```text
行选择
当前页全选
批量删除
删除确认
软删除
回收站恢复
操作审计
```

分区、产品、转化方式、媒体和 FAQ 均使用软删除。

删除分区前必须检查其产品和转化方式：

- 有关联数据时禁止直接物理删除；
- 可停用分区；
- 可先迁移或删除关联数据；
- 最终清理必须记录审计日志。

## 9. 数据与发布边界

D1 保存后台草稿、状态、关系、权限和审计。

R2 保存图片和版本化公开快照。

```text
后台录入
→ 审核数据完整性
→ 生成不可变公开快照
→ 验证文件和哈希
→ 切换 current.json
→ Storefront 读取新版本
```

Storefront 常规浏览不逐次查询 D1。

公开快照至少包含：

```text
site
sections
products
conversion presentation data
featured products
faqs
media references
```

## 10. 路由与部署

本仓库只部署一个正式 Cloudflare Worker。

```text
/             English Storefront
/admin/*      中文管理后台
/api/*        业务 API
/go/:code     转化跳转
```

Storefront 与 Admin 分别构建，不能编译成同一个前端 Bundle。

Storefront 的缓存和 Service Worker 不得控制 `/admin`、`/api` 和 `/go`。

PR 只执行校验，不部署长期 Preview Worker；`main` 通过验证后更新唯一正式 Worker。

## 11. 当前开发顺序

```text
1. 确定用户前端 UI 与用户路径
2. 固定 Section、Product、ConversionMethod 数据结构
3. 管理员登录、权限与审计
4. 分区管理
5. 动态后台菜单
6. 分区内产品管理
7. 分区内转化方式管理
8. 媒体管理
9. 热门推荐和 FAQ 管理
10. 发布管线和公开快照
11. English Storefront
12. 项目完成后再单独设计实时客服平台
```

当前阶段禁止提前开发客服系统、多语言、复杂门店、距离计算和行业专属字段。
