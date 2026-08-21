import { expect, test, type Locator } from '@playwright/test';
import { findPublishedSectionRoute } from './published-storefront-fixtures';

async function expectNoFocusZoomFont(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    )
    .toBeGreaterThanOrEqual(16);
}

test('mobile text controls keep a 16px font floor inside the live visual viewport', async ({
  page,
  request,
}) => {
  const publishedSection = await findPublishedSectionRoute(request);
  expect(publishedSection).toBeTruthy();

  await page.goto('/browse/');
  await expectNoFocusZoomFont(page.locator('.browse-directory-search input'));

  await page.goto(publishedSection!.sectionHref);
  await expectNoFocusZoomFont(page.locator('.section-catalog-search input'));

  const viewportContract = await page.evaluate(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const runtimeHeight = Number.parseFloat(
      root.style.getPropertyValue('--app-viewport-height'),
    );
    return {
      runtimeMode: root.dataset.visualViewport,
      runtimeHeight,
      visualHeight: viewport?.height ?? window.innerHeight,
    };
  });
  expect(viewportContract.runtimeMode).toBeTruthy();
  expect(
    Math.abs(viewportContract.runtimeHeight - viewportContract.visualHeight),
  ).toBeLessThanOrEqual(1.5);

  const controlFontSizes = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    if (!shell) throw new Error('Missing app shell.');

    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.left = '-10000px';
    probe.innerHTML = `
      <input type="text" aria-label="text probe" />
      <select aria-label="select probe"><option>One</option></select>
      <textarea aria-label="textarea probe"></textarea>
    `;
    shell.append(probe);

    const controls = probe.querySelectorAll<HTMLElement>('input, select, textarea');
    const sizes = [...controls].map((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    probe.remove();
    return sizes;
  });

  expect(controlFontSizes).toHaveLength(3);
  expect(controlFontSizes.every((size) => size >= 16)).toBeTruthy();
  console.log('MOBILE_INPUT_VIEWPORT_ACCEPTANCE=passed');
});
