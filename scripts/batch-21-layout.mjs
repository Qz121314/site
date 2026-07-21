import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Expected ${label} pattern was not found.`);
  return next;
}

function update(path, transform) {
  const source = readFileSync(path, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`No changes generated for ${path}`);
  writeFileSync(path, next);
}

update("src/components/public/HeroCarousel.astro", (source) => replaceRequired(
  source,
  `  .hero-dots {\n    bottom: 0;\n    gap: 0;\n  }`,
  `  .hero-dots {\n    position: absolute;\n    z-index: 5;\n    left: 50%;\n    bottom: .45rem;\n    display: flex;\n    align-items: center;\n    gap: .08rem;\n    border: 1px solid rgba(216, 173, 97, .2);\n    border-radius: 999px;\n    padding: .08rem .18rem;\n    background: rgba(6, 6, 5, .58);\n    box-shadow: 0 8px 24px rgba(0, 0, 0, .25);\n    backdrop-filter: blur(10px);\n    transform: translateX(-50%);\n  }`,
  "Hero dots overlay",
));

update("src/lib/db/products.ts", (source) => replaceRequired(
  source,
  "export const ADMIN_PRODUCT_PAGE_SIZE = 50;",
  "export const ADMIN_PRODUCT_PAGE_SIZE = 30;",
  "admin product page size",
));

update("src/styles/admin-layout-v2.css", (source) => {
  let next = source;
  next = replaceRequired(next, "  --admin-workspace-max: 92rem;", "  --admin-workspace-max: 78rem;", "admin workspace max width");
  next = replaceRequired(next, "  --admin-workspace-narrow: 62rem;", "  --admin-workspace-narrow: 58rem;", "admin narrow width");
  next = replaceRequired(next, "  min-height: 2.15rem;\n  height: 2.15rem;", "  min-height: 2.15rem;", "fixed admin control height");
  next = replaceRequired(
    next,
    `@media (max-width: 900px) {\n  .admin-body .admin-page-header-inner {\n    align-items: flex-start;\n    flex-direction: column;\n    gap: .4rem;\n  }\n\n  .admin-body .admin-page-actions,\n  .admin-page-action-group {\n    width: 100%;\n    justify-content: flex-start;\n  }`,
    `@media (max-width: 900px) {\n  .admin-body .admin-page-header-inner {\n    gap: .5rem;\n  }\n\n  .admin-body .admin-page-actions,\n  .admin-page-action-group {\n    width: auto;\n    justify-content: flex-end;\n  }`,
    "tablet admin header layout",
  );
  next = replaceRequired(
    next,
    `@media (max-width: 639px) {\n  .admin-body .admin-page-body { padding: .6rem; }\n  .admin-page-header-inner { padding: .45rem .6rem; }`,
    `@media (max-width: 639px) {\n  .admin-body .admin-page-body { padding: .6rem; }\n  .admin-page-header-inner {\n    align-items: flex-start;\n    flex-direction: column;\n    padding: .45rem .6rem;\n  }\n  .admin-body .admin-page-actions,\n  .admin-page-action-group {\n    width: 100%;\n    justify-content: flex-start;\n  }`,
    "mobile admin header layout",
  );
  return next;
});

update("src/styles/admin-collections.css", (source) => {
  let next = source;
  next = replaceRequired(next, "  --admin-content-max: 92rem;", "  --admin-content-max: 78rem;", "admin content max width");
  next = replaceRequired(
    next,
    "  grid-template-columns: minmax(15rem, 1fr) repeat(2, minmax(9rem, 13rem)) auto;",
    "  grid-template-columns: minmax(20rem, 1.8fr) minmax(8rem, .45fr) minmax(9rem, .55fr) auto;",
    "admin filter column proportions",
  );
  return next;
});

update("src/styles/global.css", (source) => {
  let next = source;
  next = replaceRequired(
    next,
    `  width: var(--admin-sidebar-compact);\n  flex-direction: column;`,
    `  width: var(--admin-sidebar-compact);\n  overflow: hidden;\n  flex-direction: column;`,
    "sidebar overflow",
  );
  next = replaceRequired(
    next,
    `  min-height: 0;\n  overflow-y: auto;`,
    `  min-height: 0;\n  overflow-x: hidden;\n  overflow-y: auto;`,
    "sidebar navigation overflow",
  );
  next = replaceRequired(
    next,
    `  width: 100%;\n  min-width: 0;\n  height: 2.05rem;`,
    `  width: 100%;\n  min-width: 0;\n  min-height: 2.05rem;`,
    "global fixed control height",
  );
  return next;
});

const conversionStyle = `<style>
  .conversion-page { display: grid; width: min(100%, 74rem); gap: .7rem; margin: 0 auto; }
  .conversion-workspace { display: grid; gap: .7rem; align-items: start; }
  .conversion-master { overflow: hidden; }
  .conversion-master-header { min-height: 2.8rem; }
  .conversion-master-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 14rem)); justify-content: start; gap: .4rem; padding: .55rem; }
  .conversion-master-item { display: grid; width: 100%; min-width: 0; gap: .2rem; border: 1px solid #e2e8f0; border-radius: .55rem; padding: .58rem .62rem; color: #334155; background: #ffffff; cursor: pointer; text-align: left; }
  .conversion-master-item:hover { border-color: #cbd5e1; background: #f8fafc; }
  .conversion-master-item.is-active { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; }
  .conversion-master-title { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .5rem; }
  .conversion-master-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .conversion-master-meta { color: #64748b; font-size: .72rem; }
  .status-dot { width: .48rem; flex: 0 0 .48rem; aspect-ratio: 1; border-radius: 999px; background: #94a3b8; }
  .status-dot.is-enabled { background: #16a34a; }
  .status-dot.is-disabled { background: #dc2626; }
  .conversion-detail-stack { width: min(100%, 68rem); min-width: 0; }
  .conversion-detail[hidden] { display: none; }
  .conversion-detail { overflow: hidden; }
  .conversion-detail-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: .45rem; padding: .6rem; border-bottom: 1px solid var(--admin-border); background: #f8fafc; }
  .group-settings-form { display: grid; grid-template-columns: minmax(12rem, 1.5fr) minmax(6.5rem, .55fr) auto auto auto; align-items: end; gap: .4rem; min-width: 0; }
  .group-stat { display: grid; align-content: center; gap: .05rem; padding-bottom: .15rem; }
  .group-stat span { color: #64748b; font-size: .68rem; white-space: nowrap; }
  .group-stat strong { font-size: .82rem; }
  .group-delete-form { align-self: end; }
  .resource-section-header { display: flex; min-height: 3.2rem; align-items: center; justify-content: space-between; gap: .75rem; padding: .55rem .65rem; }
  .resource-section-header > div { display: flex; align-items: baseline; gap: .45rem; }
  .resource-section-header h3 { margin: 0; font-size: .9rem; }
  .resource-section-header span { color: #64748b; font-size: .72rem; }
  .resource-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 30rem), 34rem)); justify-content: start; gap: .5rem; padding: 0 .6rem .6rem; }
  .resource-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: .35rem; border: 1px solid #e2e8f0; border-radius: .55rem; padding: .45rem; background: #ffffff; }
  .resource-row-form { display: grid; grid-template-columns: minmax(5.25rem, .5fr) minmax(9rem, 1.5fr) minmax(4.5rem, .4fr) minmax(6rem, .55fr) auto; align-items: end; gap: .35rem; min-width: 0; }
  .resource-value-field input { min-width: 0; }
  .resource-delete-form { align-self: end; }
  .resource-empty { min-height: 8rem; }
  .conversion-empty .admin-collection-empty { display: grid; min-height: 16rem; place-items: center; align-content: center; gap: .55rem; }
  .conversion-empty .admin-collection-empty span { color: #64748b; }
  .dialog-form { display: grid; gap: .6rem; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: .4rem; padding-top: .15rem; }
  .resource-dialog-form { grid-template-columns: 7rem minmax(0, 1fr) 6rem 7rem; align-items: end; }
  .resource-dialog-value { min-width: 0; }
  .resource-dialog-actions { grid-column: 1 / -1; }

  @media (max-width: 980px) {
    .group-settings-form { grid-template-columns: minmax(12rem, 1fr) 7rem auto auto; }
    .group-settings-form > .button { grid-column: 1 / -1; justify-self: start; }
    .conversion-detail-header { grid-template-columns: 1fr; }
    .group-delete-form { justify-self: start; }
  }

  @media (max-width: 720px) {
    .resource-row-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .resource-value-field { grid-column: 1 / -1; }
    .resource-save { justify-self: stretch; }
  }

  @media (max-width: 639px) {
    .conversion-master-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .group-settings-form,
    .resource-row,
    .resource-row-form,
    .resource-dialog-form { grid-template-columns: 1fr; }
    .group-settings-form > .button,
    .resource-value-field,
    .resource-save,
    .resource-dialog-actions { grid-column: auto; justify-self: stretch; }
    .resource-row { gap: .45rem; }
    .resource-delete-form .button { width: 100%; }
    .resource-section-header { align-items: center; }
    .dialog-actions { display: grid; grid-template-columns: 1fr 1fr; }
  }
</style>`;

update("src/pages/admin/channels/[channelId]/conversions.astro", (source) => replaceRequired(
  source,
  /<style>\n[\s\S]*?<\/style>\s*$/u,
  conversionStyle,
  "conversion page style",
));

const adStyle = `<style>
  .ad-page { display: grid; width: min(100%, 74rem); gap: .7rem; margin: 0 auto; }
  .ad-workspace { display: grid; gap: .7rem; align-items: start; }
  .ad-master { overflow: hidden; }
  .ad-master-header { min-height: 2.8rem; }
  .ad-master-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 14rem)); justify-content: start; gap: .4rem; padding: .55rem; }
  .ad-master-item { display: grid; width: 100%; min-width: 0; gap: .2rem; border: 1px solid #e2e8f0; border-radius: .55rem; padding: .58rem .62rem; color: #334155; background: #ffffff; cursor: pointer; text-align: left; }
  .ad-master-item:hover { border-color: #cbd5e1; background: #f8fafc; }
  .ad-master-item.is-active { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; }
  .ad-master-title { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .5rem; }
  .ad-master-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ad-master-meta { color: #64748b; font-size: .72rem; }
  .status-dot { width: .48rem; flex: 0 0 .48rem; aspect-ratio: 1; border-radius: 999px; background: #94a3b8; }
  .status-dot.is-enabled { background: #16a34a; }
  .status-dot.is-disabled { background: #dc2626; }
  .ad-detail-stack { width: min(100%, 70rem); min-width: 0; }
  .ad-detail[hidden] { display: none; }
  .ad-detail { overflow: hidden; }
  .ad-detail.is-bound { border-color: #93c5fd; }
  .ad-detail-header { display: grid; grid-template-columns: minmax(10rem, .55fr) minmax(18rem, 1.25fr) auto; align-items: end; gap: .55rem; padding: .6rem; border-bottom: 1px solid var(--admin-border); background: #f8fafc; }
  .pool-heading { display: grid; align-self: center; gap: .18rem; min-width: 0; }
  .pool-heading-title { display: flex; min-width: 0; align-items: center; gap: .5rem; }
  .pool-heading h2 { min-width: 0; margin: 0; overflow: hidden; font-size: .95rem; text-overflow: ellipsis; white-space: nowrap; }
  .pool-heading > span { color: #64748b; font-size: .72rem; }
  .pool-badges { display: flex; flex-wrap: wrap; gap: .25rem; }
  .pool-settings-form { display: grid; grid-template-columns: minmax(11rem, 1fr) 7rem auto; align-items: end; gap: .4rem; min-width: 0; }
  .pool-action-bar { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .35rem; }
  .ad-section-header { display: flex; min-height: 3.2rem; align-items: center; justify-content: space-between; gap: .75rem; padding: .55rem .65rem; }
  .ad-section-header > div { display: flex; align-items: baseline; gap: .45rem; }
  .ad-section-header h3 { margin: 0; font-size: .9rem; }
  .ad-section-header span { color: #64748b; font-size: .72rem; }
  .ad-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 18rem)); justify-content: start; gap: .55rem; padding: 0 .6rem .6rem; }
  .ad-card { display: grid; min-width: 0; overflow: hidden; border: 1px solid #e2e8f0; border-radius: .65rem; background: #ffffff; }
  .ad-card-image { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #f1f5f9; }
  .ad-card-body { display: grid; min-width: 0; gap: .28rem; padding: .55rem; }
  .ad-card-title-row { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
  .ad-card-url { overflow: hidden; color: #2563eb; font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }
  .ad-card-url:hover { text-decoration: underline; }
  .ad-card-meta { color: #64748b; font-size: .72rem; }
  .ad-card-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .35rem; border-top: 1px solid #e2e8f0; padding: .45rem; background: #f8fafc; }
  .ad-card-actions .button { width: 100%; }
  .ad-list-empty { min-height: 10rem; }
  .ad-empty .admin-collection-empty { display: grid; min-height: 16rem; place-items: center; align-content: center; gap: .55rem; }
  .ad-empty .admin-collection-empty span { color: #64748b; }
  .dialog-form { display: grid; gap: .6rem; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: .4rem; padding-top: .15rem; }
  .ad-dialog-form { display: grid; grid-template-columns: minmax(0, 1fr) 8rem 6rem 7rem; align-items: end; gap: .55rem; }
  .ad-dialog-upload,
  .ad-dialog-url,
  .ad-dialog-actions { grid-column: 1 / -1; }
  .button:disabled { opacity: .38; cursor: not-allowed; }

  @media (max-width: 980px) {
    .ad-detail-header { grid-template-columns: 1fr; }
    .pool-heading { grid-row: 1; }
    .pool-settings-form { grid-row: 2; }
    .pool-action-bar { grid-row: 3; justify-content: flex-start; }
  }

  @media (max-width: 639px) {
    .ad-master-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pool-settings-form,
    .ad-dialog-form { grid-template-columns: 1fr; }
    .ad-dialog-upload,
    .ad-dialog-url,
    .ad-dialog-actions { grid-column: auto; }
    .ad-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ad-section-header { align-items: center; }
    .dialog-actions { display: grid; grid-template-columns: 1fr 1fr; }
  }
</style>`;

update("src/pages/admin/channels/[channelId]/ads.astro", (source) => replaceRequired(
  source,
  /<style>\n[\s\S]*?<\/style>\s*$/u,
  adStyle,
  "ad page style",
));

update("src/pages/admin/channels/[channelId]/products.astro", (source) => {
  let next = source;
  next = replaceRequired(
    next,
    `const statusLabels = {\n  draft: "草稿",\n  published: "已发布",\n  disabled: "已停用",\n} as const;`,
    `const statusLabels = {\n  draft: "草稿",\n  published: "已发布",\n  disabled: "已停用",\n} as const;\n\ntype PaginationToken = number | "gap";\n\nfunction buildPagination(current: number, total: number): PaginationToken[] {\n  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);\n  const pages = new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total));\n  const sorted = Array.from(pages).sort((left, right) => left - right);\n  const tokens: PaginationToken[] = [];\n  let previous = 0;\n  for (const page of sorted) {\n    if (previous > 0 && page - previous > 1) tokens.push("gap");\n    tokens.push(page);\n    previous = page;\n  }\n  return tokens;\n}\n\nconst paginationTokens = buildPagination(productPage.page, productPage.pageCount);\nconst pageStart = productPage.total === 0 ? 0 : (productPage.page - 1) * productPage.pageSize + 1;\nconst pageEnd = Math.min(productPage.total, productPage.page * productPage.pageSize);`,
    "product pagination helpers",
  );
  next = replaceRequired(next, `<div class="admin-entity-grid">`, `<div class="admin-entity-grid product-admin-grid">`, "product grid class");
  next = replaceRequired(next, `<article class="admin-entity-card product-card">`, `<article class="admin-entity-card product-card product-admin-card">`, "product card class");
  next = replaceRequired(
    next,
    `        {productPage.pageCount > 1 && (\n          <nav class="admin-pagination" aria-label="产品分页">\n            <a class:list={["button secondary", productPage.page <= 1 && "is-disabled"]} href={productPage.page > 1 ? pageHref(productPage.page - 1) : undefined}>上一页</a>\n            <span>{productPage.page} / {productPage.pageCount}</span>\n            <a class:list={["button secondary", productPage.page >= productPage.pageCount && "is-disabled"]} href={productPage.page < productPage.pageCount ? pageHref(productPage.page + 1) : undefined}>下一页</a>\n          </nav>\n        )}`,
    `        {productPage.total > 0 && (\n          <nav class="admin-pagination product-pagination" aria-label="产品分页">\n            <span class="pagination-summary">第 {pageStart}–{pageEnd} 个，共 {productPage.total} 个</span>\n            <div class="pagination-pages">\n              <a class:list={["button secondary", productPage.page <= 1 && "is-disabled"]} href={productPage.page > 1 ? pageHref(productPage.page - 1) : undefined}>上一页</a>\n              {paginationTokens.map((token) => token === "gap" ? (\n                <span class="pagination-gap" aria-hidden="true">…</span>\n              ) : (\n                <a\n                  class:list={["button secondary pagination-number", token === productPage.page && "is-current"]}\n                  href={pageHref(token)}\n                  aria-current={token === productPage.page ? "page" : undefined}\n                >{token}</a>\n              ))}\n              <a class:list={["button secondary", productPage.page >= productPage.pageCount && "is-disabled"]} href={productPage.page < productPage.pageCount ? pageHref(productPage.page + 1) : undefined}>下一页</a>\n            </div>\n          </nav>\n        )}`,
    "numbered product pagination",
  );
  next = replaceRequired(
    next,
    `</AdminLayout>`,
    `</AdminLayout>\n\n<style>\n  .product-admin-grid {\n    grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.75rem), 11rem));\n    justify-content: start;\n  }\n\n  .product-admin-card .admin-entity-media { aspect-ratio: 4 / 3; }\n  .product-admin-card .admin-entity-title { font-size: .82rem; }\n  .product-admin-card .admin-entity-actions {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    grid-auto-flow: initial;\n  }\n  .product-admin-card .admin-entity-actions .button { font-size: .75rem; }\n\n  .product-pagination {\n    justify-content: space-between;\n    gap: .75rem;\n  }\n\n  .pagination-summary { white-space: nowrap; }\n  .pagination-pages { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .3rem; }\n  .pagination-pages .button { min-width: 2.15rem; padding-right: .5rem; padding-left: .5rem; }\n  .pagination-pages .pagination-number.is-current { color: #ffffff; border-color: #2563eb; background: #2563eb; }\n  .pagination-gap { display: inline-grid; min-width: 1.4rem; place-items: center; color: #64748b; }\n\n  @media (max-width: 639px) {\n    .product-admin-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n    .product-pagination { align-items: flex-start; flex-direction: column; }\n    .pagination-pages { justify-content: flex-start; }\n  }\n</style>`,
    "product list styles",
  );
  return next;
});
