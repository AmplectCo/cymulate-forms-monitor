import { test, visit } from './fixtures';
import { acceptTerms, choose, fillText, TEST_DATA, trialClick, waitForForm } from './helpers/gf';

test('Contact Us form (form 3) can be filled and Submit is clickable', { tag: '@smoke' }, async ({ page }) => {
  await visit(page, '/contact-us/');
  const form = await waitForForm(page, 3);

  await fillText(form, { label: 'First Name', id: 'input_3_3' }, TEST_DATA.firstName);
  await fillText(form, { label: 'Last Name', id: 'input_3_4' }, TEST_DATA.lastName);
  await fillText(form, { label: 'Business Email', id: 'input_3_6' }, TEST_DATA.email);
  await fillText(form, { label: 'Company Name', id: 'input_3_10' }, TEST_DATA.company);
  await choose(form, { label: 'Country', id: 'input_3_21' }, TEST_DATA.country);
  await choose(form, { label: 'State', id: 'input_3_23' }, TEST_DATA.state);
  await choose(form, { label: 'Website Inquiry Type', id: 'input_3_19' }, 'Contact Sales');
  await fillText(form, { label: 'Please leave us message', id: 'input_3_20' }, TEST_DATA.message);
  await acceptTerms(form, 'choice_3_26_1');

  await trialClick(form.locator('#gform_submit_button_3'));
});
