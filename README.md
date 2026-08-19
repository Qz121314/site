# 业务展示与运营平台

`Qz121314/site` 是一个面向个人运营者和小团队的流量展示、分发与转化平台。客服系统是流量接待端，Site 负责记录流量从产品入口到接收方的每一次分发结果。

```text
Storefront   English 用户前端，Mobile-first
Admin        中文运营后台
Worker       Hono API、认证、上传、转化、发布与静态资源路由
D1           业务数据、主题、媒体元数据、状态、审计与发布记录
R2           图片 / GIF / 视频素材与不可变公开内容版本
```

项目不预设具体行业。分区、产品、分类、标签、转化方式、主题、素材、热门内容和 FAQ 都由后台管理。

## 项目状态

当前版本已经达到 **Commercial Release Baseline（既定范围内可商业发布）**。Storefront、中文运营后台、发布与回退、生产安全基线、媒体降级链路和部署后真实浏览器验收均已形成闭环。

项目收口表示现有管理模块、错误恢复、未保存保护、批量删除、发布与回退链路已经形成完整闭环，并由 CI、Worker dry-run、生产 HTTP 冒烟和 Playwright 浏览器验收持续守护；不表示继续引入 AI、广告池、复杂权限或企业审批等范围外能力。

现阶段不再以“继续增加功能”为目标，后续进入常规商业运营维护：

```text
监控生产运行
→ 按发布清单做真实业务数据验收
→ 修复明确的 Bug / 边界问题
→ 仅按实际运营需求规划新版本
```

当前没有必须补齐的业务模块。

## 产品定位与设计原则

本项目面向个人运营者或小团队，不按大型企业后台方向设计。

核心原则：

```text
简洁
高效
稳定
易维护
Mobile-first
```

功能优先解决真实运营需求，不为了“功能数量”堆叠低频模块。后台保持直接的单管理员操作流程；只有出现明确需求时才增加新的系统复杂度。

### 明确不在当前范围内

以下能力不是当前项目目标，也不应在常规优化中被当成“缺失功能”补充：

```text
AI 管理 / AI 生成功能
广告池 / 广告投放管理
复杂管理员账号、角色、组织与 RBAC
大型组织审批 / 协作工作流
多语言翻译系统
在本仓库内自建实时聊天 / 坐席 / 工单系统
Cloudflare Stream 视频转码平台
完整网页拖拽可视化设计器
在线下载并执行第三方 React / JavaScript / 任意 CSS 主题代码
```

普通产品视频继续使用 R2 + HTML `<video>`；主题继续使用安全 Design Tokens，而不是执行第三方程序代码。

## 当前功能总览

```text
Cloudflare Worker + D1 + R2
│
├─ 单管理员安全登录
├─ 站点设置 / Logo / GA4 / 媒体域名
├─ Mobile-first 主题中心
│  ├─ 6 套官方主题
│  ├─ shadcn Registry Theme 导入
│  └─ JSON Theme 导入
├─ 全站素材中心
│  ├─ JPG / PNG / WebP / GIF / MP4 / WebM
│  ├─ 文件夹
│  ├─ 搜索 / 筛选 / Cursor 分页
│  ├─ 上传队列 / 失败重试
│  ├─ 批量移动 / 删除
│  └─ R2 存储清理
├─ 分区管理
│  └─ 每个分区独立：产品 / 分类 / 标签 / 转化池
├─ 客服连接管理
├─ 流量分发账本 / 自然月统计
├─ FAQ / Markdown
├─ 热门 / 最新产品
├─ 模块化发布 / 历史版本 / Rollback
├─ 实时转化 CTA / /go 路由
└─ English Storefront
```

## Storefront：Mobile-first 用户前端

真实用户主要来自移动端，因此前端和主题系统都以手机为第一设计目标。

设计顺序：

```text
手机基础体验
→ 720px 以上增强
→ 980px 以上 PC 扩展
```

核心移动端基线：

- 产品列表保持双列浏览；
- 产品列表 / 封面使用 **1:1 正方形**；
- Hero 控制首屏占用，不挤压主要内容；
- 搜索、筛选、CTA 和底部导航保持适合触控的尺寸；
- 底部导航考虑 Safe Area；
- 深色和自定义主题的导航、Markdown、代码块、骨架屏等公共表面全部由 Theme Tokens 驱动；
- 图片 / 视频失败时显示稳定占位，不暴露浏览器破图；
- 内容暂时加载失败可原地重试，未发布 / 不存在资源使用明确的 404 语义。

### Storefront 启动请求边界

正常 schema-v2 Storefront 启动把首屏必须的运行时配置合并到单个 bootstrap 请求：

```text
GET /api/public/storefront/bootstrap
→ current pointer / site / sections index / home summary
→ 当前 mediaBaseUrl
→ 当前 Theme Runtime
→ Bottom Navigation
```

具体规则：

- 正常启动不再额外请求 `/api/public/bottom-navigation/` 或 `/api/public/theme`；
- `mediaBaseUrl`、当前主题配置与四个 Bottom Navigation 项使用同一条 D1 查询读取，导航图片的 `object_key` 也在该查询中解析；
- 已发布的 `site + sections index + home summary` 按 `pointerVersion` 合并为不可变 bootstrap bundle；正常命中后 Worker 只需要读取 `public/current.json + 对应 bootstrap bundle` 两个 R2 对象，而不是每次分别读取 4 个公开对象；
- bootstrap bundle 缺失、损坏或版本不匹配时必须回退到现有 `site / sections / home` 公开快照读取并自动重建 bundle，不能因为缓存优化导致 Storefront 不可用；
- bootstrap bundle 只缓存已发布静态内容；Theme、Bottom Navigation 与 `mediaBaseUrl` 仍是后台实时配置，不要求为了修改它们重新发布 R2 内容快照；
- PWA 的 `<link rel="manifest">` 和 Service Worker 行为保持不变；安装提示组件不再为了读取应用名主动二次 `fetch('/manifest.webmanifest')`，应用名直接复用 bootstrap 已有站点名称；
- PWA 安装监听仍在应用启动时立即挂载，不能因为等待 bootstrap 而错过 `beforeinstallprompt`；
- 旧 `/api/public/bottom-navigation/` 与 `/api/public/theme` 仅作为旧内容 / bootstrap 不可用时的兼容回退，不属于正常 schema-v2 启动请求预算；
- 后续新增首屏配置时优先复用 bootstrap，不能为可合并的小型配置恢复独立的全局启动请求。

### 分区筛选交互规则

分区产品页的筛选属于高频用户交互，固定采用**横向按钮**，不改成下拉选择器：

```text
搜索框
↓
分类横向按钮：单选
↓
标签横向按钮：多选
↓
双列产品列表
```

具体规则：

- **分类和标签都使用横向按钮展示，不使用分类下拉菜单；**
- 分类为单选，`All` 表示取消分类限制；
- 标签为多选，同时选择多个标签时，产品必须同时满足已选标签；
- 分类 / 标签数量超过屏幕宽度时使用横向滚动，不换成长下拉列表；
- 搜索、分类、标签可以组合筛选；
- 筛选基于当前已经加载的 `SectionSnapshot` 在浏览器本地完成；
- 用户点击分类、标签、清除筛选时不新增 Workers 请求，也不新增 D1 查询；
- 产品卡片优先呈现封面、已有分类 / 标签上下文和产品名称，不为了装饰增加前端硬写营销文案。

这一结构优先保证手机端快速浏览和触控效率，同时保持低请求数。即使单个分区产品数量较多，前端也优先一次取得当前公开分区所需数据后本地筛选，而不是把每次筛选动作变成后端请求。

### 前端转化路径

Storefront 的视觉优化以真实用户转化路径为主，而不是单纯追求装饰效果：

```text
首页 Hero / 推荐
→ 分区产品浏览
→ 产品详情
→ CTA
→ 客服 / 外部转化目标
```

设计要求：

- 首页第一屏负责建立兴趣，不把页面做成纯目录；
- 分区页负责让用户快速筛选和识别产品；
- 产品详情优先形成“媒体 → 产品信息 → CTA → 正文”的决策层级；
- 手机端 CTA 保持固定、易触达；
- PC 端优先让 CTA 与产品信息形成同一决策区域，不为了统一而机械复制手机布局；
- 前端只使用后台已经发布的业务内容和系统必要 UI 文案，不在页面中硬写行业营销内容；
- 视觉优化不得以增加不必要的 Workers / D1 请求为代价。

### 前端结构

```text
站点品牌 / Location
动态分区导航
主题化 Hero
热门产品
最新产品
分区产品列表
分类 / 标签 / 搜索筛选
FAQ
产品详情
图片 / GIF / 视频媒体
Messages / 实时客服 UI
实时 CTA
移动端底部导航
```

用户前端为 English；公开业务内容由管理员直接录入英文。

## 主题中心

主题系统采用：

> **一套业务组件 + Theme Tokens + 多套主题来源**

不同主题不会复制 ProductCard、Hero、ProductDetail、BottomNav 等业务代码。

### 官方主题

```text
Marketplace   通用业务目录 / 本地服务
Noir          深色 / 成人内容 / 会员展示
Live          直播 / 娱乐 / 强视觉入口
SaaS          软件 / 工具 / 企业服务
Travel        文旅 / 景区 / 本地体验
Tech          科技 / 硬件 / 创新产品
```

主题控制颜色、明暗模式、表面层级、边框、阴影、圆角、Hero 氛围等视觉 Token；业务数据结构保持一致。

### 主题来源

主题中心当前支持：

```text
官方精选
shadcn Registry Theme URL
JSON 导入
```

外部主题导入流程：

```text
外部 Theme JSON
→ Worker 安全读取 / 校验
→ 转换为本站标准 Theme Tokens
→ 手机实时预览
→ 可调整品牌强调色
→ 点击“保存并应用”
→ D1 保存标准化主题定义
→ Storefront 使用本站自己的 Theme Runtime
```

已保存主题不依赖原始第三方 URL 持续在线。

### 外部主题安全边界

主题库不会执行第三方代码：

- 不执行外部 React / JavaScript / HTML；
- 不加载任意第三方 CSS；
- Registry 只接受公开 HTTPS 地址；
- 限制 Theme JSON 大小；
- 拒绝 localhost、私网和明显内部地址；
- 只接受受控的颜色 / Theme Token 值；
- 导入只进入预览，必须显式点击 **保存并应用** 才持久化。

外部主题仍必须使用本站固定的 Mobile-first 业务结构、双列 1:1 产品卡和触控交互。

### 产品媒体比例

**1:1 是产品浏览基线，不是全站媒体强制裁切规则。**

```text
产品列表封面      1:1
后台产品缩略图    1:1
产品详情图片      使用内容合适比例
GIF              保留动画与源比例
视频             保留源视频比例
Logo / 图标       按品牌容器适配
Hero / Banner     使用主题需要的横向比例
Markdown 正文图   保留源比例并限制最大显示尺寸
```

## 全站素材中心

素材中心是全站唯一的日常媒体管理入口。

**产品录入不提供本地文件上传。** 产品图片、GIF 和视频必须先进入素材中心，再从产品编辑器选择已有素材。

### 支持格式

```text
静态图片   JPG / PNG / WebP
动图       GIF
视频       MP4 / WebM
```

技术类型：

```text
image
animated_image
video
```

业务用途：

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

技术类型与业务用途分离，一个素材可以被不同业务位置复用。

### 文件夹与浏览

素材中心提供轻量的一层文件夹：

- 新建 / 重命名 / 删除文件夹；
- 删除文件夹不会删除素材，素材回到“未分组”；
- 移动文件夹关系只修改 D1，不改 R2 `object_key`；
- 支持普通多文件上传；
- 支持选择本地文件夹上传，使用顶层目录名创建 / 复用素材文件夹；
- 本地多级子目录会扁平化到同一个顶层素材文件夹；
- 支持文件夹、媒体类型、用途和文本搜索；
- 使用服务端 Cursor 分页，每页按当前接口策略加载素材，不受旧的固定大列表上限影响；
- 已加载选择在继续分页时保持稳定。

### 上传队列

素材上传通过可见队列处理：

```text
queued
processing
uploaded
reused
error
```

- 最多 **3 个文件并发**；
- 一个文件失败不会中断整个批次；
- 失败文件保留本地 File 对象，可显式重试；
- 上传队列使用同步 single-flight 锁，快速重复触发也不会启动第二套并发池；
- 批次结束后统一刷新素材和文件夹数据。

### R2 静态图片压缩基线

**JPG / PNG / WebP 原图禁止直接进入 R2。**

```text
本地 JPG / PNG / WebP
→ 浏览器读取原图
→ 最长边压缩到不超过 1200px
→ WebP quality 0.82
→ 浏览器不支持 WebP 时回退 JPEG
→ multipart 中只放压缩后的文件
→ Worker 校验 compression profile / 输出格式 / sourceByteSize
→ R2 只保存 optimized 文件
```

Worker 会拒绝绕过压缩协议的静态图片请求，因此这个约束不是单纯依赖后台 UI。

Logo 和分区图标独立上传入口也必须经过对应浏览器压缩协议。

GIF 为保持动画、MP4 / WebM 为避免在浏览器后台引入重型转码链路，当前不使用静态图片 Canvas 压缩。

当前媒体大小策略：

```text
压缩后的静态图片 / GIF   默认最大 20 MB
视频                     默认最大 60 MB
```

### 产品选择素材

产品媒体区负责：

```text
从素材中心选择
→ 查看 1:1 缩略图
→ 文件夹 / 图片 / GIF / 视频筛选
→ 搜索
→ 最多 12 个产品媒体
→ 排序
→ 指定图片或 GIF 封面
→ 从产品解除引用
```

产品移除媒体只解除产品关系，不删除素材中心文件。视频不能作为产品封面。

### 存储清理

日常素材管理与底层 R2 清理分离：

```text
素材中心
→ 日常上传、整理、复用、移动、删除

存储清理
→ 扫描历史 R2 图片对象
→ 检查实时业务引用
→ 检查最近发布快照保护
→ 只删除服务端确认安全的孤立对象
```

## 分区驱动业务模型

“分区”是主要业务隔离边界。

创建分区后，后台自动生成：

```text
[分区名称]
├─ 产品管理
├─ 分类管理
├─ 标签管理
└─ 转化池
```

分类、标签、产品和转化分组都限制在当前 `section_id`，不允许跨分区错误引用。

### 产品管理

产品支持：

- Draft / Published / Archived；
- 线上 / 线下服务模式；
- 分类；
- 最多 12 个标签；
- 可选转化分组；
- Markdown 正文；
- 最多 12 个结构化媒体；
- 图片 / GIF 封面；
- 热门推荐和排序；
- 搜索、状态筛选、回收站、选择 / 全选、批量删除、恢复；
- 排序在搜索 / 筛选状态下自动禁用，避免隐藏项排序错误。

发布产品时会校验分类、标签、转化分组、媒体和线下地址等必要条件。

### 分类 / 标签

分类和标签都属于单一分区，支持新增、编辑、启停、排序、搜索、回收站、批量删除和恢复。

产品编辑器允许在录入过程中快速创建当前分区的新分类 / 标签。

### 转化池

转化池属于单一分区，管理产品 CTA 的目标。

主要模式：

```text
customer_service   外部客服入口
link               外部链接入口
```

转化配置保存后通过 D1 实时生效，不要求重新发布 R2 内容快照。

`/go/:productId` 是所有产品 CTA 的正式分发入口。链接模式需要轮换时由 `/go` 推进生产游标；在线客服模式由 `/go` 记录成功进入客服接待页的上游交付，然后进入 Storefront Messages。Site 不进行坐席轮换。

## 客服管理

客服管理只负责配置**独立客服系统连接**，不在本仓库内实现聊天系统。

当前保持轻量的 first-party `generic_v1` 对接契约，不引入复杂第三方 REST 映射器。

自研客服管理系统使用独立 Git 仓库、独立 Cloudflare Worker、独立数据库和独立部署流程。本项目只保留 Messages 用户界面、Site 侧在线客服转化组和客服系统连接配置。管理员录入客服系统公网根地址与验证 Token 后，由浏览器直接调用客服系统 `/integration/v1/verify` 完成协议验证并同步当前在线客服产品目录；Site 只保存验证后返回的 `clientApiUrl` / `realtimeUrl`，验证 Token 永远不会进入 Storefront 公开配置。

运行时由 Site 解析 **Product -> 在线客服转化组 -> 客服系统连接**，并把权威的产品 / 分区 / 分类上下文返回给 Storefront；之后 Conversation、Message、媒体和 WebSocket 流量都由浏览器直接访问独立客服系统，Site Worker 不代理聊天流量。独立客服系统再按“整个分区 / 指定分类 / 指定产品”的动态负责范围把会话分配给 Agent。Site 的“已分发”与客服系统的“坐席首次接待”形成上下游核对口径；转接、重新排队和重开不会重复增加坐席接待流量。完整协议见 [客服系统接入文档](docs/customer-service-integration.md)。

### 客服运行时请求边界

客服运行时采用**按需激活**，普通 Storefront 浏览不能因为底部存在 Messages 入口就无条件启动会话读取和 WebSocket：

```text
首次普通访客
→ 不创建客服 visitor identity
→ 不读取客服会话列表
→ 不建立客服 WebSocket

进入 Messages / 客服 CTA
或浏览器已有有效的 24h 客服 visitor identity
→ 激活会话列表
→ 激活实时连接
→ 维护未读状态
```

具体规则：

- 检查是否已有客服 identity 时只能读取现有状态，不能为了判断而创建新 identity；
- 用户进入 Messages 或客服 CTA 后可以创建 / 续用 24 小时 visitor identity；
- 已有有效 identity 的用户离开 Messages 后，仍可在其他 Storefront 页面保持未读徽标与实时消息更新；
- 没有客服使用历史的新访客不得请求 `/support/connections`、远端 conversations 或建立客服 WebSocket；
- 客服按需激活不能改变会话生命周期、转化记账或独立客服系统的路由职责。

## Markdown

产品正文和 FAQ 正文使用安全 Markdown。

支持：

```text
标题 / 段落 / 有序和无序列表 / 引用
粗体 / 斜体 / 删除线
链接 / 行内代码 / 代码块 / 分割线
Markdown 图片
```

安全边界：

- 不开放任意 HTML；
- 图片只允许站内路径或 HTTP / HTTPS；
- 拒绝 `javascript:`、`data:` 等不安全来源；
- 视频作为结构化媒体处理，不通过任意 HTML 注入正文；
- Markdown 图片加载失败时前端显示稳定占位。

## FAQ

FAQ 是全站公共内容，不属于单一分区。

支持新增、编辑、Markdown、排序、搜索 / 筛选、启停、删除和恢复；前端在 FAQ 为空或临时请求失败时提供明确状态和重试入口。

## 后台管理体验

Admin 保持中文、小团队、高密度工作台风格。

当前已经具备：

- URL Hash + `localStorage` 工作区记忆；
- 浏览器 Back / Forward；
- 关键页面显式未保存状态；
- 离开页面 / 退出登录前的未保存保护；
- Product Editor、Theme Center、Site Settings 的明确 dirty state；
- 共享确认 / 输入 Dialog；
- 全局 React Error Boundary；
- Admin 请求层统一 mutation 通知；
- 非 Auth Admin API 401 的全局 session-expired 处理；
- 登录接口与会话检查不会被误判成“活动会话过期”；
- 高风险批量写接口使用 idempotency key；
- 高频保存 / 删除 / 排序操作有 working / saving 状态，避免普通重复提交。

## 简化管理员登录

后台采用单管理员密码，不维护管理员账号表、角色表或组织权限。

Cloudflare Worker 需要手动绑定：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

两个值只要求已经配置且不是空值，不限制长度或复杂度。绑定值不写入 GitHub、D1 或 `wrangler.jsonc`。

认证保留必要安全措施：

- 签名 Session；
- HttpOnly Cookie；
- Secure；
- SameSite=Strict；
- 会话 TTL；
- 登录限速；
- 写操作审计；
- 会话失效时后台统一返回登录界面。

部署启用 `keep_vars`，重新发布 Worker 时保留 Cloudflare Dashboard 手动配置的变量。

## 发布模型

项目把“内容发布”和“实时运营状态”分开。

### 模块化内容发布

以下内容使用模块化版本：

```text
站点内容
分区导航
FAQ
各业务分区内容
```

流程：

```text
D1 当前业务数据
→ 发布校验
→ 生成不可变 R2 JSON 版本
→ 更新 current pointer
→ Storefront 读取公开内容
```

后台提供：

- Dirty 状态；
- 当前模块发布；
- 全部发布；
- 发布任务状态；
- 历史版本；
- Rollback；
- 发布失败反馈。

### 实时状态

主题和转化属于实时运行能力：

- 主题保存后由 `/api/public/theme` 读取当前 D1 Theme Runtime；
- 产品 CTA / 转化目标使用当前 D1 状态；
- 转化配置变化不需要为了更新 CTA 重新生成产品 R2 快照；
- `/go/:productId` 负责全部 CTA 的权威分发记账、链接轮换和客服入口交付；在线客服聊天数据仍直接流向独立客服系统。

这样内容版本保持稳定，同时运营入口可以即时生效。

## R2 存储与媒体公开读取

Cloudflare 正式资源：

```text
Worker: service-catalog-site
D1:     service-catalog-site-db
R2:     service-catalog-site-assets
```

当前只维护一套正式资源，不建立 Preview / Production 后缀资源。

R2 有两种访问路径：

```text
ASSETS_BUCKET Worker Binding
→ 后台上传、删除、校验和维护

R2 Custom Domain
→ 用户前端只用于公开读取图片、GIF 和视频
```

发布 JSON 虽然也保存在 R2，但浏览器始终通过站点 Worker 的同源 `/public/*` 读取，由 `ASSETS_BUCKET` Binding 访问对象；不会使用媒体自定义域名。

数据库媒体记录只保存 `object_key`，公开媒体 URL 统一生成：

```text
{media_base_url}/{object_key}
```

`media_base_url` 只由后台“站点设置”维护。Storefront 每次启动都通过运行时接口读取当前值；前端源码、构建变量和部署脚本都不保存当前 R2 自定义域名。更换绑定在同一 Bucket 上的自定义域名时，完成后台域名测试并保存即可，不需要修改代码、重新构建前端或重写已发布快照。

生产环境不依赖 `r2.dev`。

如果 R2 Custom Domain 暂时无法被浏览器直接读取，Storefront 会通过 `/_media/*` 重试已登记在 D1 且状态正常的媒体。媒体 fallback 由 Worker 使用 R2 Binding 流式响应并支持 Range 请求，不暴露任意 Bucket Key，也不在前端硬编码当前自定义域名。

## 路由

```text
/                        English Storefront
/sections/:slug/         分区深链接
/sections/:sectionSlug/products/:productSlug/  产品规范深链接
/products/:id-or-unique-slug/                  兼容旧产品深链接
/admin/*                  中文管理后台
/api/*                    Worker API
/go/:productId            实时转化跳转
/api/admin/traffic        自然月流量分发账本
/public/*                 当前公开内容与版本读取
/_media/*                 已登记媒体的同源读取 fallback
```

Storefront 和 Admin 都由同一个正式 Cloudflare Worker 提供。

## 语言边界

```text
用户前端：English
后台界面：中文
公开内容：管理员直接录入英文
```

不建立翻译表、语言切换或 `/en`、`/es` 路由。

## 数据库规则

- D1 schema 只通过 `migrations/*.sql` 演进；
- PR 必须在全新的本地 D1 上完整执行全部 migration；
- `main` 正式部署前自动应用尚未执行的远程 migration；
- 不在 Cloudflare Dashboard 手工修改表结构；
- 业务关系由外键、触发器 / CHECK 和 API 校验共同保护；
- 普通可删除业务实体使用软删除 / 回收站；
- 高风险写操作保留审计；
- 批量删除 / 排序等接口在需要时使用 idempotency key 防重。

## CI 与自动部署

GitHub Actions 工作流：`.github/workflows/ci.yml`。

运行要求：

```text
Node.js >= 22
pnpm 11.x
```

PR 和 `main` 都先执行完整验证：

```text
pnpm install --frozen-lockfile
→ 本地 D1 migrations
→ lint
→ format
→ typecheck
→ tests
→ build
→ wrangler deploy --dry-run
```

只有 `main` push 验证成功后才执行正式部署：

```text
记录正式 D1 Time Travel 恢复点
→ 远程 D1 migrations
→ 解析并校验 R2 Custom Domain
→ 配置 R2 CORS
→ 有 ready 媒体时探测直接 R2 媒体读取
→ 构建生产静态资源
→ wrangler deploy --keep-vars
→ Production smoke test
```

生产 smoke 当前覆盖：

- `/api/health`；
- `/api/public/theme` Theme Runtime；
- `/public/current.json`；
- 有 ready 媒体时的 R2 直接读取 / CORS；
- 已登记媒体的 `/_media/*` Range 同源 fallback；
- 未登录 Admin session；
- Storefront / Admin SPA；
- Storefront 分区 / 产品深链接。

## 本地开发

安装：

```bash
pnpm install
```

应用本地 D1 migration：

```bash
pnpm db:migrate:local
```

启动 Storefront、Admin 和 Worker：

```bash
pnpm dev
```

常用质量命令：

```bash
pnpm lint
pnpm format
pnpm typecheck
pnpm test
pnpm build
pnpm cf:check
```

## 仓库结构

```text
site/
├─ apps/
│  ├─ storefront/       English 用户前端
│  ├─ admin/            中文运营后台
│  └─ worker/           Cloudflare Worker / API
├─ packages/
│  ├─ shared/           通用 Markdown / 数据工具
│  ├─ config/           跨应用配置
│  └─ storefront-ui/    Storefront 与主题预览共用的真实展示组件 / CSS
├─ migrations/          D1 migrations
├─ scripts/             构建 / 发布辅助脚本
├─ config/              Cloudflare / R2 配置
├─ docs/                架构与数据设计文档
├─ .github/workflows/   CI / Deploy
├─ wrangler.jsonc
└─ package.json
```

## 文档

- [项目架构基线](docs/architecture.md)
- [D1 与 R2 数据存储基线](docs/data-storage.md)
- [开发阶段与交付计划](docs/development-plan.md)
- [发布验收清单](docs/acceptance-checklist.md)
- [生产发布与恢复手册](docs/operations.md)

README 用于说明**当前产品范围、已实现能力和运行方式**；`docs/` 保留更细的架构 / 数据设计背景。功能行为、migration 与文档发生变化时，应同步维护，避免 README 重新变成历史版本。
