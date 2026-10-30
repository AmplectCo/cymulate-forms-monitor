import { expect, test, visit } from './fixtures';
import { trialClick } from './helpers/gf';

test('header demo CTA is clickable and leads to the demo page', { tag: '@smoke' }, async ({ page }) => {
  await visit(page, '/');
  const header = page.locator('header.header');
  await expect(header).toBeVisible();

  const burger = header.locator('.hamburger');
  let cta = header.locator('.header__right').getByRole('link', { name: /demo/i });

  if (await burger.isVisible()) {
    cta = page.locator('.header-mobile__cta').getByRole('link', { name: /demo/i });
    // Retried because the menu script may still be loading; the burger only toggles the menu
    await expect(async () => {
      if (!(await cta.isVisible())) await burger.click();
      await expect(cta).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
  }

  await trialClick(cta);
  const href = await cta.getAttribute('href');
  expect(new URL(href ?? '', page.url()).pathname).toBe('/schedule-a-demo/');
});
