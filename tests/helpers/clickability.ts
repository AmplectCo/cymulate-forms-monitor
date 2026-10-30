import type { Locator, Page } from '@playwright/test';

// Floating widgets that legitimately sit over the content; users scroll past them
const FLOATING_WIDGETS = [
  '#INDmenu-btn',
  '#ot-sdk-btn-floating',
  '.grecaptcha-badge',
  '[id*="salespeak" i]',
  '[class*="salespeak" i]',
];

// Carousel slides and screen-reader-only parts are hidden on purpose
const SKIP_INSIDE = '.swiper, [aria-hidden="true"], [inert], .gform_validation_container';

const CANDIDATES = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], summary';

export type Finding = { element: string; blockedBy: string };

// Serialized into the page, so it must stay self-contained
function shownToUser(el: Element, skipInside: string): boolean {
  if (el.closest(skipInside) || (el as HTMLInputElement).disabled) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  // Clipped by an overflow:hidden ancestor (closed accordions, tickers)
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (!/hidden|clip/.test(style.overflowX + style.overflowY)) continue;
    const box = parent.getBoundingClientRect();
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) return false;
  }
  return true;
}

// Trial clicks move the pointer too, so hover-driven blocks (expanding cards, menus) change state
// along the way; each element is judged by what the page shows once the pointer is out of the way.
async function settle(page: Page): Promise<void> {
  await page.mouse.move(1, 1);
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]),
  );
}

export async function findCoveredElements(page: Page, root = 'main'): Promise<{ checked: number; findings: Finding[] }> {
  await page.addStyleTag({ content: `${FLOATING_WIDGETS.join(', ')} { pointer-events: none !important; }` });

  const total = await page
    .locator(root)
    .first()
    .locator(CANDIDATES)
    .evaluateAll((elements) => {
      elements.forEach((el, index) => el.setAttribute('data-e2e-sweep', String(index)));
      return elements.length;
    });

  let checked = 0;
  const findings: Finding[] = [];
  for (let i = 0; i < total; i++) {
    const target = page.locator(`[data-e2e-sweep="${i}"]`);
    await settle(page);
    if (!(await target.evaluate(shownToUser, SKIP_INSIDE).catch(() => false))) continue;
    checked++;
    try {
      await target.click({ trial: true, timeout: 3_000 });
    } catch (error) {
      const blockedBy = interceptorOf(String(error));
      if (blockedBy) findings.push({ element: await describe(target), blockedBy });
    }
  }
  return { checked, findings };
}

// Other failures (element detached, still animating) are not overlaps and are left out
function interceptorOf(message: string): string | undefined {
  const lines = message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .filter((line) => line.includes('intercepts pointer events'));
  return lines.at(-1)?.trim().replace(/^- /, '');
}

async function describe(target: Locator): Promise<string> {
  return target.evaluate((el) => {
    const href = el.getAttribute('href');
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const name = text || (el as HTMLInputElement).value || el.getAttribute('aria-label') || el.id;
    return `<${el.tagName.toLowerCase()}${href ? ` href="${href}"` : ''}> ${name}`;
  });
}
