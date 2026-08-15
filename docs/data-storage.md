# 数据存储基线

本文档定义正式 D1 与 R2 的数据边界。代码、数据库和对象存储必须遵循同一套规则。

## 1. 正式资源

```text
D1 database: service-catalog-site-db
D1 binding:  DB

R2 bucket:   service-catalog-site-assets
R2 binding:  ASSETS_BUCKET
```

当前项目只有一个正式环境，不建立 Preview 或 Production 后缀资源。

## 2. D1 设计原则

- 初始完整 Schema 由 `migrations/0001_initial_schema.sql` 创建，后续结构变化全部使用递增 migration；
- 所有业务主键使用 Worker 生成的 UUID 字符串；
- 所有时间统一保存为 UTC ISO 8601 字符串；
- 分区、产品、媒体和 FAQ 等可恢复业务实体采用软删除；
- 关联数据通过外键和服务端校验保护，禁止跨分区或悬空引用；
- 删除、恢复、启停、排序和关键配置写操作进入 `audit_logs`；
- 批量写操作使用 `idempotency_keys` 防止重复提交；
- 后台密码和会话签名值不进入 D1，由 Cloudflare Worker 变量或 Secret 提供；
- `ADMIN_PASSWORD` 与 `SESSION_SECRET` 只要求使用 Worker Secret 配置且不是空值，不限制长度或复杂度，并由 `keep_vars` 在部署时保留。

## 3. 核心表结构边界

```text
site_settings                 单例站点配置、媒体域名、当前主题
sections                      后台动态业务分区
categories                    分区内分类
product_tags                  分区内标签
product_tag_links             产品标签关系
products                      分区内产品 / Markdown 正文
conversion_groups             分区内转化分组
conversion_targets            转化目标
customer_service_connections  外部客服连接
media_assets                  R2 媒体对象元数据
media_asset_roles             媒体用途多对多关系
product_media                 产品结构化媒体顺序和关联
faqs                          Markdown FAQ
publish_module_jobs           模块发布任务
publish_module_versions       模块发布版本
conversion_events             /go 分发事件账本（请求幂等、自然日归档）
audit_logs                    后台操作审计
idempotency_keys              防重复写入记录
```

产品与分类、标签、转化分组等分区关系必须保持相同 `section_id`。

## 4. 主题存储

主题完整 preset 定义保存在代码中，D1 只保存站点当前选择和少量覆盖值：

```text
site_settings.theme_key
site_settings.theme_overrides_json
```

允许的主题：

```text
marketplace
noir
live
saas
travel
tech
```

不为主题创建大量独立颜色、圆角、阴影字段。新增主题展示 token 优先在代码 preset 中演进，只有运营人员需要自行调整的少量值才进入 overrides JSON。

产品列表的媒体比例由主题运行时统一使用 1:1 基线，但比例规则本身不写入每条产品或媒体记录。

## 5. 通用媒体模型

`media_assets` 表保存文件事实，不保存业务用途：

```text
id
object_key
file_name
mime_type
byte_size
media_kind
width
height
duration_ms
content_hash
status
created_at
updated_at
deleted_at
```

`media_kind`：

```text
image
animated_image
video
```

当前上传格式：

```text
image/jpeg
image/png
image/webp
image/gif
video/mp4
video/webm
```

`media_asset_roles` 单独保存用途，一个媒体可以具有多个用途：

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

技术类型和用途不得混为同一个字段。例如 `image/png` 可以同时拥有 `logo` 和 `content` 用途；GIF 的技术类型为 `animated_image`，但可以作为 `product` 或 `content`。

图片 / GIF 默认上传上限 20 MB，视频默认上限 60 MB。静态产品图片可先在浏览器压缩；GIF 保留原动画；视频不做浏览器转码。

## 6. 产品媒体模型

`product_media` 负责产品与 `media_assets` 的结构化关联和顺序。产品最多 12 个媒体，可混合：

```text
静态图片
GIF
MP4 / WebM 视频
```

产品卡片和列表封面只使用图片或 GIF。视频不能作为显式产品封面。

保存产品时，如果没有有效显式封面，后台应选择排序最前的封面候选图片 / GIF 作为 `cover_asset_id`，避免第一项是视频时出现无效封面。

产品详情媒体按 `product_media.sort_order` 输出；Storefront 根据媒体 URL / 类型使用 `<img>` 或 `<video>` 渲染。

## 7. R2 访问模型

R2 使用两条明确分离的访问通道：

```text
ASSETS_BUCKET Worker Binding
→ 后台上传、读取、删除和校验对象

R2 Custom Domain
→ Storefront 公开读取图片、GIF 和普通视频
```

管理员在 Cloudflare R2 Bucket 设置中连接自定义域名，例如：

```text
https://assets.example.com
```

后台“站点设置”保存同一个 Origin：

```text
site_settings.media_base_url
```

这是 R2 公开域名的唯一权威来源。Storefront 通过运行时接口读取，GitHub Actions 只校验它是否绑定到当前 Bucket，不会自动选择域名、写回 D1 或注入前端构建变量。

该域名只负责媒体公开读取。发布 JSON 固定由站点 Worker 的 `/public/*` 通过 `ASSETS_BUCKET` Binding 读取，不与 `media_base_url` 共用 Origin。

保存规则：

- 必须是 `https://`；
- 只保存 Origin，不允许路径、查询参数或片段；
- 末尾不保存 `/`；
- 初始值允许为空；
- 更换域名只修改该字段，不修改对象 Key 和历史发布快照；
- 发布包含媒体的公开内容前必须已经配置并验证；
- 生产环境不使用 `r2.dev`。

媒体 URL 统一通过 URL Builder 生成：

```text
{media_base_url}/{object_key}
```

例如：

```text
object_key:      media/01H.../original/cover.webp
media_base_url:  https://assets.example.com
public_url:      https://assets.example.com/media/01H.../original/cover.webp
```

禁止：

- 在 `media_assets` 中保存完整公开 URL；
- 在产品、分区、站点设置引用字段中重复保存媒体域名；
- 在前端业务组件中散落 URL 字符串拼接；
- 使用 Cloudflare Dashboard 内部对象地址；
- 使用 `r2.dev` 作为生产媒体域名。

## 8. R2 对象 Key 规范

```text
media/
└─ {asset_id}/
   └─ original/{safe_filename}.{extension}

public/
├─ current.json
└─ modules/
   └─ ...不可变模块发布版本
```

规则：

- 数据库只保存 `object_key`；
- `{asset_id}` 使用媒体 UUID；
- 文件名必须清理路径分隔符、控制字符和危险字符；
- 对象 Key 中扩展名只写一次，由验证后的 MIME 类型决定；
- 上传公开媒体时设置长期 immutable 缓存头；
- 内容变化创建新对象 Key，不覆盖旧发布快照依赖的媒体；
- R2 Custom Domain 只负责公开读取，写入和删除始终通过 Worker Binding。

## 9. Markdown 媒体边界

产品和 FAQ 源正文保存在 D1 Markdown 字段中。

解析器不允许任意 HTML。Markdown 图片只接受站内路径或 HTTP / HTTPS URL；`javascript:`、`data:` 等协议不会被渲染为图片。

结构化视频不通过 Markdown HTML 注入，优先存入 `media_assets + product_media` 并由 Storefront 的受控视频组件渲染。

如果以后增加“从素材中心插入正文媒体”的直接引用能力，应同时建立 D1 可追踪引用或发布期解析机制，使素材删除保护可以识别正文引用；在没有引用保护前，不应把一次性复制 URL 当成完整的媒体引用模型。

## 10. 素材删除与清理

日常“素材中心删除”和底层“存储清理”是两套不同用途：

### 素材中心删除

服务端删除前重新检查：

```text
站点 Logo 引用
分区图标引用
产品封面引用
product_media 引用
发布快照媒体保护
```

任何检查不通过都必须停止物理删除。R2 删除失败时数据库状态回滚。

### 存储清理

存储清理扫描 R2 历史图片对象，主要处理旧版本遗留或没有完整 D1 元数据的孤立图片。删除前继续检查 D1 引用和最近发布快照保护。

## 11. 后台站点设置

站点设置包含：

```text
站点名称
位置文案
R2 自定义媒体域名
Logo
首页分区数量
Hot / Latest / More / FAQ 开关
当前主题由主题中心维护
```

媒体域名保存前由 Worker 规范化并验证。后台可以测试连接，但不会自动修改 Cloudflare DNS 或 R2 Custom Domain。

## 12. 视频策略

当前普通短视频使用 R2 + Custom Domain，避免为个人 / 小团队默认引入额外视频平台复杂度。

只有未来真实出现以下需求时再评估 Cloudflare Stream：

```text
直播
长视频
自动转码
多清晰度
HLS / DASH
大规模视频播放优化
```

## 13. 迁移和部署

Pull Request 校验：

```text
应用全部 D1 migration 到全新的本地 D1
→ lint
→ format
→ typecheck
→ test
→ build
→ Worker dry-run / bundle validation
```

`main` 部署：

```text
验证通过
→ 记录正式 D1 Time Travel 恢复点
→ 构建
→ 对正式 D1 应用尚未执行的 migration
→ 使用 keep_vars 部署唯一正式 Worker
→ 生产烟雾测试（含公开 JSON 与已登记媒体同源 fallback）
```

不得在 Cloudflare Dashboard 中手工修改表结构。所有结构变化必须通过版本化 SQL migration 进入 GitHub。

恢复与回滚步骤见 [生产发布与恢复手册](operations.md)。
