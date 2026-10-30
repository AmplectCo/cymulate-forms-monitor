import { expect, type Locator, type Page } from '@playwright/test';

export const TEST_DATA = {
  firstName: 'QA',
  lastName: 'E2E',
  email: 'qa-e2e@dizzain.com',
  phone: '+1 212 555 0100',
  jobTitle: 'QA Engineer',
  company: 'QA E2E',
  country: 'United States',
  state: 'New York',
  message: 'Automated UI check, please ignore.',
  rep: 'QA E2E',
};

// Label text with the Gravity Forms input id as a fallback when the label changes
export type Field = { label: string; id: string };

export async function waitForForm(page: Page, formId: number): Promise<Locator> {
  const form = page.locator(`#gform_${formId}`);
  await expect(form).toBeVisible();
  await page.waitForFunction(() => (window as any).gform?.scriptsLoaded === true);
  return form;
}

function locate(form: Locator, field: Field): Locator {
  return form.getByLabel(field.label).or(form.locator(`#${field.id}`));
}

// fill() and selectOption() skip the hit-target check, so tap the field first like a user would
export async function fillText(form: Locator, field: Field, value: string): Promise<void> {
  const input = locate(form, field);
  await input.click({ trial: true });
  // A field that scripts reset once while the page finishes loading gets typed again; one that keeps
  // losing its value still fails
  await expect(async () => {
    if ((await input.inputValue()) !== value) await input.fill(value);
    await expect(input).toHaveValue(value, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

export async function choose(form: Locator, field: Field, option: string): Promise<void> {
  const select = locate(form, field);
  await select.click({ trial: true });
  await select.selectOption({ label: option });
  await expect(select).toHaveValue(option);
}

// The input is display:none and the box is the label's ::before; its middle links to the privacy policy
export async function acceptTerms(form: Locator, checkboxId: string): Promise<void> {
  const label = form
    .locator('label', { hasText: 'I accept the Privacy Policy' })
    .or(form.locator(`label[for="${checkboxId}"]`));
  // Playwright scrolls just enough to show it, which can leave the box under the bottom edge
  // Instant: the site scrolls smoothly, and a click mid-scroll can miss the box
  await label.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await label.check({ position: { x: 10, y: 9 } });
  await expect(form.locator(`#${checkboxId}`)).toBeChecked();
}

// Never submits: the trial click only runs the actionability checks, overlap included
export async function trialClick(button: Locator): Promise<void> {
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click({ trial: true });
}
