# CF-Q4A public snapshot direct-CDN contract

Storefront bootstrap may read published JSON directly from an R2 Custom Domain / CDN when the release build provides `VITE_PUBLIC_CONTENT_ORIGIN`.

The value is a release/build-time configuration contract. Storefront source must not hardcode a production hostname, and runtime startup must not discover this origin through D1 or a Worker endpoint.

Normal bootstrap path:

1. `<VITE_PUBLIC_CONTENT_ORIGIN>/public/current.json`
2. `<VITE_PUBLIC_CONTENT_ORIGIN>/public/bootstrap/<pointerVersion>/bootstrap.json`

The browser validates HTTP/challenge state, JSON content type and parsing, pointer schema, published bootstrap protocol readability, pointer-version consistency, module envelopes, and required published runtime payload before accepting the direct result.

If direct transport is unavailable or invalid, Storefront falls back once to same-origin `/api/public/storefront/bootstrap`. That endpoint is the bounded R2-only fallback. If it cannot return a valid published bootstrap, startup fails closed; legacy runtime reconstruction through `media-base-url`, theme, or bottom-navigation endpoints is not permitted.

`public/current.json` keeps short-cache/revalidation publication semantics. Versioned `public/bootstrap/<version>/bootstrap.json` remains immutable and long-cacheable. Existing R2 CORS (`GET`/`HEAD`) is sufficient for the cross-origin JSON reads.

Release configuration must expose the active public R2/CDN origin as `VITE_PUBLIC_CONTENT_ORIGIN` during the Storefront build, for example from a stable GitHub Actions or release variable wired before `pnpm verify` / the production Vite build. Browser startup must never discover the value from production D1. If the release intentionally omits the value, Storefront remains on the bounded same-origin Worker bootstrap path rather than inventing or hardcoding an origin.

This phase does not change `/_image/*`, `/_media/*`, `/public/search/*`, bootstrap schema versions, publisher pointer-last ordering, or production Cloudflare configuration.
