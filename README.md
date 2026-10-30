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
| `healthcare-forms.spec.ts` (forms 4 and 5) | `/healthcare-hub/` | Inline form: same. Popup form: "Book a Demo" is really clicked to open the modal, then same |
| `demo-ab-form.spec.ts` (form 12) | `/schedule-a-demo-a-b/` | Same |
| `workshop-india-form.spec.ts` (form 15) | `/cymulate-customer-technical-workshop-india/` | Same |
| `xm-cyber-guide-form.spec.ts` (form 11) | `/xm-cyber-transition-guide/` | Same |
| `header-cta.spec.ts` `@smoke` | `/contact-us/` | The header "Book a Demo" button (behind the burger on mobile) is clickable and points to `/schedule-a-demo/` |
| `clickability.spec.ts` (`/schedule-a-demo/` is `@smoke`) | the 8 form pages above | Every visible link, button and field inside `<main>` gets a trial click |

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
| `smoke.yml` | daily at 07:00 UTC (10:00 UTC+3) | all tests on all 6 devices |
| `manual.yml` | Actions → Manual → Run workflow | choose base URL, test filter and device |

Both call `run-tests.yml`, which runs in the `mcr.microsoft.com/playwright` container and retries a
failing test twice; a test counts as failed only if it still fails after the retries.

Every run, passed, failed or cancelled (including one that hits the time limit), is reported by
`scripts/report.mjs`:

- **Slack** (webhook in the `SLACK_WEBHOOK_INTERNAL` secret): a short summary. One line with the check
  count, passed and failed, pages, devices and run time; then, only if something went wrong, each failed
  check as "page: check on devices: one-line reason" (the check is a form's name, or "links and buttons"
  for the page check), and the checks that passed only after a retry. Page names link to the tested
  site. Green means everything passed, red means something failed, yellow means the run was cancelled.
  The footer links to the run summary and the full HTML report.
- **Run summary** on the GitHub run page: the same counts plus a page × device table, one row per page,
  where each cell sums up every check on that page and device (✅ all passed, 🔁 something passed only
  after a retry, ❌ something failed), and every failed test with its error.
- **Artifact** `playwright-report-<run start, UTC+3>` (e.g. `playwright-report-2026-10-30_10-00`), kept
  14 days: the HTML report, plus screenshots and one trace per failed test (from its first failed
  attempt). A passing run's report is a few MB. Unzip it and open it with
  `npx playwright show-report <folder>`; each failed test links to its trace.

Each test carries a `label` annotation (its check name in Slack) and a `page` annotation (the path of the
page it belongs to); give new tests both. Page names in the report come from `name` in `PAGES` in
`tests/clickability.spec.ts`, so a new form page needs an entry there too.
Without a webhook (e.g. locally) the script prints the Slack text instead:
`REPORT_FILE=<results.json> JOB_STATUS=success node scripts/report.mjs`.

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
- **Floating widgets** that may sit over content (cookie and accessibility buttons, reCAPTCHA badge,
  Salespeak): `FLOATING_WIDGETS` in `tests/fixtures.ts`. `visit()` takes them out of hit testing for every
  test, since users scroll past them.
- **Form fields**: each spec lists label text plus the GF input id as a fallback.
- **Playwright upgrade**: bump `@playwright/test` in `package.json` and the container tag in
  `.github/workflows/run-tests.yml` together.
