# Storefront mobile bottom navigation design QA

## Source visual truth

- Source image: `C:/Users/kyta6/AppData/Local/Temp/codex-clipboard-ec79f478-cda8-420a-b652-578514ef1603.png`
- Source pixels: 598 x 237. The source is a cropped Pearl Floating Dock concept, so the dock is the primary comparison region.

## Implementation evidence

- Implementation screenshot: `D:/codex/data/2026-09-15/github-plugin-github-openai-curated-remote/work/site/work/implementation-mobile.png`
- Focused implementation screenshot: `D:/codex/data/2026-09-15/github-plugin-github-openai-curated-remote/work/site/work/implementation-nav.png`
- Combined comparison input: `D:/codex/data/2026-09-15/github-plugin-github-openai-curated-remote/work/site/work/qa-comparison.png`
- Browser-rendered implementation viewport: 390 x 844 CSS pixels, device scale factor 1.
- Focused implementation pixels: 362 x 76. The dock is inset 14px horizontally and 12px above the viewport bottom.
- State: Storefront Home route, Home active, Browse and Messages inactive, published read-only bootstrap response injected into the local browser fixture.

## Comparison

- Full view: the mobile page keeps content clearance above the fixed dock; no overlap or viewport overflow was observed.
- Focused region: one unified warm pearl capsule, thin rose border, soft rose shadow, equal three-column spacing, and a circular active Home outline match the selected direction.
- Fonts and typography: labels render at 12px with semibold weight and display-font inheritance, improving visibility over the previous 11px treatment while keeping the hierarchy compact.
- Spacing and layout rhythm: the dock measures 362 x 76 at a 390px viewport, with 14px side insets, 12px bottom breathing room, 40px icon slots, and a 63px navigation item height.
- Colors and visual tokens: the surface uses the existing `--surface`, `--brand-strong`, and `--line` tokens with a 10% warm brand mix; active color and ring remain theme-driven.
- Image quality and asset fidelity: the source contains no raster imagery; existing Lucide navigation icons are retained and no CSS or handcrafted SVG replacements were introduced.
- Copy and content: Home, Browse, and Messages labels remain unchanged and are sourced from the existing navigation contract.
- Icons: icon sizing and stroke treatment remain on the existing icon family. The published Browse configuration currently supplies Compass rather than the source concept's search glyph; it was intentionally left unchanged to preserve Admin-configured navigation.

## Findings

No actionable P0, P1, or P2 visual findings remain for the selected mobile bottom navigation.

P3 follow-up: if the product later standardizes the Browse icon itself, the source concept uses a search glyph, but that is outside this style-only change and would alter the published navigation icon contract.

## Primary interactions tested

- Home is rendered as the active item with `aria-current="page"`.
- Browse navigates to `/browse/`.
- Messages navigates to `/messages/`.
- Navigation labels and hrefs remain `Home` `/`, `Browse` `/browse/`, and `Messages` `/messages/`.
- Browser page errors: 0.

## Comparison history

- Initial pass: the existing mobile nav used an active filled surface, a top indicator line, a shorter icon slot, and smaller labels.
- Fix: replaced the active fill and indicator with a unified pearl dock, circular active icon ring, warm border and shadow, 40px icon slots, and 12px labels.
- Post-fix pass: the combined source and implementation comparison showed no actionable P0, P1, or P2 mismatch; computed active ring radius is `50%`, dock shadow is present, and the focused dock remains within the viewport.

## Final result

passed
