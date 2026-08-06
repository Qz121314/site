# 项目架构基线

本项目是一个由中文运营后台驱动的 English 业务展示站点。

```text
Storefront   React English 用户前端
Admin        React 中文运营后台
Worker       Hono API、认证、R2 与 D1 访问
D1           业务数据和配置
R2           图片对象
```

## 1. Cloudflare 资源

```text
Worker: service-catalog-site
D1:     service-catalog-site-db
R2:     service-catalog-site-assets
```

只维护一套正式资源。部署使用 `keep_vars`，保留 Cloudflare Dashboard 手动绑定的变量。

## 2. 后台信息架构

左侧固定菜单只有：

```text
站点设置
素材库管理
客服管理
FAQ 管理
分区管理
```

创建分区后生成动态菜单：

```text
[分区名称]
├─ 产品录入
├─ 分类管理
└─ 转化池
```

不在主导航展示仪表盘、热门推荐、发布管理、审计日志或独立回收站。热门状态在产品录入中管理；回收站放在各业务模块内部；审计作为内部能力保留。

## 3. 固定模块边界

### 站点设置

```text
站点名称
Logo
GA4 Measurement ID
Facebook Pixel ID
联盟平台检测
R2 自定义域名
前端入口开关
```

Logo 由站点设置从 R2 已有对象中选择。素材库不负责上传。

### 素材库管理

素材库只做：

```text
扫描 R2
对比 D1 引用
识别未使用对象
选择 / 全选 / 批量清理
```

素材库禁止提供上传入口。图片上传发生在产品录入或站点设置等实际使用场景。

### 客服管理

只配置外部客服系统：

```text
启用状态
提供商
系统地址
项目 ID / App ID
扩展配置
```

本项目不开发坐席、会话、聊天记录和工单。

### FAQ 管理

FAQ 是全站公共内容，不属于分区。支持新增、编辑、排序、启停、批量删除和恢复。

### 分区管理

只管理分区名称、图标、排序和启停。分区创建后立即生成动态业务菜单。

## 4. 分区业务边界

### 产品录入

产品必须属于一个分区，并可选择本分区分类和本分区转化池项目。

### 分类管理

分类只属于一个分区。不同分区之间不能共享分类。

### 转化池

转化池只属于一个分区，支持 URL、电话、邮箱和自定义转化配置。产品不能引用其他分区的转化项。

## 5. 数据模型

核心表：

```text
site_settings                 站点、统计代码、联盟检测和 R2 域名
customer_service_settings     外部客服系统配置
sections                      分区
categories                    分区内分类
products                      分区内产品
conversion_methods            分区内转化池
media_assets                  R2 对象元数据
product_media                 产品图片关联
faqs                          全站 FAQ
audit_logs                    内部审计
idempotency_keys              批量写入防重
```

所有分区业务必须通过 `section_id` 隔离。产品分类关系由数据库触发器阻止跨分区引用。

## 6. R2 访问模型

```text
ASSETS_BUCKET Worker Binding
→ 写入、删除和扫描对象

R2 Custom Domain
→ 用户前端公开读取图片
```

数据库只保存对象 Key。公开图片 URL 统一生成：

```text
{media_base_url}/{object_key}
```

生产环境不使用 `r2.dev`。

## 7. 认证

后台采用单管理员绑定值：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

两项可以是普通变量或 Secret，不限制字符长度。登录使用签名 Cookie，写操作进入审计日志。

## 8. 删除规则

所有可删除模块统一支持：

```text
选择
当前页全选
批量删除
确认
软删除
恢复
审计
```

素材库清理 R2 对象属于物理删除，必须在删除前重新确认对象没有 D1 引用。

## 9. 开发顺序

```text
1. 后台信息架构与设置模型
2. 素材库 R2 扫描清理
3. FAQ 管理
4. 分区内分类管理
5. 分区内转化池
6. 分区内产品录入
7. Logo 选择与业务图片上传
8. English Storefront
```
