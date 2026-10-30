import { test, visit } from './fixtures';
import {
  clickNext,
  DEMO_PATH,
  fillStepOne,
  fillStepTwoAndTrySubmit,
  openDemoForm,
  showStepTwo,
} from './helpers/demo-form';

test.describe('Request a Demo form (form 1)', () => {
  test('step 1 can be filled and Next responds', { tag: '@smoke', annotation: [{ type: 'label', description: 'Demo form: step 1' }, { type: 'page', description: DEMO_PATH }] }, async ({ page }) => {
    await visit(page, DEMO_PATH);
    const form = await openDemoForm(page);
    await fillStepOne(form);
    const outcome = await clickNext(page, form);
    test.info().annotations.push({ type: 'next', description: outcome });
  });

  test('step 2 can be filled and Get a Demo is clickable', { tag: '@smoke', annotation: [{ type: 'label', description: 'Demo form: step 2' }, { type: 'page', description: DEMO_PATH }] }, async ({ page }) => {
    await visit(page, DEMO_PATH);
    const form = await openDemoForm(page);
    await fillStepOne(form);
    await showStepTwo(form);
    await fillStepTwoAndTrySubmit(form);
  });
});
