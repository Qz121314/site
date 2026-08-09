# 项目架构基线

本项目是一个由中文运营后台驱动的 English 业务展示站点，面向个人运营者和小团队。

```text
Storefront   React English 用户前端
Admin        React 中文运营后台
Worker       Hono API、认证、R2 与 D1 访问
D1           业务数据、主题、媒体元数据和发布状态
R2           图片 / GIF / 视频对象与不可变公开内容版本
```

核心原则是简洁、高效、稳定、易维护。AI、广告池、复杂管理员角色权限和企业审批流不属于当前架构目标。

## 1. Cloudflare 资源

```text
Worker: service-catalog-site
D1:     service-catalog-site-db
R2:     service-catalog-site-assets
```

只维护一套正式资源。部署使用 `keep_vars`，保留 Cloudflare Dashboard 手动绑定的变量。

## 2. 后台信息架构

左侧固定菜单：

```text
站点设置
主题中心
素材中心
客服管理
FAQ 管理
分区管理
```

创建分区后生成动态工作区：

```text
[分区名称]
├─ 产品管理
├─ 分类管理
├─ 标签管理
└─ 转化池
```

不在主导航增加企业级仪表盘、审批流、复杂权限、独立审计中心或独立回收站。热门状态在产品中管理；回收站放在各业务模块内部；审计作为内部能力保留。

## 3. 固定模块边界

### 站点设置

负责站点名称、位置标签、Logo、GA4、R2 自定义媒体域名和前端入口开关。

### 主题中心

主题中心只控制用户前端展示，不复制业务数据模型。

当前预设：

```text
Marketplace
Noir
Live
SaaS
Travel
Tech
```

主题配置由代码中的 preset + D1 中的当前 `theme_key` / 少量 overrides 组成。数据库不保存几十个散乱 CSS 字段。

产品列表和产品封面统一使用 1:1 作为跨主题媒体基准；Hero、Logo、图标、正文图片和视频保留各自合适比例。

`packages/storefront-ui` 是前台展示组件的唯一共享层。Storefront 和后台主题实时预览共同使用其中的 BrandBar、Hero、ProductCard、BottomNavigation 与组件 CSS；主题预览不再维护一套仿制 DOM。数据请求、路由和管理操作仍留在各自应用，避免形成第二套 Storefront Runtime。

### 素材中心

素材中心是全站统一媒体入口，不再只是 R2 图片清理页。

技术类型：

```text
image
animated_image
video
```

用途：

```text
general
product
logo
icon
favicon
hero
background
content
```

用途和技术类型分离。一个媒体资产可以拥有多个用途。

日常管理提供上传、预览、筛选、选择 / 全选、批量删除和复用。原有全桶 R2 扫描作为“存储清理”维护工具保留，并继续执行引用保护和发布快照保护。

### 客服管理

只配置独立客服系统连接。本仓库不开发坐席、会话存储、聊天记录数据库和工单系统；这些能力由后续独立 Git 仓库和独立 Cloudflare 部署负责。当前 Storefront 保留 Messages 界面，Site Worker 保留服务商无关适配边界，并且只从 D1 运行时读取连接配置。

### FAQ 管理

FAQ 是全站公共内容，不属于分区。正文使用安全 Markdown，支持新增、编辑、排序、启停、批量删除和恢复。

### 分区管理

管理分区名称、图标、排序和启停。分区创建后立即生成动态业务工作区。

## 4. 分区业务边界

### 产品管理

产品必须属于一个分区，并可选择本分区分类、标签和转化分组。

产品正文使用 Markdown。产品结构化媒体最多 12 个，支持静态图片、GIF 和视频；发布产品至少需要一个媒体，并至少保留一张图片或 GIF 作为封面候选。视频不直接作为产品封面。

### 分类管理

分类只属于一个分区，不跨分区共享。

### 标签管理

标签只属于一个分区，不跨分区共享。单产品标签数量有明确上限。

### 转化池

转化池只属于一个分区。产品不能引用其他分区的转化分组或目标。

## 5. 数据模型

核心表 / 关系：

```text
site_settings                 站点配置、媒体域名和当前主题
sections                      分区
categories                    分区内分类
product_tags                  分区内标签
products                      分区内产品与 Markdown 正文
product_tag_links             产品标签关系
conversion_groups             分区内转化分组
conversion_targets            转化目标
customer_service_connections  外部客服连接
media_assets                  R2 媒体元数据
media_asset_roles             媒体用途多对多关系
product_media                 产品结构化媒体关系
faqs                          全站 FAQ / Markdown
audit_logs                    内部审计
idempotency_keys              批量写入防重
publish_module_jobs           模块发布任务
publish_module_versions       模块不可变发布版本
```

所有分区业务必须通过 `section_id` 隔离。跨分区引用由 API 校验和数据库约束共同保护。

## 6. R2 访问模型

```text
ASSETS_BUCKET Worker Binding
→ 写入、删除、读取和扫描媒体对象

R2 Custom Domain
→ 用户前端公开读取图片、GIF 和视频
```

数据库只保存对象 Key。公开媒体 URL 统一生成：

```text
{media_base_url}/{object_key}
```

生产环境不使用 `r2.dev`。

普通短视频可直接使用 R2 + Custom Domain。只有未来出现真正直播、长视频、多码率转码和 HLS/DASH 等明确需求时，再评估 Cloudflare Stream；当前不提前引入。

## 7. Markdown 安全边界

产品和 FAQ 正文共用受控 Markdown 解析器。

支持：

```text
标题 / 段落 / 列表 / 引用
粗体 / 斜体 / 删除线
链接 / 代码 / 分割线
Markdown 图片
```

不解析任意 HTML。图片只接受站内路径或 HTTP / HTTPS 地址，链接只接受受控协议，避免把富文本编辑能力变成脚本注入入口。

视频优先作为结构化媒体资产展示；若未来增加正文视频块，应使用受控组件语法，不开放原始 HTML。

## 8. 认证

后台采用单管理员绑定值：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

登录使用签名安全 Cookie，并保留登录限速、会话校验和写操作审计。默认不增加多管理员、组织和 RBAC。

## 9. 删除与媒体保护

所有普通可删除业务模块统一支持选择、当前结果全选、批量删除、确认、软删除、恢复和审计。

媒体删除必须在服务端再次检查实际引用。产品封面、产品媒体、站点 Logo、分区图标和仍受发布快照保护的媒体不能被物理删除。

R2 “存储清理”继续作为底层维护能力，用于识别历史孤立图片对象，不代替日常素材中心。

## 10. 发布模型

站点设置、分区导航、FAQ 和各业务分区使用模块化发布版本；R2 保存不可变公开内容，D1 保存当前指针、历史版本和任务状态。

主题配置当前由主题中心保存后直接供 Storefront 读取；主题只改变展示 token，不改变业务数据。若未来需要主题自身参与版本回滚，再将主题设置纳入站点发布快照，不为当前需求增加第二套主题版本系统。

## 11. 继续优化原则

后续优先级：

```text
稳定性与回归测试
发布前质量闸门
素材与主题实际使用体验
UI 一致性
维护成本
```

除非真实数据规模或运营流程证明有必要，否则不提前增加企业级权限、复杂工作流、大型分析仪表盘、服务器分页体系或多环境资源。
