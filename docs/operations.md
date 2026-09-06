# 生产发布与恢复手册

本手册适用于当前单 Worker、单 D1、单 R2 的正式环境。恢复操作会覆盖正式数据，必须由维护者手动执行；自动部署只记录必要的恢复证据，不自动回滚数据库。

发布流程的开发/CI source of truth 是 `AGENTS.md` 与 `docs/development/`。生产 Cloudflare 远程动作由 `scripts/classify-cloudflare-changes.mjs` 分类后执行，不再把每次 `main` push 视为 D1/R2/Worker 全量操作的授权。

## D1 migration 发布证据

只有本次 diff 包含 `migrations/**`（或维护者通过 `workflow_dispatch` 显式强制 Cloudflare validation）时，CI 才在远程 migration 前运行：

```bash
pnpm exec wrangler d1 time-travel info DB
```

将命令输出中的 bookmark、时间、目标 commit 和 GitHub Actions run 一起保留。没有 migration diff 时，不读取 migration recovery bookmark，也不执行 remote migration apply。

发布后的 `/api/health` 会返回 Cloudflare Worker Version ID；只有真实 Worker deploy 后才运行 minimal production smoke，并验证该值与本次 deploy 返回的 Version ID 一致。

## 应用回滚

1. 确认故障来自 Worker / 静态资源，而不是数据迁移。
2. 在 GitHub 中回滚对应 commit，并让 `main` 的正常流水线重新分类并发布；不要从本地绕过流水线发布。
3. 如果回滚 diff 需要 deploy，验证 `/api/health` 的 Version ID 已变化，并重新执行对应 production smoke。
4. 内容误发布优先使用后台模块 Rollback；它只切换不可变发布版本，不恢复整个数据库。

## D1 恢复

D1 Time Travel 可按时间或 bookmark 恢复。正式恢复前先记录当前数据库的新 bookmark，作为撤销恢复的安全点：

```bash
pnpm exec wrangler d1 time-travel info DB
```

预览目标时间对应的 bookmark：

```bash
pnpm exec wrangler d1 time-travel info DB --timestamp="2026-08-10T12:00:00Z"
```

确认数据库名称、目标时间和恢复范围后，维护者才可手动执行恢复：

```bash
pnpm exec wrangler d1 time-travel restore DB --bookmark="TARGET_BOOKMARK"
```

恢复后依次检查 migration 列表、管理员登录、公开内容、媒体引用和写入路径。恢复保留窗口以 Cloudflare 当前账户/产品能力为准，不在仓库 contract 中硬编码易过期的套餐时长。

## R2 与公开读取故障

- 公开内容采用不可变快照和 current pointer；内容误发布优先通过模块版本 Rollback。
- 数据库只保存媒体 `object_key`，R2 自定义域名由后台运行时配置提供，不写入前端源码或构建变量。
- 公开 JSON 始终使用同源 `/public/*`；图片、GIF 和视频通过运行时媒体域名读取，浏览器加载失败后使用 `/_media/*` 重试。
- `/_media/*` 只读取 D1 中状态为 `ready` 且未删除的对象，并支持视频 Range 请求；它不是公开的任意 Bucket 代理。
- R2 CORS/domain/direct-media 管理验证只在 R2 配置 diff（或显式 operator override）时运行。普通 Worker/Storefront/Admin deploy 不为了构造 R2 probe target 而读取 production D1。
- 只有真实 ready 媒体对象的直读探测失败时，才检查对应媒体域名的 DNS、WAF、Bot 或 CORS；不能用 `/public/current.json` 探测媒体域名并据此判断安全规则异常。

## 发布后核验

Release validation 按 change classifier 分层：

- 所有代码候选先完成 local-first `pnpm verify`；
- migration diff：保留 D1 recovery bookmark + remote migration safety；
- R2 config diff：执行 R2 domain/CORS/direct-media validation；
- deploy-impacting diff：部署 Worker/static bundle，并运行 bounded minimal production smoke；
- Storefront/public runtime/production browser contract 相关 diff：在真实 deploy 后运行深层 HTTP / Playwright production acceptance；
- docs/tests/dev-tooling no-op diff：只运行 CI quality gates，不触碰 production D1/R2/Worker。

Minimal smoke 只确认本次 Worker Version ID、Storefront app shell 与 current publication pointer。更深的安全 header、Theme Runtime、auth/404 与浏览器行为检查属于 change-aware deep acceptance，不在每个 production deploy 上重复执行。

发布记录应保留 commit、Actions run、实际 Worker Version ID（如有 deploy）、D1 recovery bookmark（仅 migration release）和异常说明。
