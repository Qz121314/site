# Storefront Viewport Runtime

Storefront persistent chrome must remain usable in normal mobile browsers, installed PWA mode, desktop browsers, rotated devices, and keyboard-resized viewports without device-specific offsets.

## Ownership

```text
VisualViewport Runtime
├─ publishes live visual viewport geometry
└─ App Shell chrome measurement
   ├─ Header
   └─ Bottom Chrome

App Shell
├─ fixed Header
├─ route content
└─ fixed Bottom Chrome
   ├─ normal routes -> Bottom Navigation
   └─ Product route -> Route Action / CTA
```

Route pages own business content and action intent. They do not calculate browser toolbar offsets or mount global fixed surfaces directly to `document.body`. Bottom Navigation and Product CTA are two content states of the same App Shell bottom slot, not separate viewport-positioning systems.

## Geometry sources

Three different geometry sources have different responsibilities:

1. `window.visualViewport` describes the browser's currently visible viewport and reacts to dynamic browser chrome, zoom geometry, and supported virtual-keyboard resizing.
2. `env(safe-area-inset-*)` protects content from physical display cutouts, rounded corners, and home-indicator areas.
3. `ResizeObserver` measures the actual rendered size of App Shell Header and the active Bottom Chrome content.

Do not replace these with UA sniffing, device-model branches, or browser-specific magic numbers.

## Runtime variables

The viewport runtime publishes:

```text
--app-viewport-width
--app-viewport-height
--app-viewport-top
--app-viewport-right
--app-viewport-bottom
--app-viewport-left

--app-header-height
--app-bottom-chrome-height
```

CSS uses these values for placement and content clearance. Component design sizes may still have normal theme dimensions, but route layout must not duplicate those dimensions in formulas such as `CTA height + 58px` or `100dvh - 68px`.

## Browser chrome behavior

- Header stays fixed to the live visual viewport top.
- Bottom Chrome stays fixed to the live visual viewport bottom on mobile/tablet routes where it is used.
- Normal routes render Bottom Navigation inside Bottom Chrome.
- Product routes render Route Action / CTA inside the same Bottom Chrome.
- Route content clears the measured Header and the measured active Bottom Chrome.
- Section full-height browsing uses live viewport height minus the measured Bottom Chrome.
- PWA install UI clears both browser viewport insets and the measured Bottom Chrome.
- At desktop product breakpoints the Product CTA remains in the inline decision panel and the mobile Bottom Chrome is hidden.
- `theme-color` follows the current page background token so browser/system chrome visually blends with the active light or dark theme.

## Interactive widgets

The Storefront viewport metadata requests `interactive-widget=resizes-content`. The runtime still listens to VisualViewport changes because browser support and mobile browser behavior vary.

Messages and other input-heavy routes must keep the 16px mobile input font floor and Safe Area handling. Keyboard/browser geometry belongs to the viewport runtime rather than per-page focus patches.

## Performance boundary

`ResizeObserver` observes only persistent App Shell chrome. A direct-child `MutationObserver` refreshes the observed targets when Shell chrome is mounted or removed. Route content DOM changes do not trigger chrome remeasurement merely because products, messages, or Markdown content changed.

## Verification

Repository contracts and production Playwright acceptance verify:

- VisualViewport runtime installation;
- measured Header and Bottom Chrome variables;
- fixed Header alignment to the visual viewport top;
- fixed Bottom Chrome alignment to the visual viewport bottom;
- Bottom Navigation and Product CTA share that same fixed owner;
- Section geometry uses live viewport and measured Bottom Chrome height;
- no legacy split Bottom Navigation / Route Action height system returns;
- no legacy fixed-height viewport formulas return;
- no UA/device-specific viewport offset logic is introduced.
