# Storefront Viewport Runtime

Storefront persistent chrome must remain usable in normal mobile browsers, installed PWA mode, desktop browsers, rotated devices, and keyboard-resized viewports without device-specific offsets.

## Ownership

```text
VisualViewport Runtime
├─ publishes live visual viewport geometry
└─ App Shell chrome measurement
   ├─ Header
   ├─ Bottom Navigation
   └─ Route Action / CTA

App Shell
├─ fixed Header
├─ route content
├─ fixed Bottom Navigation
└─ fixed Route Action host
```

Route pages own business content and action intent. They do not calculate browser toolbar offsets or mount global fixed surfaces directly to `document.body`.

## Geometry sources

Three different geometry sources have different responsibilities:

1. `window.visualViewport` describes the browser's currently visible viewport and reacts to dynamic browser chrome, zoom geometry, and supported virtual-keyboard resizing.
2. `env(safe-area-inset-*)` protects content from physical display cutouts, rounded corners, and home-indicator areas.
3. `ResizeObserver` measures the actual rendered size of App Shell Header, Bottom Navigation, and Route Action surfaces.

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
--app-bottom-nav-height
--app-route-action-height
--app-bottom-chrome-height
```

CSS uses these values for placement and content clearance. Component design sizes may still have normal theme dimensions, but route layout must not duplicate those dimensions in formulas such as `CTA height + 58px` or `100dvh - 68px`.

## Browser chrome behavior

- Header stays fixed to the live visual viewport top.
- Mobile Bottom Navigation stays fixed to the live visual viewport bottom.
- Product Route Action / CTA stays fixed to the live visual viewport bottom.
- Route content clears the measured Header and the active measured bottom chrome.
- Section full-height browsing uses live viewport height minus the measured Bottom Navigation.
- PWA install UI clears both browser viewport insets and the measured Bottom Navigation.
- `theme-color` follows the current page background token so browser/system chrome visually blends with the active light or dark theme.

## Interactive widgets

The Storefront viewport metadata requests `interactive-widget=resizes-content`. The runtime still listens to VisualViewport changes because browser support and mobile browser behavior vary.

Messages and other input-heavy routes must keep the 16px mobile input font floor and Safe Area handling. Keyboard/browser geometry belongs to the viewport runtime rather than per-page focus patches.

## Performance boundary

`ResizeObserver` observes only persistent App Shell chrome. A direct-child `MutationObserver` refreshes the observed targets when Shell chrome is mounted or removed. Route content DOM changes do not trigger chrome remeasurement merely because products, messages, or Markdown content changed.

## Verification

Repository contracts and production Playwright acceptance verify:

- VisualViewport runtime installation;
- measured chrome variables;
- fixed Header alignment to the visual viewport top;
- fixed Route Action alignment to the visual viewport bottom;
- Section geometry uses live viewport and measured navigation height;
- no legacy fixed-height viewport formulas return;
- no UA/device-specific viewport offset logic is introduced.
