import { test, visit } from './fixtures';
import { acceptTerms, fillText, TEST_DATA, trialClick, waitForForm } from './helpers/gf';

const PATH = '/xm-cyber-transition-guide/';

test('XM Cyber transition guide form (form 11) can be filled and Submit is clickable', { annotation: [{ type: 'label', description: 'XM Cyber guide form' }, { type: 'page', description: PATH }] }, async ({ page }) => {
  await visit(page, PATH);
  const form = await waitForForm(page, 11);

  await fillText(form, { label: 'First Name', id: 'input_11_3' }, TEST_DATA.firstName);
  await fillText(form, { label: 'Last Name', id: 'input_11_4' }, TEST_DATA.lastName);
  await fillText(form, { label: 'Business Email', id: 'input_11_6' }, TEST_DATA.email);
  await fillText(form, { label: 'Title', id: 'input_11_26' }, TEST_DATA.jobTitle);
  await fillText(form, { label: 'Company', id: 'input_11_27' }, TEST_DATA.company);
  await acceptTerms(form, 'choice_11_24_1');

  await trialClick(form.locator('#gform_submit_button_11'));
});
