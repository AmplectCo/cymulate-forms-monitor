import { test, visit } from './fixtures';
import { choose, fillText, TEST_DATA, trialClick, waitForForm } from './helpers/gf';

const PATH = '/cymulate-customer-technical-workshop-india/';

test('Customer Technical Workshop India form (form 15) can be filled and Register is clickable', { annotation: [{ type: 'label', description: 'Workshop India form' }, { type: 'page', description: PATH }] }, async ({ page }) => {
  await visit(page, PATH);
  const form = await waitForForm(page, 15);

  await fillText(form, { label: 'Full Name', id: 'input_15_3' }, `${TEST_DATA.firstName} ${TEST_DATA.lastName}`);
  await fillText(form, { label: 'Business Email', id: 'input_15_6' }, TEST_DATA.email);
  await fillText(form, { label: 'Phone Number', id: 'input_15_21' }, TEST_DATA.phone);
  await fillText(form, { label: 'Company Name', id: 'input_15_22' }, TEST_DATA.company);
  await choose(form, { label: 'Country', id: 'input_15_25' }, TEST_DATA.country);
  await choose(form, { label: 'State', id: 'input_15_24' }, TEST_DATA.state);

  await trialClick(form.locator('#gform_submit_button_15'));
});
