import { expect, test, type Locator } from '@playwright/test';

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

test('mobile text controls keep a 16px font floor to avoid focus zoom', async ({
  page,
}) => {
  await page.goto('/browse/');
  await expectNoFocusZoomFont(page.locator('.browse-directory-search input'));

  const sectionHref = await page
    .locator('a[href^="/sections/"]:not([href*="/products/"])')
    .first()
    .getAttribute('href');
  expect(sectionHref).toBeTruthy();

  await page.goto(sectionHref!);
  await expectNoFocusZoomFont(page.locator('.section-catalog-search input'));

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
