# 公开快照协议

本文档定义 D1 到 R2 的公开发布协议。Storefront 必须从第一版开始遵循该协议，不使用临时 D1 列表 API 作为后续再替换的过渡方案。

## 1. 目标

公开快照用于：

- 降低 Worker 动态请求和 D1 行读取；
- 让 CDN、浏览器缓存和 PWA 高效复用公开内容；
- 保证发布操作原子切换；
- 支持旧版本保留、快速回滚和客户端兼容；
- 将后台草稿状态与公开版本状态分离。

## 2. R2 目录

```text
catalog/
├─ current.json
└─ versions/
   └─ {contentVersion}/
      ├─ manifest.json
      ├─ en/
      │  ├─ home.json
      │  ├─ channels/{slug}.json
      │  ├─ listings/{id}.json
      │  ├─ stores/{id}.json
      │  └─ search-index.json
      ├─ es/
      │  ├─ home.json
      │  ├─ channels/{slug}.json
      │  ├─ listings/{id}.json
      │  ├─ stores/{id}.json
      │  └─ search-index.json
      └─ prerender/
         ├─ en/...
         └─ es/...
```

`contentVersion` 推荐格式：

```text
2026-08-05T224000Z-a1b2c3d4
```

时间用于排序，短哈希或随机后缀用于避免冲突。生成安全随机值时使用 Web Crypto。

## 3. `current.json`

示例：

```json
{
  "schemaVersion": 1,
  "contentVersion": "2026-08-05T224000Z-a1b2c3d4",
  "manifestPath": "catalog/versions/2026-08-05T224000Z-a1b2c3d4/manifest.json",
  "publishedAt": "2026-08-05T22:40:00Z",
  "minimumAppVersion": "0.1.0"
}
```

规则：

- 文件体积保持极小；
- 不包含完整目录数据；
- 只在完整版本写入和校验成功后更新；
- 更新使用最后一步提交语义；
- 客户端不得根据目录列表猜测最新版本；
- Preview 和 Production 使用完全不同的 Bucket 或前缀。

## 4. `manifest.json`

示例：

```json
{
  "schemaVersion": 1,
  "contentVersion": "2026-08-05T224000Z-a1b2c3d4",
  "generatedAt": "2026-08-05T22:39:50Z",
  "minimumAppVersion": "0.1.0",
  "locales": ["en", "es"],
  "files": {
    "en/home.json": {
      "sha256": "...",
      "bytes": 12345,
      "contentType": "application/json"
    },
    "es/home.json": {
      "sha256": "...",
      "bytes": 12580,
      "contentType": "application/json"
    }
  }
}
```

每个文件至少记录：

- SHA-256；
- 字节数；
- Content-Type。

可选字段：

- 记录数量；
- 压缩方式；
- 分区范围；
- 预渲染页面列表；
- 搜索索引版本。

## 5. Schema 兼容规则

### 5.1 `schemaVersion`

- 增加可选字段不必提升主版本；
- 删除字段、改变字段类型或改变语义必须提升 `schemaVersion`；
- Storefront 必须显式声明可接受的版本范围；
- 客户端遇到不支持的版本时显示可恢复错误，并尝试更新应用；
- 不得忽略未知重大版本继续猜测解析。

### 5.2 `minimumAppVersion`

当新内容依赖新版 Storefront 才能正确展示时提高该值。

客户端处理：

1. 读取 `current.json`；
2. 比较当前应用版本；
3. 低于最低版本时触发更新提示；
4. 更新失败时保留最近一个兼容且已校验的快照；
5. 不把不兼容内容解析错误显示为“没有数据”。

### 5.3 字段演进

推荐：

- 新字段先作为可选字段发布；
- Storefront 上线支持后，再改为业务必需；
- 不在同一次部署中同时删除旧字段并要求新客户端；
- 高风险变更至少保留一个兼容窗口。

## 6. 发布任务状态机

```text
queued
→ locking
→ validating
→ building
→ uploading
→ verifying
→ switching
→ published
```

失败状态：

```text
failed_validation
failed_build
failed_upload
failed_verification
failed_switch
cancelled
```

后台展示时可归一为 `queued / building / published / failed`，但任务表应保留精确阶段和错误信息。

## 7. 原子发布流程

### 7.1 创建任务

- 生成 `publish_job_id`；
- 接收幂等键；
- 记录发起管理员、目标环境和源数据版本；
- 同一环境同时只允许一个任务进入构建；
- 重复幂等键返回原任务结果，不重复生成版本。

### 7.2 获取互斥锁

锁必须具有：

- 环境范围；
- 持有者；
- 过期时间；
- 安全续期或超时接管规则。

超时任务恢复前先确认是否已经完成指针切换，避免重复发布。

### 7.3 发布前校验

至少校验：

- English 和 Español 必填翻译；
- slug 和公开 ID 唯一；
- Listing 所属频道和分类有效；
- 媒体对象存在；
- 封面回退逻辑可得到有效图片；
- 转化目标启用且协议/域名通过白名单；
- 不包含软删除实体；
- 公开页面引用均可解析；
- 单文件和总快照体积未超过预算。

校验失败时不得写入 `current.json`。

### 7.4 构建

- 读取固定的数据版本或一致性边界；
- 生成所有 JSON、搜索索引和可选预渲染文件；
- 对输出进行稳定排序，确保相同数据产生可重复内容；
- 计算每个文件的 SHA-256 和字节数；
- 生成 manifest；
- 在上传前完成本地结构验证。

### 7.5 上传

- 所有文件写入新的不可变版本目录；
- 不覆盖旧版本文件；
- 对同一版本重复上传必须安全；
- 上传可以重试；
- 任意失败不得修改 `current.json`。

### 7.6 验证

上传后验证：

- manifest 存在；
- manifest 中每个文件存在；
- Content-Type 正确；
- 字节数匹配；
- 必要时重新计算或抽样验证哈希；
- 两种语言的关键入口文件存在；
- 预渲染文件和 JSON 引用一致。

### 7.7 切换指针

只有验证全部通过后：

1. 生成新的 `current.json`；
2. 写入目标环境指针；
3. 读取回验；
4. 将任务标记为 published；
5. 记录 previous version 和 current version；
6. 异步安排旧版本清理。

若指针写入结果不确定，必须先读取确认，不能直接重试生成另一个版本。

## 8. 回滚

回滚流程：

1. 选择一个仍保留且通过验证的历史版本；
2. 验证其 manifest 和关键文件仍存在；
3. 检查与当前 Storefront 的兼容性；
4. 更新 `current.json` 指向该版本；
5. 回读确认；
6. 记录管理员、原因、原版本和目标版本；
7. 不重新生成内容。

回滚只影响公开版本，不自动覆盖 D1 中的当前草稿。管理员可选择后续重新发布或另行恢复数据。

## 9. 失败恢复

### 构建或上传失败

- 标记失败阶段；
- 保留错误摘要；
- 不切换指针；
- 未完成版本目录进入延迟清理；
- 允许使用相同幂等键查看原结果，使用新幂等键重新尝试。

### 指针切换失败

- 读取 `current.json` 确认实际状态；
- 若已指向目标版本，则视为成功并补写任务状态；
- 若仍指向旧版本，则可安全重试指针切换；
- 不重新上传已验证的不可变版本。

### Worker 或 Queue 中断

恢复任务根据持久化阶段继续，不依赖内存状态。任何请求级状态不得只保存在模块级变量中。

## 10. 缓存策略

### `current.json`

建议：

```text
Cache-Control: public, max-age=30, stale-while-revalidate=30
```

或由 Storefront 使用 Network First，并在网络失败时读取最近有效版本。

### 版本化 JSON

```text
Cache-Control: public, max-age=31536000, immutable
```

### 图片

使用不可变对象 Key：

```text
Cache-Control: public, max-age=31536000, immutable
```

### HTML 应用壳

- 可短缓存；
- 必须能够检测新应用版本；
- 不能让旧 HTML 永久引用已清理资源。

### 敏感接口

以下使用 Network Only：

- `/api/auth/*`；
- `/api/admin/*`；
- `/api/upload/*`；
- 客服令牌；
- 其他权限相关动态接口。

## 11. Storefront 读取算法

推荐流程：

1. 请求 `current.json`；
2. 验证基础字段；
3. 检查 `schemaVersion` 和 `minimumAppVersion`；
4. 若版本未变化，继续使用本地已验证 manifest；
5. 若版本变化，请求对应 manifest；
6. 验证 manifest；
7. 按页面需要加载 JSON；
8. 请求失败时尝试最近一个兼容、完整、已验证版本；
9. 明确显示离线或内容可能过期状态。

客户端不得：

- 遍历 R2 目录猜测版本；
- 把 JSON 解析错误当作空列表；
- 在 manifest 校验前覆盖最后一个有效版本；
- 缓存后台或身份响应；
- 假定 English 与 Español 文件一定同步成功而跳过验证。

## 12. 搜索和分区

数据量较小时可按频道生成列表文件并在浏览器筛选。

数据量增长后按以下顺序拆分：

1. locale；
2. channel；
3. region；
4. 分页或游标分片；
5. 独立轻量搜索索引。

约束：

- 不让客户端一次下载整个数据库；
- 文件分区规则写入 manifest；
- 分区变化属于协议演进，需要保持兼容窗口；
- 搜索索引只包含公开必要字段。

## 13. PWA 更新协同

应用版本和内容版本相互独立：

```text
appVersion       Storefront JS/CSS/HTML 版本
contentVersion   R2 公开内容版本
schemaVersion    内容协议版本
```

规则：

- 内容更新通常不要求重新部署 Storefront；
- 协议重大升级可能要求提高 `minimumAppVersion`；
- 新 Service Worker 激活前清理过期应用缓存，但保留最近兼容内容缓存；
- 缓存清理采用数量或体积上限，避免无限占用设备空间；
- 更新提示应区分“应用更新”和“内容更新”。

## 14. 版本保留和垃圾回收

至少保留：

- 当前版本；
- 上一个稳定版本；
- 一定数量或时间窗口内的历史版本。

清理前检查：

- `current.json` 未指向该版本；
- 不在人工保护列表；
- 不属于待调查失败任务；
- 保留数量和最短保留时间满足策略；
- 删除任务可重试并记录审计。

## 15. 测试要求

### 单元测试

- 稳定排序；
- 哈希和 manifest 生成；
- schema 校验；
- 兼容版本判断；
- 路径生成和防目录穿越。

### 集成测试

- D1 数据到完整版本目录；
- 多语言完整度失败；
- 媒体缺失；
- 并发发布；
- 上传中断和重试；
- 指针写入不确定状态；
- 回滚；
- Preview/Production 隔离。

### 端到端测试

- Storefront 从空缓存加载；
- 内容版本更新；
- 旧应用读取新内容；
- 新应用读取旧内容；
- 离线使用最后有效版本；
- manifest 或文件损坏时不覆盖有效缓存；
- Service Worker 更新后缓存迁移。

## 16. 验收标准

公开发布机制完成时必须满足：

- 同一环境同时只有一个有效发布构建；
- 重复请求不会产生重复副作用；
- 任何失败都不会让 `current.json` 指向不完整版本；
- 所有公开文件可通过 manifest 验证；
- Storefront 可以处理版本未变化、版本升级和网络失败；
- 回滚只需切换指针；
- Preview 无法覆盖 Production；
- 旧版本有明确保留和清理策略；
- 发布、回滚和清理均有审计记录。
