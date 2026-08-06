# 数据存储基线

本文档定义本项目第一版正式 D1 与 R2 结构。代码、数据库和对象存储必须遵循同一套边界。

## 1. 正式资源

```text
D1 database: service-catalog-site-db
D1 binding:  DB

R2 bucket:   service-catalog-site-assets
R2 binding:  ASSETS_BUCKET
```

当前项目只有一个正式环境，不建立 Preview 或 Production 后缀资源。

## 2. D1 设计原则

- 第一版完整 Schema 由 `migrations/0001_initial_schema.sql` 创建；
- 所有业务主键使用 Worker 生成的 UUID 字符串；
- 所有时间统一保存为 UTC ISO 8601 字符串；
- 分区、产品、转化方式、媒体和 FAQ 使用软删除；
- 关联数据通过外键限制，禁止形成跨分区或悬空引用；
- 删除、恢复、启停和排序等写操作必须记录 `audit_logs`；
- 批量写操作使用 `idempotency_keys` 防止重复提交；
- 后台密码和会话签名值不进入 D1，由 Cloudflare Worker 普通变量或 Secret 提供；
- 认证绑定不限制字符长度，部署通过 `keep_vars` 保留 Dashboard 手动配置。

## 3. 表结构边界

```text
media_assets          R2 对象元数据，仅保存 object_key
sections              后台动态业务分区
conversion_methods    分区内转化方式
products              分区内产品或服务
product_media         产品图片顺序和关联
faqs                   FAQ 内容
site_settings          单例站点设置与媒体公开域名
publish_jobs           发布任务状态
publish_versions       已发布 R2 版本
conversion_events      转化点击与提交事件
audit_logs             不可变后台操作审计
idempotency_keys       防重复写入记录
```

`products` 使用组合外键约束 `section_id + conversion_method_id`，确保产品不能引用其他分区的转化方式。

## 4. R2 访问模型

R2 使用两条明确分离的访问通道：

```text
ASSETS_BUCKET Worker Binding
→ 后台上传、确认、删除和校验对象

R2 Custom Domain
→ 前端和公开内容读取图片
```

管理员需要在 Cloudflare R2 Bucket 设置中手动连接自定义域名，例如：

```text
https://assets.example.com
```

然后在后台“站点设置”中录入同一个地址。数据库字段为：

```text
site_settings.media_base_url
```

保存规则：

- 必须是 `https://`；
- 只保存 Origin，不允许路径、查询参数或片段；
- 末尾不保存 `/`；
- 初始值允许为空；
- 发布包含图片的公开内容前必须已经配置并验证；
- 生产环境不使用 `r2.dev` 生成图片链接。

图片 URL 统一通过一个 URL Builder 生成：

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
- 在产品、分区或 FAQ 数据中重复保存图片域名；
- 在前端组件中散落字符串拼接；
- 使用 Cloudflare Dashboard 内部对象地址；
- 使用 `r2.dev` 作为生产图片域名。

更换自定义域名时，只更新 `site_settings.media_base_url`，所有图片链接随之切换，不需要批量修改媒体记录。

## 5. R2 对象 Key 规范

```text
media/
└─ {asset_id}/
   ├─ original/{safe_filename}
   └─ variants/{variant}.{extension}

public/
├─ current.json
└─ versions/
   └─ {content_version}/
      ├─ manifest.json
      ├─ home.json
      ├─ sections/{section_id}.json
      ├─ products/{product_id}.json
      └─ faq.json
```

规则：

- 数据库只保存 `object_key`；
- `{asset_id}` 使用数据库中的媒体 UUID；
- 文件名必须清理路径分隔符和控制字符；
- 公开版本目录不可覆盖；
- 只有所有版本文件上传并验证完成后，才更新 `public/current.json`；
- 产品封面优先使用 `cover_asset_id`，未设置时使用 `product_media.sort_order` 最小的图片；
- 未确认、失败或无引用媒体进入延迟清理，不在请求链路中立即物理删除；
- 上传公开媒体时设置长期缓存头，文件内容变化必须使用新的对象 Key；
- R2 Custom Domain 只负责公开读取，写入和删除始终通过 Worker Binding。

## 6. 后台站点设置

第一版站点设置至少包含：

```text
站点名称
位置文案
R2 自定义域名
Logo
首页分区数量
Hot / Latest / More / Messages / FAQ 开关
```

“R2 自定义域名”保存前由 Worker 规范化并验证。后台应提供连接状态提示和测试功能，但不会自动替管理员修改 Cloudflare DNS 或 R2 Custom Domain 配置。

## 7. 迁移和部署

Pull Request 校验：

```text
应用全部 D1 migration 到全新的本地 D1
→ 执行类型检查、测试和构建
→ 执行 Worker dry-run
```

`main` 部署：

```text
构建
→ 对正式 D1 应用尚未执行的 migration
→ 使用 keep_vars 部署唯一正式 Worker
→ 执行生产烟雾测试
```

不得在 Cloudflare Dashboard 中手工修改表结构。所有结构变化必须通过版本化 SQL migration 进入 GitHub。
