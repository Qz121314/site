# Changelog

## V1 Frozen / Stable Maintenance — 2026-08-23

V1 正式完成收口，项目进入冻结与稳定维护阶段。

### Frozen scope

- Storefront、Admin、Worker、D1、R2、发布模型、路由和客服集成边界全部冻结。
- 现有主题、视觉系统、App Shell、导航、产品卡片、CTA、Messages 与 PWA 交互基线冻结。
- Storefront bundle budget 保持不放宽：JavaScript gzip < 100 KiB，CSS gzip < 25 KiB。
- 不再以“继续优化”或“继续增加功能”为目标，不进行没有真实问题支撑的架构重构、数据库重构、路由重写或视觉扩展。
- 不新增 AI、广告池、复杂 RBAC / 审批、多 Worker 或新的缓存 / 数据基础设施。

### Stable maintenance policy

后续只接受以下三类变更：

1. 已确认的生产 Bug 或故障；
2. 明确的性能、兼容性或安全回退；
3. 真实运营产生并经过确认的新需求。

所有后续改动继续遵循影响分级与 root-cause-first 原则；稳定模块默认不动，修复范围保持最小且完整。

生产发布继续由 `main` 的正式 CI 作为最终 release gate，持续执行 migration validation、Lint、Prettier、Typecheck、Tests、Build、Worker bundle，并在正式部署时执行 D1 / R2 / Worker / production smoke / Playwright acceptance。

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
