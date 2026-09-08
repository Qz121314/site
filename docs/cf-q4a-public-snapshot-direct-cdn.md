# CF-Q4A public snapshot direct-CDN contract

Storefront bootstrap may read published JSON directly from an R2 Custom Domain / CDN when the build provides `VITE_PUBLIC_CONTENT_ORIGIN`.

The value is a release/build-time configuration contract. Storefront source must not hardcode a production hostname, and runtime startup must not discover this origin through D1 or a Worker endpoint.

Normal bootstrap path:

1. `<VITE_PUBLIC_CONTENT_ORIGIN>/public/current.json`
2. `<VITE_PUBLIC_CONTENT_ORIGIN>/public/bootstrap/<pointerVersion>/bootstrap.json`

The browser validates HTTP/challenge state, JSON content type and parsing, pointer schema, published bootstrap protocol readability, pointer-version consistency, module envelopes, and required published runtime payload before accepting the direct result.

If direct transport is unavailable or invalid, Storefront falls back once to same-origin `/api/public/storefront/bootstrap`. That endpoint is the bounded R2-only fallback. If it cannot return a valid published bootstrap, startup fails closed; legacy runtime reconstruction through `media-base-url`, theme, or bottom-navigation endpoints is not permitted.

`public/current.json` keeps short-cache/revalidation publication semantics. Versioned `public/bootstrap/<version>/bootstrap.json` remains immutable and long-cacheable. Existing R2 CORS (`GET`/`HEAD`) is sufficient for the cross-origin JSON reads.

Production release configuration must expose the active public R2/CDN origin through the GitHub Actions Repository Variable `VITE_PUBLIC_CONTENT_ORIGIN`. The main release workflow injects that variable into the pipeline environment before `pnpm verify`, so the Storefront production Vite build receives it directly. When a production deploy is required (or explicitly forced), the workflow validates the value before the build and fails fast if it is missing, malformed, non-HTTPS, contains credentials/query/hash, or contains a non-root path.

Local development and PR validation may omit the variable and use the bounded same-origin Worker bootstrap fallback. A production deploy may not silently roll out without the configured direct-CDN origin. Browser startup must never discover the value from production D1.

This phase does not change `/_image/*`, `/_media/*`, `/public/search/*`, bootstrap schema versions, publisher pointer-last ordering, or production Cloudflare configuration.
