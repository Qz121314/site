# CF-Q4A public snapshot direct-CDN contract

Storefront public content keeps the Admin-published `site.runtime.mediaBaseUrl` as the single source of truth for the active R2 Custom Domain / CDN origin. Production does not require a duplicate GitHub Actions or Vite variable containing the same hostname.

## Bootstrap path

A browser with no cached public-content origin uses the existing same-origin `/api/public/storefront/bootstrap` once. That endpoint reads only the published R2 pointer/bootstrap snapshots; it does not reconstruct bootstrap state from D1. The valid Worker bootstrap already contains the Admin-published `mediaBaseUrl`, which Storefront normalizes and caches locally as the direct public-content origin.

After the origin is learned, normal bootstrap is:

1. `<cached Admin-published origin>/public/current.json`
2. `<cached Admin-published origin>/public/bootstrap/<pointerVersion>/bootstrap.json`

The warm path does not call `/api/public/*`. The browser validates HTTP/challenge state, JSON content type and parsing, pointer schema, published bootstrap protocol readability, pointer-version consistency, module envelopes, and required published runtime payload before accepting the direct result.

If the cached CDN origin is stale, unavailable, challenged, or serves an invalid bootstrap, Storefront clears that learned origin and falls back once to same-origin `/api/public/storefront/bootstrap`. A valid fallback refreshes the cached origin from its published `mediaBaseUrl`, so an Admin R2-domain change self-heals without a GitHub configuration change or a Storefront rebuild. If the Worker cannot return a valid published bootstrap, startup fails closed; legacy runtime reconstruction through `media-base-url`, theme, or bottom-navigation endpoints is not permitted.

`public/current.json` keeps short-cache/revalidation publication semantics. Versioned `public/bootstrap/<version>/bootstrap.json` remains immutable and long-cacheable. Existing R2 CORS (`GET`/`HEAD`) is sufficient for the cross-origin JSON reads.

## Request/resource budget

Cold browser with no learned origin:

- Worker: 1 bounded `/api/public/storefront/bootstrap` invocation
- D1: 0 reads
- R2: published pointer/bootstrap reads owned by the Worker bootstrap

Warm browser with a healthy learned origin:

- Worker: 0
- D1: 0
- Browser: direct CDN reads of `public/current.json` and the immutable versioned bootstrap

Stale-origin recovery is bounded to one failed direct attempt plus one R2-only Worker bootstrap, after which the new Admin-published origin is cached.

`VITE_PUBLIC_CONTENT_ORIGIN` is not a required production configuration contract. The release validator tolerates it being absent; a supplied value is only syntax-checked as a safe HTTPS root origin and Storefront production runtime does not read it.

This phase does not change `/_image/*`, `/_media/*`, `/public/search/*`, bootstrap schema versions, publisher pointer-last ordering, or the Admin ownership of R2 custom-domain configuration.
