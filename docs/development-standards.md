# 开发与测试前置规则

本仓库以“开发前先确定约束，CI 只做最终验证”为原则。格式、Lint、TypeScript、既有架构边界和测试方式都必须在提交代码前明确，不接受先随意实现、再根据 CI 报错反复修正的工作流。

## 开发前

开始修改前必须完成：

1. 阅读 `README.md`、相关 `docs/` 文档、目标模块现有接口和数据模型；优先复用现有边界，不创建平行实现。
2. 在基线分支运行 `pnpm preflight`。如果基线本身失败，先处理基线，不把已有问题混进业务改动。
3. 以仓库内配置作为唯一代码规范：`.editorconfig`、`prettier.config.mjs`、`eslint.config.mjs`、`tsconfig.base.json`。
4. 明确改动属于 Storefront、Admin、Worker、D1、R2 或独立客服系统哪一层；不得为了方便跨越既定运行时边界。

`pnpm install` 会自动把 Git hooks 指向 `.githooks`。提交前 `pre-commit` 会运行 `pnpm preflight`，因此格式、Lint 或类型不通过的代码不能正常提交。

## 开发过程中

- 按 Prettier 的最终形态直接编写代码，不依赖 CI 事后格式化。
- 新功能优先做小范围、可验证的改动，不顺手扩大架构。
- 删除废弃代码、临时兼容层和无价值测试，不保留“以后可能有用”的死代码。
- 测试验证公开行为、数据转换、API 响应、状态变化和关键架构边界，不验证变量名、函数所在文件、源码排版或 CSS 字符串的具体写法。

## 测试规则

应保留：

- 直接调用业务函数的单元测试；
- Worker API / D1 约束 / 发布链路等集成测试；
- 路由、数据转换、网络传输和持久化行为测试；
- 少量真正不可破坏的系统边界测试；
- 生产部署后的 HTTP smoke 与 Playwright 浏览器验收。

应删除或避免新增：

- `readFile()` 后用正则匹配实现源码；
- 检查某个函数必须位于某个文件；
- 检查 CSS selector 必须按固定文本存在；
- 因 Prettier 换行就会失败的测试；
- `assert.equal(true, true)` 一类无实际价值 smoke；
- 同一行为在多层重复验证的测试。

如果一个测试在功能完全正常的情况下会因为重命名、移动文件或等价重构而失败，它通常不应该存在。

## 提交前

日常改动至少运行：

```bash
pnpm preflight
pnpm test
```

涉及 Worker、D1、构建或部署链路时运行完整验证：

```bash
pnpm verify
```

`pnpm verify` 依次执行格式、Lint、类型、D1 本地迁移、测试、生产构建和 Worker dry-run。GitHub Actions 继续保留相同的最终验证职责，但不作为发现基础格式问题的第一现场。
