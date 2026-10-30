# cymulate-forms-monitor

Playwright checks that the cymulate.com lead forms can actually be used on phones, tablets and desktop
browsers: every field can be tapped and filled, and the submit buttons are reachable. It exists because
an invisible overlay (the peek reviews slider, October 2026) blocked the demo form's Next button on
mobile for 2.5 weeks, and neither the Postman API monitor nor the Percy screenshots could see it.

**Nothing is ever submitted.** The tests run against production only.

## What is checked

| Spec | Page | What happens |
|---|---|---|
| `demo-form.spec.ts` (form 1) `@smoke` | `/schedule-a-demo/` | Step 1 is filled and **Next is really clicked**; step 2 is filled and "Get a Demo" gets a trial click |
| `contact-form.spec.ts` (form 3) `@smoke` | `/contact-us/` | All fields filled, Submit gets a trial click |
| `report-form.spec.ts` (form 8) | Gartner report page | Same |
| `free-trial-form.spec.ts` (form 10) | `/free-trial/` | Same |
| `header-cta.spec.ts` `@smoke` | `/` | The header "Book a Demo" button (behind the burger on mobile) is clickable and points to `/schedule-a-demo/` |
| `clickability.spec.ts` (`/schedule-a-demo/` is `@smoke`) | 8 key pages | Every visible link, button and field inside `<main>` gets a trial click |

A **trial click** (`click({ trial: true })`) runs Playwright's actionability checks, including "is this
element the one that receives the tap", without clicking. An overlay fails it with
`<…> intercepts pointer events`. Fields are trial-clicked before they are filled, because `fill()` alone
does not check for overlays.

Devices (Playwright projects): `iphone` (WebKit, iPhone 15), `pixel` (Chromium, Pixel 7), `ipad` (WebKit,
iPad gen 7), `desktop-chrome`, `desktop-firefox`, `desktop-safari`.

### Demo form and reCAPTCHA

Gravity Forms runs the invisible reCAPTCHA on Next, not only on the final submit, and Google often answers
automated browsers with an image challenge. The test never touches the challenge: Next counts as working
when the form either moves to step 2 or opens the reCAPTCHA challenge. Step 2 is then checked separately
by switching it on in place (the same markup GF shows after Next), filling it and trial-clicking
"Get a Demo".

## Safety

All of this lives in the `page` fixture in `tests/fixtures.ts`:

- **Submit guard.** Any POST that would finish a Gravity Forms submission (target page 0, or the GF REST
  API) is aborted and fails the test. Only page changes (the demo Next) go through.
- **Tracking is blocked**: Google Analytics/Ads hits, VWO, Salespeak, Leadfeeder and HubSpot scripts,
  including collected forms (it would otherwise capture the Next submit).
- **Marker**: every user agent ends with `CymulateE2E/1.0`, for log/WAF filtering.
- **Cookies**: the OneTrust banner is answered with "Reject All" whenever it shows.

Real clicks are limited to Next, the consent checkbox, the mobile burger and the cookie banner.

## Run locally

Node 20 and the browsers:

```bash
nvm use
npm ci
npx playwright install chromium firefox webkit
```

```bash
npm test                                   # everything against https://cymulate.com
npm run test:smoke                         # quick @smoke subset, all devices
npx playwright test --project=iphone       # one device
npx playwright test tests/contact-form.spec.ts --headed
npm run report                             # open the last HTML report
npm run typecheck
```

### Against the local copy (`https://cymulate.local`)

```bash
npm run test:local
```

With a `.local` base URL the suite adds `?nowprocket=1` (the local WP Rocket cache serves stale CSS),
accepts the self-signed certificate, and lets WebKit reach the site through Node (macOS WebKit does not
resolve `.local` names from `/etc/hosts`). The local reCAPTCHA key is invalid for that domain, so there
Next always reaches step 2.

It also runs the **self-check** in `tests/self-check/`: it serves the slider stylesheet from before the
fix (`reviews-slider-wide.buggy.css`) and asserts that the demo Next click and the clickability sweep
fail on stacked layouts (phones, iPad) with `cy-reviews-slider-wide … intercepts pointer events`, and pass
on desktop. If it ever goes red, the detectors themselves are broken.

## CI (GitHub Actions)

| Workflow | When | Scope |
|---|---|---|
| `smoke.yml` | twice a day, 10:00 and 18:00 Minsk (07:00 and 15:00 UTC) | all tests on all 6 devices |
| `manual.yml` | Actions → Manual → Run workflow | choose base URL, test filter and device |

Both call `run-tests.yml`, which runs in the `mcr.microsoft.com/playwright` container, retries a
failing test twice, and only alerts when a test still fails after the retries.

On failure:

- a Slack message goes to the webhook in the `SLACK_WEBHOOK_INTERNAL` secret, listing each failed test
  with its device and the first lines of the error, plus a link to the run;
- the HTML report, screenshots, videos and traces are attached to the run as the
  `playwright-report-attempt-N` artifact for 14 days.

To check the Slack alert end to end, run **Manual** with the test filter `no-such-test`: Playwright
fails with "No tests found" and the alert says the run failed before reporting results.

### Reading an alert

- `… intercepts pointer events`: something covers the element on that device. The message names the
  covering element; the trace (open with `npx playwright show-trace trace.zip` or trace.playwright.dev)
  shows the page at that moment.
- `Next did not move to step 2 or start reCAPTCHA`: the click landed but the form did not react (JS
  error, GF change).
- Locator timeouts on a field: a label or field ID changed in the form settings; update the spec.
- `A final form submission was attempted`: a test clicked something that submits; fix the test.
- 403s or a challenge page on every test: the WP Engine WAF is blocking GitHub runners; ask WP Engine to
  allow user agents containing `CymulateE2E`.

## Maintenance

- **Pages in the sweep**: `PAGES` in `tests/clickability.spec.ts`.
- **Floating widgets** that may sit over content: `FLOATING_WIDGETS` in `tests/helpers/clickability.ts`.
- **Form fields**: each spec lists label text plus the GF input id as a fallback.
- **Playwright upgrade**: bump `@playwright/test` in `package.json` and the container tag in
  `.github/workflows/run-tests.yml` together.
