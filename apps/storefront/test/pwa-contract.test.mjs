import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const pwaSource = await readFile(
  new URL('../src/PwaInstallPrompt.tsx', import.meta.url),
  'utf8',
);
const supportPushSource = await readFile(
  new URL('../src/support-push.ts', import.meta.url),
  'utf8',
);
const messagesPageSource = await readFile(
  new URL('../src/MessagesPage.tsx', import.meta.url),
  'utf8',
);
const adminThemeSource = await readFile(
  new URL('../../admin/src/ThemeCenterView.tsx', import.meta.url),
  'utf8',
);
const themeRuntimeSource = await readFile(
  new URL('../src/theme-runtime.ts', import.meta.url),
  'utf8',
);
const manifestSource = await readFile(
  new URL('../../worker/src/routes/public-pwa.ts', import.meta.url),
  'utf8',
);
const workerSource = await readFile(
  new URL('../../worker/src/index.ts', import.meta.url),
  'utf8',
);
const pwaCss = await readFile(new URL('../src/pwa.css', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const defaultPwaIcon = await readFile(
  new URL('../public/icons/app-icon-512.png', import.meta.url),
);

test('storefront declares installable app metadata', () => {
  assert.match(indexSource, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(indexSource, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(indexSource, /viewport-fit=cover/);
  assert.match(indexSource, /rel="apple-touch-icon"/);
});

test('storefront registers a root-scoped service worker and install UI', () => {
  assert.match(mainSource, /serviceWorker\s*\.register\('\/sw\.js', \{ scope: '\/' \}\)/);
  assert.match(
    mainSource,
    /<PwaInstallPrompt themePromise=\{storefrontThemePromise\} \/>/,
  );
  assert.match(pwaSource, /beforeinstallprompt/);
  assert.match(pwaSource, /config\.installLabel/);
  assert.match(pwaSource, /config\.iosDescription/);
});

test('install UI follows Theme Center delay and respects dismissal', () => {
  assert.match(pwaSource, /config\.delaySeconds \* 1_000/);
  assert.match(pwaSource, /document\.visibilityState === 'visible'/);
  assert.match(pwaSource, /visibilitychange/);
  assert.match(pwaSource, /DISMISS_COOLDOWN_MS/);
  assert.match(pwaSource, /appinstalled/);
  assert.match(adminThemeSource, /安装应用提示/);
  assert.match(adminThemeSource, /setInstallPrompt/);
  assert.match(adminThemeSource, /delaySeconds/);
});

test('PWA and browser chrome colors follow the active storefront theme', () => {
  assert.match(manifestSource, /getThemeSettings/);
  assert.match(manifestSource, /resolveTheme/);
  assert.match(manifestSource, /backgroundColor: theme\.tokens\.pageBg/);
  assert.match(manifestSource, /themeColor: theme\.tokens\.brand/);
  assert.match(manifestSource, /background_color: theme\.backgroundColor/);
  assert.match(manifestSource, /theme_color: theme\.themeColor/);
  assert.match(themeRuntimeSource, /syncThemeColor\(theme\.tokens\.brand\)/);
});

test('PWA icons follow the configured logo with a safe default fallback', () => {
  assert.match(indexSource, /href="\/api\/public\/pwa\/icon\/192"/);
  assert.match(pwaSource, /src="\/api\/public\/pwa\/icon\/192"/);
  assert.match(manifestSource, /src: '\/api\/public\/pwa\/icon\/192'/);
  assert.match(manifestSource, /src: '\/api\/public\/pwa\/icon\/512'/);
  assert.match(manifestSource, /logo\.mime_type LIKE 'image\/%'/);
  assert.match(manifestSource, /format: 'image\/png'/);
  assert.match(manifestSource, /PWA_ICON_SAFE_AREA_RATIO/);
  assert.match(manifestSource, /loadDefaultIconStream/);
  assert.match(manifestSource, /app-icon-512\.png/);
  assert.deepEqual([...defaultPwaIcon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(
    workerSource,
    /app\.get\('\/api\/public\/pwa\/icon\/:size', servePwaIcon\)/,
  );
});

test('standalone mode uses safe areas and removes floating browser-like tab bar spacing', () => {
  assert.match(pwaCss, /@media \(display-mode: standalone\)/);
  assert.match(pwaCss, /safe-area-inset-top/);
  assert.match(pwaCss, /\.bottom-nav[\s\S]*bottom: 0/);
});

test('service worker does not cache public business APIs', () => {
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/public\/'\)/);
  assert.match(serviceWorker, /request\.mode === 'navigate'/);
});

test('Messages enables background Web Push only after explicit notification permission', () => {
  assert.match(supportPushSource, /Notification\.requestPermission\(\)/);
  assert.match(supportPushSource, /pushManager\.subscribe/u);
  assert.match(supportPushSource, /\/push\/subscriptions/u);
  assert.match(supportPushSource, /conversationId: remoteConversationId/u);
  assert.match(messagesPageSource, /enableSupportPush/u);
  assert.match(messagesPageSource, /messages-push-toggle/u);
  assert.match(messagesPageSource, /syncSupportPushSubscription/u);
});

test('service worker wakes for push, refreshes unread state, badges the app, and deep-links notifications', () => {
  assert.match(serviceWorker, /addEventListener\('push'/u);
  assert.match(serviceWorker, /showNotification/u);
  assert.match(serviceWorker, /setAppBadge/u);
  assert.match(serviceWorker, /addEventListener\('notificationclick'/u);
  assert.match(serviceWorker, /\/conversations/u);
  assert.match(serviceWorker, /\/messages\/\$\{encodeURIComponent\(wrapped\)\}\//u);
  assert.match(serviceWorker, /RETAINED_CACHES/u);
  assert.match(messagesPageSource, /syncSupportAppBadge\(unreadMessages\)/u);
});
