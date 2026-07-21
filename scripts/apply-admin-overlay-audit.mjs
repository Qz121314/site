import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(path, pattern, replacement, label) {
  const source = readFileSync(path, "utf8");
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Expected ${label} pattern was not found in ${path}`);
  writeFileSync(path, next);
}

replaceRequired(
  "src/styles/admin-product-workbench.css",
  /\.product-filter-dropdown \{[\s\S]*?\.product-filter-dropdown-menu \{[\s\S]*?\n\}\n\n(?=\.product-filter-dropdown-option)/u,
  "",
  "retired product dropdown styles",
);
replaceRequired(
  "src/styles/admin-product-workbench.css",
  /\n@media \(prefers-reduced-motion: reduce\) \{\n  \.product-filter-dropdown-arrow \{\n    transition: none;\n  \}\n\}\n?$/u,
  "\n",
  "retired product dropdown motion styles",
);

replaceRequired(
  "src/pages/admin/channels/[channelId]/products.astro",
  `                          data-product-management-form\n                        >`,
  `                          data-product-management-form\n                          data-admin-history="replace"\n                          data-admin-scroll="preserve"\n                        >`,
  "product management navigation policy",
);

replaceRequired(
  "src/scripts/admin-router.ts",
  `  clone.querySelectorAll<HTMLElement>("[data-product-editor-ready]").forEach((element) => {\n    delete element.dataset.productEditorReady;\n  });\n`,
  `  clone.querySelectorAll<HTMLElement>("[data-product-editor-ready]").forEach((element) => {\n    delete element.dataset.productEditorReady;\n  });\n  clone.querySelectorAll<HTMLElement>("[data-admin-popover-trigger]").forEach((trigger) => {\n    trigger.setAttribute("aria-expanded", "false");\n  });\n  clone.querySelectorAll<HTMLElement>("[data-admin-popover-panel]").forEach((panel) => {\n    delete panel.dataset.adminPopoverFallbackOpen;\n    panel.removeAttribute("style");\n  });\n`,
  "popover snapshot cleanup",
);
replaceRequired(
  "src/scripts/admin-router.ts",
  `  const wasDirty = form.dataset.adminDirty === "1";\n  form.dataset.adminDirty = "0";\n  setLoading(true);`,
  `  const wasDirty = form.dataset.adminDirty === "1";\n  const preserveScroll = form.dataset.adminScroll === "preserve";\n  const replaceHistory = form.dataset.adminHistory === "replace";\n  const scrollPosition = { left: window.scrollX, top: window.scrollY };\n  form.dataset.adminDirty = "0";\n  setLoading(true);`,
  "form navigation policy state",
);
replaceRequired(
  "src/scripts/admin-router.ts",
  `    storeSnapshot(snapshot);\n    applySnapshot(snapshot, true);\n    history.pushState({ admin: true }, "", snapshot.url);`,
  `    storeSnapshot(snapshot);\n    applySnapshot(snapshot, !preserveScroll);\n    if (replaceHistory) history.replaceState({ admin: true }, "", snapshot.url);\n    else history.pushState({ admin: true }, "", snapshot.url);\n    if (preserveScroll) {\n      requestAnimationFrame(() => window.scrollTo({ ...scrollPosition, behavior: "auto" }));\n    }`,
  "form history and scroll policy",
);

replaceRequired(
  "src/styles/admin-workflow.css",
  /\n\.admin-body \.product-entry \{[\s\S]*?(?=\.admin-body \.compact-check \{)/u,
  "\n",
  "retired product entry layout",
);
replaceRequired(
  "src/styles/admin-workflow.css",
  /\n\.admin-body \.product-workspace \{[\s\S]*?(?=\.admin-body \.body-preview summary)/u,
  "\n",
  "retired product workspace layout",
);
replaceRequired(
  "src/styles/admin-workflow.css",
  /\n@media \(max-width: 1100px\) \{[\s\S]*?\n\}\n/u,
  "\n",
  "retired product 1100px layout",
);
replaceRequired(
  "src/styles/admin-workflow.css",
  /\n@media \(max-width: 900px\) \{[\s\S]*?\n\}\n/u,
  "\n",
  "retired product 900px layout",
);
replaceRequired(
  "src/styles/admin-workflow.css",
  /\n@media \(max-width: 639px\) \{\n  \.admin-body \.product-basic-grid \{ grid-template-columns: 1fr; \}\n  \.admin-body \.product-basic-grid > \* \{ grid-column: 1; grid-row: auto; \}\n\}\n?$/u,
  "\n",
  "retired product mobile layout",
);
