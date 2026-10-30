import { expect, type Locator, type Page } from '@playwright/test';
import { IS_LOCAL } from '../env';
import { acceptTerms, choose, fillText, TEST_DATA, trialClick, waitForForm } from './gf';

export const DEMO_PATH = '/schedule-a-demo/';
const FORM_ID = 1;

export async function openDemoForm(page: Page): Promise<Locator> {
  return waitForForm(page, FORM_ID);
}

export async function fillStepOne(form: Locator): Promise<void> {
  await expect(form.locator('#gform_page_1_1')).toBeVisible();
  await fillText(form, { label: 'First Name', id: 'input_1_3' }, TEST_DATA.firstName);
  await fillText(form, { label: 'Last Name', id: 'input_1_4' }, TEST_DATA.lastName);
  await fillText(form, { label: 'Business Email', id: 'input_1_6' }, TEST_DATA.email);
}

export function nextButton(form: Locator): Locator {
  return form.locator('#gform_next_button_1_1');
}

// The one real click on a form: an AJAX page change that creates no entry
export async function clickNext(page: Page, form: Locator): Promise<'step-2' | 'recaptcha'> {
  // GF runs the invisible reCAPTCHA on Next too, so the widget must be ready first
  const recaptcha = form.locator('.ginput_recaptcha');
  await expect(recaptcha).toHaveAttribute('data-widget-id', /\d+/);
  if (IS_LOCAL) {
    // The production key is invalid on the local domain; GF lets Next through once it flags that
    await expect(recaptcha).toHaveAttribute('data-recaptcha-error', '1');
  }

  await nextButton(form).click();

  // Google challenges automated browsers on production, so the challenge also proves Next fired
  const stepTwo = form.locator('#gform_page_1_2');
  const challenge = page.locator('iframe[src*="/recaptcha/"][src*="/bframe"]');
  const reaction = stepTwo.or(challenge).filter({ visible: true }).first();
  await expect(reaction, 'Next did not move to step 2 or start reCAPTCHA').toBeVisible({ timeout: 30_000 });
  return (await stepTwo.isVisible()) ? 'step-2' : 'recaptcha';
}

// Step 2 cannot be reached past the reCAPTCHA challenge, so it is switched on in place the way GF shows it
export async function showStepTwo(form: Locator): Promise<void> {
  await form.evaluate((el) => {
    el.querySelector<HTMLElement>('#gform_page_1_1')!.style.display = 'none';
    el.querySelector<HTMLElement>('#gform_page_1_2')!.style.display = 'block';
  });
  await expect(form.locator('#gform_page_1_2')).toBeVisible();
}

export async function fillStepTwoAndTrySubmit(form: Locator): Promise<void> {
  await fillText(form, { label: 'Phone', id: 'input_1_8' }, TEST_DATA.phone);
  await choose(form, { label: 'HQ Country', id: 'input_1_16' }, TEST_DATA.country);
  await choose(form, { label: 'HQ State', id: 'input_1_18' }, TEST_DATA.state);
  await fillText(form, { label: 'Job Title', id: 'input_1_9' }, TEST_DATA.jobTitle);
  await fillText(form, { label: 'Company', id: 'input_1_10' }, TEST_DATA.company);
  await acceptTerms(form, 'choice_1_21_1');
  await trialClick(form.locator('#gform_submit_button_1'));
}
