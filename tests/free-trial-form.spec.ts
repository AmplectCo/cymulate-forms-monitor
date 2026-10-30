import { test, visit } from './fixtures';
import { acceptTerms, choose, fillText, TEST_DATA, trialClick, waitForForm } from './helpers/gf';

test('Free Trial form (form 10) can be filled and Submit is clickable', async ({ page }) => {
  await visit(page, '/free-trial/');
  const form = await waitForForm(page, 10);

  await fillText(form, { label: 'First Name', id: 'input_10_3' }, TEST_DATA.firstName);
  await fillText(form, { label: 'Last Name', id: 'input_10_4' }, TEST_DATA.lastName);
  await fillText(form, { label: 'Business Email', id: 'input_10_6' }, TEST_DATA.email);
  await choose(form, { label: 'Country', id: 'input_10_30' }, TEST_DATA.country);
  await choose(form, { label: 'State', id: 'input_10_31' }, TEST_DATA.state);
  await choose(form, { label: 'No. of Employees', id: 'input_10_19' }, '101-250');
  await choose(form, { label: 'Industry', id: 'input_10_28' }, 'Banking');
  await fillText(form, { label: 'Cymulate rep', id: 'input_10_10' }, TEST_DATA.rep);
  await acceptTerms(form, 'choice_10_27_1');

  await trialClick(form.locator('#gform_submit_button_10'));
});
