# Implementation Status

核对日期：2026-07-21

## 当前状态

项目 MVP 已完成。生产部署由 `.github/workflows/deploy.yml` 在 `main` 更新后自动执行：

1. 安装锁定依赖
2. 生成 Cloudflare Binding 类型
3. Astro 严格类型检查
4. Node 自动化测试
5. Astro SSR 构建
6. Cloudflare 资源绑定校验
7. 应用向后兼容 D1 Migration
8. 部署 Cloudflare Worker
9. 更新固定部署状态 Issue #3

## 已完成模块

### 基础设施

- Astro 7 Cloudflare Workers SSR
- D1、R2 Worker Bindings
- GitHub Actions 验证与自动部署
- D1 SQL Migration
- 单管理员密码和签名 Session Cookie
- CSRF 同源校验、后台 noindex、安全响应头

### 后台

- 站点设置
- 多分区管理
- 分类筛选管理
- 分类管理和分类图片绑定
- 产品 CRUD、搜索、筛选、分页、正文、标签、封面和图库
- Hero 广告池和广告条目
- 随机 CTA 转化组和多类型资源
- R2 图片上传、真实文件检查、扫描、引用统计、删除保护和清理
- 上传前本地缩略图、待上传移除和未引用图片批量删除

### 前台

- 默认分区跳转和多分区底部导航
- Hero 自动轮播、触摸滑动、鼠标拖动、箭头和圆点
- 分类筛选和分类卡片
- 无分类分区直接产品目录
- 分类目录首屏 20 条和 Load More
- 分类、产品和标签搜索
- 产品详情、图库和安全正文
- URL、电话、WhatsApp、Telegram、Email CTA
- Web Crypto 等概率随机转化资源选择
- GA4、Meta Pixel、18+ Cookie Gate
- Privacy、Disclaimer、Canonical、Open Graph、robots.txt、sitemap.xml
- 手机 2 列、平板和 PC 4 列，PC 最大宽度 960px

## 数据原则

- 项目自身不记录公开访问、点击或转化数据。
- GA4 和 Meta Pixel 仅在后台配置后注入前台。
- 公开查询只读取 `published` / `enabled` 数据。
- 图片由浏览器直接从 R2 自定义域名加载；后台鉴权预览仅作为未配置公开域名时的管理备用方案。
- 删除产品、分类绑定或图库关系不会立即删除 R2 对象；图片文件统一由图片库清理。

## 上线前运营配置

代码部署完成后，管理员仍需录入实际运营数据：

- 网站名称、描述、Logo、Favicon
- R2 公开自定义域名
- 至少一个已发布分区并设为默认分区
- 分类、产品、图片和 Hero 广告
- 已启用且包含启用资源的转化组
- Privacy 和 Disclaimer 文本
- 可选 GA4、Meta Pixel、18+ 和 noindex 设置

运营数据保存在 D1/R2，保存后刷新前台即可生效，不需要重新部署代码。
