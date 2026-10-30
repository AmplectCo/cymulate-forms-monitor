import { expect, test, visit } from './fixtures';
import { acceptTerms, choose, fillText, TEST_DATA, trialClick, waitForForm } from './helpers/gf';

const PATH = '/healthcare-hub/';

test.describe('Healthcare hub forms', () => {
  test('inline demo form (form 4) can be filled and Submit is clickable', { annotation: [{ type: 'label', description: 'Healthcare demo form' }, { type: 'page', description: PATH }] }, async ({ page }) => {
    await visit(page, PATH);
    const form = await waitForForm(page, 4);

    await fillText(form, { label: 'First Name', id: 'input_4_3' }, TEST_DATA.firstName);
    await fillText(form, { label: 'Last Name', id: 'input_4_4' }, TEST_DATA.lastName);
    await fillText(form, { label: 'Business Email', id: 'input_4_6' }, TEST_DATA.email);
    await choose(form, { label: 'Country', id: 'input_4_20' }, TEST_DATA.country);
    await choose(form, { label: 'State', id: 'input_4_19' }, TEST_DATA.state);
    await acceptTerms(form, 'choice_4_24_1');

    await trialClick(form.locator('#gform_submit_button_4'));
  });

  // The popup only opens; opening it sends nothing
  test('popup demo form (form 5) opens from Book a Demo, can be filled and Submit is clickable', { annotation: [{ type: 'label', description: 'Healthcare popup form' }, { type: 'page', description: PATH }] }, async ({ page }) => {
    await visit(page, PATH);
    // Kadence swaps the trigger's href="#book-a-demo" for data-modal-open once its script runs
    const trigger = page.locator('[data-modal-open="book-a-demo"]').first();
    await trialClick(trigger);
    await trigger.click();
    await expect(page.locator('#book-a-demo')).toHaveAttribute('aria-hidden', 'false');
    const form = await waitForForm(page, 5);

    await fillText(form, { label: 'First Name', id: 'input_5_3' }, TEST_DATA.firstName);
    await fillText(form, { label: 'Last Name', id: 'input_5_4' }, TEST_DATA.lastName);
    await fillText(form, { label: 'Business Email', id: 'input_5_6' }, TEST_DATA.email);
    await choose(form, { label: 'Country', id: 'input_5_20' }, TEST_DATA.country);
    await choose(form, { label: 'State', id: 'input_5_19' }, TEST_DATA.state);
    await acceptTerms(form, 'choice_5_24_1');

    await trialClick(form.locator('#gform_submit_button_5'));
  });
});
