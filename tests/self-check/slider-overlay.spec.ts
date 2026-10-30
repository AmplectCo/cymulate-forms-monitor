import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test, visit } from '../fixtures';
import { findCoveredElements } from '../helpers/clickability';
import { clickNext, DEMO_PATH, fillStepOne, openDemoForm } from '../helpers/demo-form';

// Negative control, local only: the peek reviews slider stylesheet from before the fix, whose
// transparent section covered the bottom of the stacked demo form (Next included) below 1025px.
const BUGGY_CSS = readFileSync(join(__dirname, 'reviews-slider-wide.buggy.css'), 'utf8');

async function serveBuggySliderCss(page: Page): Promise<() => number> {
  let served = 0;
  await page.route('**/cy-reviews-slider-wide/assets/block.css*', (route) => {
    served++;
    return route.fulfill({ contentType: 'text/css', body: BUGGY_CSS });
  });
  return () => served;
}

test.describe('self-check: the demo test catches the slider overlay', () => {
  test('Next is blocked on stacked layouts and works on desktop', async ({ page }) => {
    const served = await serveBuggySliderCss(page);
    await visit(page, DEMO_PATH);
    const form = await openDemoForm(page);
    expect(served(), 'the buggy stylesheet was not requested').toBeGreaterThan(0);
    await fillStepOne(form);

    if (page.viewportSize()!.width < 1025) {
      await expect(clickNext(page, form)).rejects.toThrow(/cy-reviews-slider-wide[^\n]*intercepts pointer events/);
    } else {
      await clickNext(page, form);
    }
  });

  test('the clickability sweep reports Next on stacked layouts only', async ({ page }) => {
    test.setTimeout(240_000);
    const served = await serveBuggySliderCss(page);
    await visit(page, DEMO_PATH);
    await page.waitForLoadState('load');
    expect(served(), 'the buggy stylesheet was not requested').toBeGreaterThan(0);

    const { findings } = await findCoveredElements(page);
    if (page.viewportSize()!.width < 1025) {
      expect(findings).toContainEqual({
        element: expect.stringContaining('Next'),
        blockedBy: expect.stringContaining('cy-reviews-slider-wide'),
      });
    } else {
      expect(findings).toEqual([]);
    }
  });
});
