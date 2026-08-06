# 阶段 1：D1、管理员鉴权、RBAC 与审计

## 本批交付

- D1 初始迁移和领域主表；
- 管理员、角色、权限与会话表；
- PBKDF2-HMAC-SHA256 密码校验；
- 不透明会话 Token，数据库只保存 SHA-256 摘要；
- `HttpOnly + Secure + SameSite=Strict` 管理员 Cookie；
- 登录限流、同源检查和统一认证错误；
- RBAC 权限中间件；
- 登录、退出和失败登录审计；
- 审计日志只读接口；
- 管理员初始化 SQL 生成脚本。

## 管理员初始化

迁移完成后，在可信本地环境生成一次性 SQL：

```bash
ADMIN_EMAIL='admin@example.com' \
ADMIN_PASSWORD='replace-with-a-long-random-password' \
ADMIN_DISPLAY_NAME='Administrator' \
pnpm admin:create-sql > /tmp/create-admin.sql
```

应用到目标环境：

```bash
pnpm exec wrangler d1 execute DB --env preview --remote --file /tmp/create-admin.sql
pnpm exec wrangler d1 execute DB --env production --remote --file /tmp/create-admin.sql
```

不要提交生成的 SQL、密码或数据库导出文件。

## 管理员 API

```text
POST /api/admin/auth/login
GET  /api/admin/auth/session
POST /api/admin/auth/logout
GET  /api/admin/me
GET  /api/admin/audit-logs?limit=50
```

## 安全边界

- 登录失败统一返回相同错误，避免直接暴露账号是否存在；
- PBKDF2 参数随用户记录保存，便于后续提高工作因子；
- Cookie 仅发送到 `/api/admin`；
- 跨站写请求被拒绝；
- 审计日志不保存密码、Token 或完整请求正文；
- 初始管理员通过离线脚本创建，不开放公网 Bootstrap 接口。
