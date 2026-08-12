# 生产发布与恢复手册

本手册适用于当前单 Worker、单 D1、单 R2 的正式环境。恢复操作会覆盖正式数据，必须由维护者手动执行；自动部署只记录恢复证据，不自动回滚数据库。

## 发布前证据

`main` 部署在执行远程 migration 前运行：

```bash
pnpm exec wrangler d1 time-travel info DB
```

将命令输出中的 bookmark、时间、目标 commit 和 GitHub Actions run 一起保留。发布后的 `/api/health` 会返回 Cloudflare Worker Version ID，生产 smoke 必须验证该值非空。

## 应用回滚

1. 确认故障来自 Worker / 静态资源，而不是数据迁移。
2. 在 GitHub 中回滚对应 commit，并让 `main` 的正常流水线重新部署；不要从本地绕过流水线发布。
3. 验证 `/api/health` 的 Version ID 已变化，并重新执行生产 smoke。
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

恢复后依次检查 migration 列表、管理员登录、公开内容、媒体引用和写入路径。Cloudflare 当前为 Free 计划保留 7 天、Paid 计划保留 30 天 Time Travel 历史；超出窗口不能依赖此方式恢复。

## R2 与公开读取故障

- 公开内容采用不可变快照和 current pointer；内容误发布优先通过模块版本 Rollback。
- 数据库只保存媒体 `object_key`，R2 自定义域名由后台运行时配置提供，不写入前端源码或构建变量。
- 公开 JSON 始终使用同源 `/public/*`；图片、GIF 和视频通过运行时媒体域名读取，浏览器加载失败后使用 `/_media/*` 重试。
- `/_media/*` 只读取 D1 中状态为 `ready` 且未删除的对象，并支持视频 Range 请求；它不是公开的任意 Bucket 代理。
- 只有真实 ready 媒体对象的直读探测失败时，才检查对应媒体域名的 DNS、WAF、Bot 或 CORS；不能用 `/public/current.json` 探测媒体域名并据此判断安全规则异常。

## 发布后核验

- GitHub Actions 的 validate、deploy 和 smoke 全部成功；
- `/api/health` 返回 production 与非空 Worker Version ID；
- 部署后的 Playwright 浏览器验收通过（首页、Browse、后台登录、PWA 品牌图标、Messages 空状态、CTA 可见性）；
- `/public/current.json` 与主题接口返回正确缓存头；
- 至少一个已登记媒体通过 `/_media/*` 的 `Range: bytes=0-0` 请求返回 206、1 字节内容和 `Content-Range`；
- Storefront、Admin、分区和产品深链接正常；
- 在发布记录中附上 commit、Actions run、Worker Version ID、D1 恢复 bookmark 和异常说明。
