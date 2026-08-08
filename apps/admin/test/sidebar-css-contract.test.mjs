import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url));
const sidebarPath = path.join(sourceDirectory, 'admin-sidebar.css');
const dashboardPath = path.join(sourceDirectory, 'Dashboard.tsx');
const mainPath = path.join(sourceDirectory, 'main.tsx');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('sidebar styles have one authoritative owner', () => {
  const sidebarSource = readSource(sidebarPath);
  assert.doesNotMatch(sidebarSource, /!important/);

  const sidebarSelectors = [
    /^\s*\.admin-brand\b/m,
    /^\s*\.sidebar-section-label\b/m,
    /^\s*\.sidebar-loading\b/m,
    /^\s*\.dynamic-menu\b/m,
  ];

  const cssFiles = fs.readdirSync(sourceDirectory).filter((fileName) => fileName.endsWith('.css'));
  for (const fileName of cssFiles) {
    if (fileName === 'admin-sidebar.css') continue;
    const cssSource = readSource(path.join(sourceDirectory, fileName));
    for (const selector of sidebarSelectors) {
      assert.doesNotMatch(cssSource, selector, `${fileName} must not redefine sidebar selectors`);
    }
  }
});

test('dashboard only renders the current flat sidebar menu', () => {
  const dashboardSource = readSource(dashboardPath);
  assert.match(
    dashboardSource,
    /<div className="dynamic-menu" key=\{section\.id\}>\s*<button[\s\S]*?<\/button>\s*<\/div>/,
  );
  assert.doesNotMatch(dashboardSource, /dynamic-menu-icon/);
  assert.doesNotMatch(dashboardSource, /className=\{`dynamic-menu/);
  assert.doesNotMatch(dashboardSource, /brandingAssetPreviewUrl/);
});

test('removed legacy stylesheet is not imported', () => {
  assert.doesNotMatch(readSource(mainPath), /operating-admin\.css/);
});
