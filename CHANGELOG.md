# Changelog

## 1.0.0 — 2026-08-12

首个正式商业发布基线。

### Release baseline

- Storefront、Admin、Worker、D1、R2 形成完整生产闭环。
- 后台站点设置、主题中心、素材中心、分区 / 产品 / 分类 / 标签 / 转化池、FAQ、客服连接、发布历史与回退均进入稳定维护状态。
- Storefront 保持 Mobile-first、后台数据驱动、1:1 产品浏览素材、统一顶部品牌栏与轻量加载动效。
- `/admin` 入口、生产认证边界、媒体自定义域名读取与同源 fallback 已纳入生产验收。
- CI 持续执行 D1 migration validation、Lint、Prettier、Typecheck、Tests、Build、Worker bundle、生产 HTTP smoke 与 Playwright browser acceptance。

### Maintenance policy after 1.0.0

V1 功能范围冻结。后续仅处理明确 Bug、兼容性 / 性能回退和真实运营需求；不以继续堆叠功能为目标。

以下能力继续保持在当前仓库范围之外：AI、广告池、复杂 RBAC / 审批，以及独立客服坐席 / 工单管理系统。
