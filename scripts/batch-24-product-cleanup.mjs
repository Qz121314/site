import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(path, pattern, replacement, label) {
  const source = readFileSync(path, "utf8");
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Expected ${label} pattern was not found in ${path}`);
  writeFileSync(path, next);
}

for (const path of [
  "src/pages/api/admin/channels/[channelId]/products/create.ts",
  "src/pages/api/admin/channels/[channelId]/products/[productId]/update.ts",
]) {
  replaceRequired(path, "categoryId: value.categoryId,", "categoryId: null,", "content category id");
}

const routerPath = "src/scripts/admin-router.ts";
replaceRequired(
  routerPath,
  `  clone.querySelectorAll<HTMLElement>("[data-conversion-page-ready]").forEach((element) => {\n    delete element.dataset.conversionPageReady;\n  });\n  clone.querySelectorAll<HTMLElement>("[data-ad-pool-page-ready]").forEach((element) => {\n    delete element.dataset.adPoolPageReady;\n  });\n`,
  "",
  "retired pool snapshot state",
);
replaceRequired(
  routerPath,
  `    const productListMatch = linkPath.endsWith("/products")\n      && path.startsWith(\`${"${linkPath}"}/\`)\n      && path !== \`${"${linkPath}"}/new\`;\n    const nested = linkPath !== "/admin" && path.startsWith(\`${"${linkPath}"}/\`);\n    if ((exact || productListMatch || nested) && linkPath.length > bestLength) {`,
  `    const nested = linkPath !== "/admin" && path.startsWith(\`${"${linkPath}"}/\`);\n    if ((exact || nested) && linkPath.length > bestLength) {`,
  "retired product route matching",
);
