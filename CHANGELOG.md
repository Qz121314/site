# Changelog

## Release Candidate Closure — 2026-08-23

进入最终收口与稳定维护阶段。

### Closure policy

- 冻结 Storefront、Admin、Worker、D1、R2、发布模型、路由与客服集成边界，不再进行非必要架构重构。
- 冻结现有主题与视觉系统；后续仅修复明确 UI Bug、兼容性问题与真实运营问题，不继续堆叠主题、视觉 token 或布局模式。
- 保持 Storefront bundle budget 不放宽：JavaScript gzip < 100 KiB，CSS gzip < 25 KiB。
- Release Candidate 期间重点验证 PR → main → GitHub Actions → D1 migration → Cloudflare Worker deploy → production smoke → Playwright acceptance 的完整生产链。
- 客服集成进入故障态验收阶段，重点验证 timeout、offline、WebSocket reconnect、后台恢复、上传失败与部分服务不可用场景。
- 不新增 AI、广告池、复杂 RBAC / 审批、多 Worker 或新的缓存 / 数据基础设施。

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
