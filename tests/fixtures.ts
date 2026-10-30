import { test as base, expect, type Page, type Request } from '@playwright/test';
import { BASE_URL, IS_LOCAL } from './env';

const SITE_HOST = new URL(BASE_URL).hostname;

const BLOCKED_HOSTS = [
  /(^|\.)google-analytics\.com$/,
  /(^|\.)analytics\.google\.com$/,
  /(^|\.)doubleclick\.net$/,
  /(^|\.)googleadservices\.com$/,
  /(^|\.)(visualwebsiteoptimizer|vwo)\.com$/,
  /salespeak/,
  /(^|\.)hs-scripts\.com$/,
  /(^|\.)hs-analytics\.net$/,
  // HubSpot collected forms captures any form submit on the page, the demo "Next" included
  /(^|\.)hscollectedforms\.net$/,
  /(^|\.)lfeeder\.com$/,
  /(^|\.)hotjar\.(com|io)$/,
  /(^|\.)remarketstats\.com$/,
  /^tracking\.g2crowd\.com$/,
];

// Hit endpoints only: gtm.js itself loads so the page keeps the widgets it injects
const GOOGLE_HOSTS = /(^|\.)(google|googletagmanager)\.com$/;
const GOOGLE_BEACON_PATHS = /^\/(g\/collect|j\/collect|collect|td|ccm\/collect|pagead\/|ads\/|rmkt\/)/;

// Floating widgets that legitimately sit over the content; users scroll past them, so no check counts
// them as overlaps. Salespeak matches stay inside <body>: once the chat is refused the site puts
// cy-salespeak-hidden on <html>, and disabling pointer events there would disable the whole page.
const FLOATING_WIDGETS = [
  '#INDmenu-btn',
  '#ot-sdk-btn-floating',
  '.grecaptcha-badge',
  'body [id*="salespeak" i]',
  'body [class*="salespeak" i]',
];
const FLOATING_WIDGETS_CSS = `${FLOATING_WIDGETS.flatMap((s) => [s, `${s} *`]).join(', ')} { pointer-events: none !important; }`;

function isTracker(url: URL): boolean {
  if (BLOCKED_HOSTS.some((host) => host.test(url.hostname))) return true;
  return GOOGLE_HOSTS.test(url.hostname) && GOOGLE_BEACON_PATHS.test(url.pathname);
}

// Gravity Forms posts every page change to the page URL; only the final submit targets page 0
function isFinalFormSubmit(request: Request, url: URL): boolean {
  if (request.method() !== 'POST' || url.hostname !== SITE_HOST) return false;
  if (url.pathname.startsWith('/wp-json/gf/')) return true;
  const body = request.postData() ?? '';
  if (!/gform_submit/.test(body)) return false;
  const target = body.match(/gform_target_page_number_\d+(?:"\r\n\r\n|=)(\d*)/);
  return !target || target[1] === '' || target[1] === '0';
}

export const test = base.extend({
  page: async ({ page, browserName }, use) => {
    const blockedSubmits: string[] = [];
    // WebKit on macOS resolves *.local over mDNS only, so the local site is fetched from Node instead
    const fetchSiteFromNode = IS_LOCAL && browserName === 'webkit';

    await page.route(
      () => true,
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (isTracker(url)) return route.abort('blockedbyclient');
        if (isFinalFormSubmit(request, url)) {
          blockedSubmits.push(request.url());
          return route.abort('blockedbyclient');
        }
        if (fetchSiteFromNode && url.hostname === SITE_HOST) {
          return route.fulfill({ response: await route.fetch({ maxRedirects: 0, timeout: 60_000 }) });
        }
        return route.fallback();
      },
    );

    await page.addLocatorHandler(page.locator('#onetrust-reject-all-handler'), async (reject) => {
      await reject.click();
      // Park the pointer over the fixed header so later scrolling hovers nothing (hover-driven blocks)
      await page.mouse.move(1, 1);
    });

    await use(page);

    expect(blockedSubmits, 'A final form submission was attempted (and blocked)').toEqual([]);
  },
});

export { expect };

export async function visit(page: Page, path: string): Promise<void> {
  const url = new URL(path, `${BASE_URL}/`);
  if (IS_LOCAL) url.searchParams.set('nowprocket', '1');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: FLOATING_WIDGETS_CSS });
  // WP Rocket holds back scripts until the first user interaction
  await page.mouse.move(2, 2);
  await page.mouse.move(24, 24);
}
