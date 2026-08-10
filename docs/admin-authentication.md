# 单管理员认证

本项目第一版使用 Cloudflare Worker Secret 提供单管理员密码，不建立管理员账号表。

## Cloudflare Secrets

正式 Worker 必须手动配置：

```text
ADMIN_PASSWORD
SESSION_SECRET
```

两个值只要求已经配置且不是空值，不限制长度或复杂度。敏感值不得写入 GitHub、`wrangler.jsonc`、D1 或普通 `vars`。

本地开发可在未提交的 `.dev.vars` 中配置同名变量。

## API

```text
GET  /api/admin/auth/session
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/health
```

登录和退出请求必须包含：

```text
x-admin-request: 1
```

登录请求使用 JSON：

```json
{
  "password": "..."
}
```

## 会话

登录成功后签发 HMAC-SHA256 签名 Cookie：

```text
Cookie: site_admin_session
有效期: 8 小时
Path: /
HttpOnly: true
SameSite: Strict
Secure: HTTPS 环境启用
```

会话不写入数据库。修改 `SESSION_SECRET` 会立即使所有旧会话失效。

## 密码与限流

- 密码输入和 Worker Secret 分别计算 SHA-256 摘要后进行恒定时间比较；
- 客户端 IP 与 `SESSION_SECRET` 组合后只保存 SHA-256 哈希，不保存原始 IP；
- 15 分钟窗口内最多允许 5 次失败；
- 达到上限后封锁 15 分钟；
- 限流状态保存在 `admin_login_rate_limits`；
- 过期限流记录由登录请求清理。

## 审计

以下动作写入不可变 `audit_logs`：

```text
auth.login.succeeded
auth.login.failed
auth.login.blocked
auth.logout
```

审计记录不保存密码、Cookie、原始 IP 或 Session Secret。
