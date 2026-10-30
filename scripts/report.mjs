// Posts a short run summary to Slack and writes the check × device table to the GitHub job summary.
// Without a webhook it prints the Slack text instead.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const {
  SLACK_WEBHOOK_URL,
  GITHUB_STEP_SUMMARY,
  JOB_STATUS = 'failure',
  RUN_LABEL = 'Run',
  BASE_URL = '',
  RUN_URL = '',
  ARTIFACT_URL = '',
  REPORT_FILE = 'test-results/results.json',
} = process.env;
const MAX_FAILED = 10;

const DEVICES = {
  iphone: 'iPhone',
  pixel: 'Pixel',
  ipad: 'iPad',
  'desktop-chrome': 'Chrome',
  'desktop-firefox': 'Firefox',
  'desktop-safari': 'Safari',
};
const MARK = { expected: '✅', flaky: '🔁', unexpected: '❌', skipped: '➖' };

function testsOf(suite, titles = []) {
  const path = suite.title ? [...titles, suite.title] : titles;
  const fromSpecs = (suite.specs ?? []).flatMap((spec) =>
    spec.tests.map((test) => {
      const annotations = [...(test.annotations ?? []), ...test.results.flatMap((r) => r.annotations ?? [])];
      const note = (type) => annotations.find((a) => a.type === type)?.description;
      // Reports from before the tests carried label and page annotations
      const sweptPage = spec.title.match(/clickable elements on (\S+)/)?.[1];
      return {
        title: [...path.slice(1), spec.title].join(' › '),
        label: note('label') ?? sweptPage ?? spec.title,
        page: note('page') ?? sweptPage,
        project: test.projectName,
        status: test.status,
        error: test.results.find((r) => r.error)?.error?.message ?? '',
      };
    }),
  );
  return [...fromSpecs, ...(suite.suites ?? []).flatMap((child) => testsOf(child, path))];
}

// The first meaningful line of a Playwright error, without colors and call logs
function shortError(message) {
  const lines = message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const cover = lines.find((line) => line.includes('intercepts pointer events'));
  const main = (lines[0] ?? '').replace(/^(Error|TimeoutError): /, '');
  return (cover ? `${main} (covered by ${tagName(cover)})` : main).slice(0, 220);
}

// "<button type=… class="ot-floating-button__open">…" → "button.ot-floating-button__open"
function tagName(line) {
  const [, tag = 'element', attrs = ''] = line.match(/<(\w+)([^>]*)>/) ?? [];
  const id = attrs.match(/\bid="([^"]+)"/)?.[1];
  const cls = attrs.match(/\bclass="([^"\s]+)/)?.[1];
  return `${tag}${id ? `#${id}` : cls ? `.${cls}` : ''}`;
}

const slackEscape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const pageUrl = (page) => (page && BASE_URL ? new URL(page, BASE_URL).href : '');
const deviceName = (project) => DEVICES[project] ?? project;

const report = existsSync(REPORT_FILE) ? JSON.parse(readFileSync(REPORT_FILE, 'utf8')) : null;
const tests = (report?.suites ?? []).flatMap((suite) => testsOf(suite));
const ran = tests.filter((t) => t.status !== 'skipped');
const failed = ran.filter((t) => t.status === 'unexpected');
const flaky = ran.filter((t) => t.status === 'flaky');
const passed = JOB_STATUS === 'success';
const cancelled = JOB_STATUS === 'cancelled';
const outcome = passed ? 'passed' : cancelled ? 'cancelled' : 'failed';
const title = `Cymulate forms monitor: ${RUN_LABEL} ${outcome}`;

// Columns follow the project order in playwright.config.ts
const configOrder = (report?.config?.projects ?? []).map((p) => p.name);
const present = new Set(tests.map((t) => t.project));
const columns = [...configOrder.filter((name) => present.has(name)), ...[...present].filter((n) => !configOrder.includes(n))];
const pages = new Set(ran.map((t) => t.page).filter(Boolean));
const minutes = Math.max(1, Math.round((report?.stats?.duration ?? 0) / 60_000));

// One entry per check, listing the devices it failed (or needed a retry) on
function byCheck(list) {
  const groups = new Map();
  for (const t of list) {
    const group = groups.get(t.label) ?? { label: t.label, page: t.page, devices: [], error: t.error };
    group.devices.push(deviceName(t.project));
    groups.set(t.label, group);
  }
  return [...groups.values()];
}

const slackName = (check) => {
  const url = pageUrl(check.page);
  const name = slackEscape(check.label);
  return url ? `<${url}|${name}>` : name;
};

const text = [];
if (ran.length) {
  const scope = `${pages.size} pages on ${columns.length} devices, ${minutes} min`;
  if (failed.length) {
    text.push(`*${ran.length}* checks: *${ran.length - failed.length}* passed, *${failed.length}* failed  ·  ${scope}`);
    const checks = byCheck(failed);
    text.push(
      [
        '*Failed:*',
        ...checks.slice(0, MAX_FAILED).map((c) => `• ${slackName(c)} on ${c.devices.join(', ')}: ${slackEscape(shortError(c.error))}`),
        ...(checks.length > MAX_FAILED ? [`…and ${checks.length - MAX_FAILED} more checks`] : []),
      ].join('\n'),
    );
  } else {
    text.push(`All *${ran.length}* checks passed  ·  ${scope}`);
  }
  if (flaky.length) {
    text.push(`Passed after a retry: ${byCheck(flaky).map((c) => `${slackName(c)} on ${c.devices.join(', ')}`).join('; ')}`);
  }
} else if (cancelled) {
  text.push('The run was cancelled or hit the time limit before the tests reported results.');
} else if (!passed) {
  text.push('The run failed before the tests reported results. Open the run for details.');
  for (const error of (report?.errors ?? []).slice(0, 3)) text.push(`• ${slackEscape(shortError(error.message ?? ''))}`);
}

if (GITHUB_STEP_SUMMARY) {
  const md = [`## ${title}`, ''];
  if (ran.length) {
    md.push(
      `**${ran.length}** checks: **${ran.length - failed.length}** passed${failed.length ? `, **${failed.length}** failed` : ''} · ${pages.size} pages on ${columns.length} devices, ${minutes} min`,
      '',
      `| Check | ${columns.map(deviceName).join(' | ')} |`,
      `|---|${columns.map(() => ':-:').join('|')}|`,
      ...[...new Map(tests.map((t) => [t.label, t])).values()].map((check) => {
        const url = pageUrl(check.page);
        const cells = columns.map((c) => MARK[tests.find((t) => t.label === check.label && t.project === c)?.status] ?? '');
        return `| ${url ? `[${check.label}](${url})` : check.label} | ${cells.join(' | ')} |`;
      }),
      '',
      '✅ passed · 🔁 passed after a retry · ❌ failed',
      '',
    );
  } else {
    md.push(text.join('\n'), '');
  }
  if (failed.length) {
    md.push('### Failed', '', ...failed.map((f) => `- **${deviceName(f.project)}** · ${f.title}  \n  \`${shortError(f.error).replaceAll('`', "'")}\``), '');
  }
  if (ARTIFACT_URL) md.push(`[Full HTML report with traces](${ARTIFACT_URL})`, '');
  appendFileSync(GITHUB_STEP_SUMMARY, `${md.join('\n')}\n`);
}

const links = [`<${RUN_URL}|Run summary>`];
if (ARTIFACT_URL) links.push(`<${ARTIFACT_URL}|Full HTML report>`);
const payload = {
  attachments: [
    {
      fallback: title,
      color: passed ? 'good' : cancelled ? 'warning' : 'danger',
      title,
      title_link: RUN_URL,
      text: text.join('\n\n'),
      footer: `${BASE_URL} | ${links.join(' | ')}`,
      mrkdwn_in: ['text', 'footer'],
    },
  ],
};

if (!SLACK_WEBHOOK_URL) {
  console.log('::warning::SLACK_WEBHOOK_INTERNAL is not set, skipping Slack. The message would be:');
  console.log(`${title}\n${payload.attachments[0].text}\n${payload.attachments[0].footer}`);
  process.exit(0);
}

const response = await fetch(SLACK_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!response.ok) {
  console.log(`::error::Slack responded ${response.status}: ${await response.text()}`);
  process.exit(1);
}
console.log('Slack notification sent');
