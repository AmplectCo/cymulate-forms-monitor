import { expect, test, visit } from './fixtures';
import { findCoveredElements } from './helpers/clickability';

// The pages that hold the monitored forms; `name` is how the page is called in the report, linked to it
const PAGES = [
  { path: '/schedule-a-demo/', name: 'Schedule a Demo', smoke: true },
  { path: '/contact-us/', name: 'Contact Us' },
  { path: '/free-trial/', name: 'Free Trial' },
  { path: '/report/2026-gartner-market-guide-for-adversarial-exposure-validation/', name: 'Gartner Report' },
  { path: '/healthcare-hub/', name: 'Healthcare Hub' },
  { path: '/schedule-a-demo-a-b/', name: 'Schedule a Demo A/B' },
  { path: '/cymulate-customer-technical-workshop-india/', name: 'Technical Workshop India' },
  { path: '/xm-cyber-transition-guide/', name: 'XM Cyber Transition Guide' },
];

test.describe('clickability sweep', () => {
  for (const { path, name, smoke } of PAGES) {
    const details = {
      tag: smoke ? '@smoke' : [],
      annotation: [
        { type: 'label', description: name },
        { type: 'page', description: path },
      ],
    };
    test(`nothing covers clickable elements on ${path}`, details, async ({ page }) => {
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
