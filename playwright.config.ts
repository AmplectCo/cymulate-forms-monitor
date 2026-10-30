import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, IS_LOCAL, UA_MARKER } from './tests/env';

const CI = !!process.env.CI;

function device(name: string) {
  const descriptor = devices[name];
  return { ...descriptor, userAgent: `${descriptor.userAgent} ${UA_MARKER}` };
}

export default defineConfig({
  testDir: './tests',
  // The negative control (old slider CSS) runs against the local copy only
  testIgnore: IS_LOCAL ? undefined : '**/self-check/**',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : 4,
  reporter: CI
    ? [['list'], ['github'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: IS_LOCAL,
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    // One trace per failed test, not per retry; its screencast stands in for a video
    trace: 'retain-on-first-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'iphone', use: device('iPhone 15') },
    { name: 'pixel', use: device('Pixel 7') },
    { name: 'ipad', use: device('iPad (gen 7)') },
    { name: 'desktop-chrome', use: device('Desktop Chrome') },
    { name: 'desktop-firefox', use: device('Desktop Firefox') },
    { name: 'desktop-safari', use: device('Desktop Safari') },
  ],
});
