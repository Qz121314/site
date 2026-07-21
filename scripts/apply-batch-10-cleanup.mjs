import { readFileSync, writeFileSync } from "node:fs";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const packagePath = "package.json";
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
for (const name of ["@astrojs/react", "react", "react-dom"]) {
  delete packageJson.dependencies?.[name];
}
for (const name of ["@types/react", "@types/react-dom"]) {
  delete packageJson.devDependencies?.[name];
}
writeJson(packagePath, packageJson);

const astroConfigPath = "astro.config.mjs";
let astroConfig = readFileSync(astroConfigPath, "utf8");
astroConfig = astroConfig
  .replace('import react from "@astrojs/react";\n', "")
  .replace("  integrations: [react()],\n", "");
writeFileSync(astroConfigPath, astroConfig);

const publicCssPath = "src/styles/public.css";
let publicCss = readFileSync(publicCssPath, "utf8");
publicCss = publicCss
  .replace(/\n\.hero-dots \{[\s\S]*?(?=\n\.public-bottom-nav \{)/u, "\n")
  .replace(/\n\.public-page-header \{[\s\S]*?(?=\n\.public-back-link \{)/u, "\n")
  .replace(/\n\.directory-page-header h1 \{[\s\S]*?\n\}\n\n\.product-detail-header h1 \{[\s\S]*?\n\}\n/u, "\n")
  .replace(/\n\.directory-heading,\n\.directory-count \{\n  display: none;\n\}\n/u, "\n")
  .replace(/\n  \.public-page-header \{[\s\S]*?\n  \}\n\n  \.public-page-header h1 \{[\s\S]*?\n  \}\n/u, "\n");
writeFileSync(publicCssPath, publicCss);

const publicDataPath = "src/lib/db/public.ts";
let publicData = readFileSync(publicDataPath, "utf8");
publicData = publicData.replace(/\nexport async function loadPublicSitemapEntries\(\):[\s\S]*$/u, "\n");
writeFileSync(publicDataPath, publicData);
