import { test, visit } from './fixtures';
import { acceptTerms, choose, fillText, TEST_DATA, trialClick, waitForForm } from './helpers/gf';

test('Download the Report form (form 8) can be filled and Download is clickable', async ({ page }) => {
  await visit(page, '/report/2026-gartner-market-guide-for-adversarial-exposure-validation/');
  const form = await waitForForm(page, 8);

  await fillText(form, { label: 'First Name', id: 'input_8_3' }, TEST_DATA.firstName);
  await fillText(form, { label: 'Last Name', id: 'input_8_4' }, TEST_DATA.lastName);
  await fillText(form, { label: 'Job Title', id: 'input_8_20' }, TEST_DATA.jobTitle);
  await fillText(form, { label: 'Company Name', id: 'input_8_21' }, TEST_DATA.company);
  await fillText(form, { label: 'Business Email', id: 'input_8_6' }, TEST_DATA.email);
  await choose(form, { label: 'Country', id: 'input_8_23' }, TEST_DATA.country);
  await choose(form, { label: 'State', id: 'input_8_17' }, TEST_DATA.state);
  await acceptTerms(form, 'choice_8_28_1');

  await trialClick(form.locator('#gform_submit_button_8'));
});
