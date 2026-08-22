# Storefront Visual Art Direction

Storefront 视觉精修的目标不是继续堆装饰，而是让 **Theme Center 决定视觉人格，Layout 决定信息秩序，Business Route 只提供真实内容**。

## Ownership

```text
Theme Center / packages/storefront-ui
→ Typography hierarchy
→ Media tone / overlay / shadow
→ Image motion intensity
→ Surface / control appearance

Layout / route CSS
→ Hero、快捷入口、Section、产品 Grid 的空间与结构
→ 决定内容放在哪里，不重新发明主题

Business content
→ 标题、描述、分类、产品、图片、CTA
→ 来自后台发布数据
```

页面不得为了某个行业单独硬写第二套颜色、字体、图片滤镜或动画系统。优先扩展共享 Art Direction contract，并消费已有 `data-theme`、`data-font-pack`、`data-media-style`、`data-motion-style`。

## Typography hierarchy

文字不能只靠“同一种颜色 + 不同字号”区分。至少保持以下语义层级：

```text
Hero / Display
→ 页面最高视觉焦点

Section Heading
→ 建立纵向浏览节奏

Product Title
→ 产品识别核心

Description
→ 次级解释信息

Category / Context / Caption
→ 最弱辅助层级
```

层级可以使用字号、字重、颜色、letter-spacing、line-height、text-transform 与对齐方式共同建立；不要所有文本都直接使用同一个 `var(--text)` 强度。

对齐由内容角色和主题共同决定：品牌 Logo、快捷入口和 Empty State 可以居中；信息型标题、产品详情和大部分产品信息优先保持稳定阅读轴；Editorial / Travel 等主题允许在共享 recipe 中采用更居中的构图，但不能在单独页面写一次性补丁。

## Media art direction

图片不是单纯塞进容器。共享主题可以控制：

- 饱和度、对比度与亮度；
- Hero / Product 的渐变遮罩；
- media shadow / border / radius；
- hover / press 的轻微 scale；
- Hero active image 的短时 settle 动效。

动效必须服务内容，不能持续漂移、无限 Ken Burns、晃动或强 parallax。图片动效强度服从 Theme Center 的 `motionStyle`；`prefers-reduced-motion` 必须关闭非必要动效。

## Theme personality

当前六套官方主题仍共用同一业务 DOM，但应通过共享 recipe 形成明显不同的视觉人格：

```text
Marketplace
→ 中性、直接、清晰的信息层级

Noir
→ 深色、高对比、海报式图片文字融合

Live
→ 更强饱和度与动态感，视觉入口更积极

SaaS
→ 克制、干净、低噪声、信息优先

Travel
→ 柔和、明亮、内容感更强，可使用居中构图

Tech
→ 锐利、低饱和、精确、强调 brand accent
```

## Home baseline

首页第一轮视觉精修固定关注：

```text
Hero image treatment
→ Hero title / description hierarchy
→ Shortcut icon + label
→ Section heading + description
→ Product image
→ Product title + category context
→ Bottom Navigation
```

产品卡继续保持手机双列与 1:1 图片基线。是否把产品文字放在图片内部由共享主题 recipe 决定：Noir / Live 可以使用海报式 on-media copy；Marketplace / SaaS / Travel / Tech 默认使用图片下方的信息层级。

任何视觉优化都不得增加不必要的 Worker / D1 / R2 请求，也不得破坏 App Shell、VisualViewport、First Paint、scroll restoration 或 Theme Center ownership。
