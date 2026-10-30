import { expect, test, visit } from './fixtures';
import { findCoveredElements } from './helpers/clickability';

const PAGES = [
  { path: '/schedule-a-demo/', smoke: true },
  { path: '/contact-us/' },
  { path: '/free-trial/' },
  { path: '/report/2026-gartner-market-guide-for-adversarial-exposure-validation/' },
  { path: '/validate-cisa-threats/' },
  { path: '/cowork-cisa-threats/' },
  { path: '/' },
  { path: '/platform/' },
];

test.describe('clickability sweep', () => {
  for (const { path, smoke } of PAGES) {
    test(`nothing covers clickable elements on ${path}`, { tag: smoke ? '@smoke' : [] }, async ({ page }) => {
      test.setTimeout(240_000);
      await visit(page, path);
      await page.waitForLoadState('load');

      const { checked, findings } = await findCoveredElements(page);
      test.info().annotations.push({ type: 'checked elements', description: String(checked) });
      expect(checked, 'no clickable elements found in <main>').toBeGreaterThan(0);
      const report = findings.map((f) => `• ${f.element}\n    covered by ${f.blockedBy}`).join('\n');
      expect(findings, `Covered clickable elements on ${path}:\n${report}`).toEqual([]);
    });
  }
});
