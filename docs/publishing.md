# 前台 R2 快照发布

前台公开内容采用手动发布的不可变 R2 快照，不在普通页面访问时通过 Worker 动态读取 D1。

## 角色边界

```text
D1
→ 后台编辑态数据源

R2 public/versions/*
→ 前台已发布数据源

public/current.json
→ 当前线上版本指针

Worker
→ 后台 CRUD、手动发布、图片写入/清理，以及需要动态处理的转化跳转
```

后台的保存动作只修改 D1，不自动改变用户前台。管理员完成一批内容修改后，在后台顶部点击“发布前台”生成新的完整快照。

## 手动发布流程

```text
管理员点击“发布前台”
→ 校验 R2 自定义域名
→ 读取当前 D1 公开态数据
→ 校验已发布产品的分类、转化分组、启用入口和图片
→ 计算 source revision
→ 创建唯一 content version
→ 写入 public/versions/{contentVersion}/...
→ 写入 manifest.json
→ 所有不可变对象成功
→ 记录 publish_versions
→ 最后更新 public/current.json
→ 标记 publish_job published
→ 自动执行发布历史保留清理
```

任何校验或对象写入失败，都不得把 `public/current.json` 切换到新版本。最终状态写回 D1 失败时，发布器会尽量恢复旧指针。

## 对象结构

```text
public/
├─ current.json
└─ versions/
   └─ {contentVersion}/
      ├─ manifest.json
      ├─ site.json
      ├─ home.json
      ├─ faq.json
      ├─ sections/{sectionId}.json
      └─ products/{productId}.json
```

版本目录一经生成不得覆盖。后续修改必须生成新的 `contentVersion`。

## Storefront 读取流程

Storefront 使用固定的 R2 Custom Domain 作为内容源。构建时通过 GitHub Actions Repository Variable 配置：

```text
PUBLIC_CONTENT_ORIGIN=https://content.example.com
```

CI / Deploy 会把它映射成 Vite 的：

```text
VITE_PUBLIC_CONTENT_ORIGIN
```

浏览器读取顺序固定为：

```text
R2 Custom Domain
→ GET /public/current.json
→ 取得 contentVersion
→ GET /public/versions/{contentVersion}/site.json
→ GET /public/versions/{contentVersion}/home.json
→ 按页面读取 sections/{id}.json / products/{id}.json / faq.json
```

`current.json` 使用 revalidate；版本文件使用 immutable cache。Storefront 不通过普通 Worker 内容 API 读取 D1。

R2 Custom Domain 与 Storefront 如果不是同源，R2 Bucket CORS 必须允许 Storefront 的生产 Origin 发起 `GET` / `HEAD` 请求。不要使用 `*` 配合未来可能出现的 credential 请求；当前公开快照请求本身不携带 credentials。

开发环境未设置 `VITE_PUBLIC_CONTENT_ORIGIN` 时，Storefront 允许 localhost 同源读取，方便本地联调；生产环境缺少该变量时会显示明确的未配置状态，而不是自动回退到 Worker/D1。

## 前台路由

Storefront 使用浏览器 History 路由：

```text
/
/sections/{sectionId}/
/products/{productId}/
```

Cloudflare Static Assets 使用 `not_found_handling = "single-page-application"`，并继续通过 `run_worker_first` 只让 `/api/*`、`/go/*` 进入 Worker。普通前台深链接由静态 `index.html` 接管。

## 公开 / 私有数据边界

R2 快照只允许包含前台展示所需的公开 DTO。

允许公开：

```text
站点名称 / Location
Logo 与媒体公开 URL
导航开关
GA4 Measurement ID / Facebook Pixel ID
Affiliate 启用状态与平台名称
分区 / 分类 / 标签 / 产品 / FAQ
产品 CTA 文案、模式、/go/{productId}
```

不得进入 R2：

```text
客服 API Token / Secret
客服系统 private base URL / project private config
客服连接原始配置 JSON
Affiliate 原始配置 JSON
转化池最终 URL / 远程客服私有路由细节
后台审计信息
```

客服连接和最终转化目标始终由 Worker + D1 在 `/go/:code` 请求时动态解析。

## 发布历史保留

所有发布更新历史统一采用最近 3 次保留策略：

```text
最近第 1 次发布  保留
最近第 2 次发布  保留
最近第 3 次发布  保留
第 4 次及更早   自动清理
```

自动清理范围：

```text
R2 public/versions/{contentVersion}/... 快照对象
D1 publish_versions 发布版本记录
D1 publish_jobs 对应的发布更新记录
失败发布留下、但没有成为正式版本的 R2 孤立对象
```

`public/current.json` 永远只指向当前版本，不计入 3 次历史。清理不得删除当前版本；发布失败也不能因为清理动作影响已经在线的当前版本。

操作审计 `audit_logs` 属于安全审计数据，不按发布版本保留规则删除。

## 缓存

版本文件：

```text
Cache-Control: public, max-age=31536000, immutable
```

当前版本指针：

```text
Cache-Control: public, max-age=30, must-revalidate
```

## 转化数据

R2 快照不暴露转化池中的最终目标地址。产品快照只保存 CTA 文案、模式和动态 `/go/:code` 路径。最终入口轮换和转化事件记录继续由 Worker 动态处理。

## 后台交互

后台不建立独立“发布中心”主菜单。全局顶部固定提供：

```text
最近发布状态
发布前台
```

发布始终针对整个前台状态，而不是只发布当前页面或当前分区，避免用户看到不同版本的数据组合。
