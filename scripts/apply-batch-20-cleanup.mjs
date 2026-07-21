import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Expected ${label} pattern was not found.`);
  return next;
}

function removeAll(source, patterns) {
  let next = source;
  for (const [pattern, label] of patterns) {
    next = replaceRequired(next, pattern, "", label);
  }
  return next;
}

const publicDbPath = "src/lib/db/public.ts";
let publicDb = readFileSync(publicDbPath, "utf8");
publicDb = removeAll(publicDb, [
  [/^  allFilterLabel: string;\n/mu, "public All label type"],
  [/^  all_filter_label: string;\n/mu, "public All label row"],
  [/^    allFilterLabel: "All",\n/mu, "public All label default"],
  [/^         s\.all_filter_label,\n/mu, "public All label select"],
  [/^      allFilterLabel: first\.all_filter_label \|\| "All",\n/mu, "public All label mapping"],
]);
writeFileSync(publicDbPath, publicDb);

const siteDbPath = "src/lib/db/site.ts";
let siteDb = readFileSync(siteDbPath, "utf8");
siteDb = removeAll(siteDb, [
  [/^  allFilterLabel: string;\n/mu, "admin All label type"],
  [/^  all_filter_label: string;\n/mu, "admin All label row"],
  [/^  allFilterLabel: "All",\n/mu, "admin All label default"],
  [/^         all_filter_label,\n/mu, "admin All label select"],
  [/^      allFilterLabel: row\.all_filter_label,\n/mu, "admin All label mapping"],
]);
writeFileSync(siteDbPath, siteDb);

const middlewarePath = "src/middleware.ts";
let middleware = readFileSync(middlewarePath, "utf8");
middleware = replaceRequired(middleware, /^         s\.all_filter_label,\n/mu, "", "readiness All label select");
writeFileSync(middlewarePath, middleware);

const publicCssPath = "src/styles/public.css";
let publicCss = readFileSync(publicCssPath, "utf8");
publicCss = replaceRequired(
  publicCss,
  /\n\.contact-reveal \{[\s\S]*?\n\}\n(?=\n\.product-cta-button \{)/u,
  "\n",
  "legacy contact reveal CSS",
);
writeFileSync(publicCssPath, publicCss);

const adminCssPath = "src/styles/admin-workflow.css";
let adminCss = readFileSync(adminCssPath, "utf8");
adminCss = replaceRequired(
  adminCss,
  /\n\.admin-body \.ad-pool-summary,[\s\S]*?\.admin-body \.pool-empty \{[\s\S]*?\n\}\n/u,
  "\n",
  "legacy ad pool CSS",
);
writeFileSync(adminCssPath, adminCss);

const routerPath = "src/scripts/admin-router.ts";
let router = readFileSync(routerPath, "utf8");
router = replaceRequired(
  router,
  `  clone.querySelectorAll<HTMLElement>("[data-product-editor-ready]").forEach((element) => {\n    delete element.dataset.productEditorReady;\n  });\n`,
  `  clone.querySelectorAll<HTMLElement>("[data-product-editor-ready]").forEach((element) => {\n    delete element.dataset.productEditorReady;\n  });\n  clone.querySelectorAll<HTMLElement>("[data-conversion-page-ready]").forEach((element) => {\n    delete element.dataset.conversionPageReady;\n  });\n  clone.querySelectorAll<HTMLElement>("[data-ad-pool-page-ready]").forEach((element) => {\n    delete element.dataset.adPoolPageReady;\n  });\n  clone.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((dialog) => {\n    dialog.removeAttribute("open");\n  });\n`,
  "admin SPA runtime state cleanup",
);
writeFileSync(routerPath, router);

const formUiPath = "src/scripts/admin-form-ui.ts";
let formUi = readFileSync(formUiPath, "utf8");
formUi = replaceRequired(
  formUi,
  `  if (!(dialog instanceof HTMLDialogElement)) return false;\n\n  dialog.showModal();\n`,
  `  if (!(dialog instanceof HTMLDialogElement)) return false;\n  if (dialog.open) {\n    dialog.focus();\n    return true;\n  }\n\n  dialog.showModal();\n`,
  "dialog duplicate-open guard",
);
writeFileSync(formUiPath, formUi);
