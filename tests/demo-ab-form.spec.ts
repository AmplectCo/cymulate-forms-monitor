import { test, visit } from './fixtures';
import { acceptTerms, choose, fillText, TEST_DATA, trialClick, waitForForm } from './helpers/gf';

const PATH = '/schedule-a-demo-a-b/';

test('Request a Demo A/B form (form 12) can be filled and Submit is clickable', { annotation: [{ type: 'label', description: 'Demo A/B form' }, { type: 'page', description: PATH }] }, async ({ page }) => {
  await visit(page, PATH);
  const form = await waitForForm(page, 12);

  await fillText(form, { label: 'First Name', id: 'input_12_3' }, TEST_DATA.firstName);
  await fillText(form, { label: 'Last Name', id: 'input_12_4' }, TEST_DATA.lastName);
  await fillText(form, { label: 'Business Email', id: 'input_12_6' }, TEST_DATA.email);
  await choose(form, { label: 'HQ Country', id: 'input_12_16' }, TEST_DATA.country);
  await choose(form, { label: 'HQ State', id: 'input_12_18' }, TEST_DATA.state);
  await fillText(form, { label: 'Job Title', id: 'input_12_9' }, TEST_DATA.jobTitle);
  await fillText(form, { label: 'Company', id: 'input_12_10' }, TEST_DATA.company);
  await acceptTerms(form, 'choice_12_21_1');

  await trialClick(form.locator('#gform_submit_button_12'));
});
