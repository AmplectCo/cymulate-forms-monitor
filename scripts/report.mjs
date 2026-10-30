// Turns the Playwright JSON report into a check × device matrix, writes it to the GitHub job summary
// and posts it to Slack. Without a webhook it prints the Slack text instead.
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
const MAX_FAILED = 15;

const DEVICES = {
  iphone: 'iPhone',
  pixel: 'Pixel',
  ipad: 'iPad',
  'desktop-chrome': 'Chrome',
  'desktop-firefox': 'Firefox',
  'desktop-safari': 'Safari',
};
const GROUPS = [
  ['forms', 'Forms'],
  ['pages', 'Pages: nothing covers links, buttons or fields'],
];
// Emoji share one width, so leading them keeps columns aligned outside a code block, where links work
const MARK = { expected: '✅', flaky: '🔁', unexpected: '❌', skipped: '➖' };
const NOT_RUN = '⬜';
const LEGEND = '✅ passed   🔁 passed after a retry   ❌ failed';

function testsOf(suite, titles = []) {
  const path = suite.title ? [...titles, suite.title] : titles;
  const fromSpecs = (suite.specs ?? []).flatMap((spec) =>
    spec.tests.map((test) => {
      const annotations = [...(test.annotations ?? []), ...test.results.flatMap((r) => r.annotations ?? [])];
      const note = (type) => annotations.find((a) => a.type === type)?.description;
      const title = [...path.slice(1), spec.title].join(' › ');
      // Reports from before the tests carried label and page annotations
      const sweptPage = spec.title.match(/clickable elements on (\S+)/)?.[1];
      return {
        title,
        group: title.startsWith('clickability sweep') ? 'pages' : 'forms',
        label: note('label') ?? sweptPage ?? spec.title,
        page: note('page') ?? sweptPage,
        project: test.projectName,
        status: test.status,
        error: test.results.at(-1)?.error?.message ?? '',
      };
    }),
  );
  return [...fromSpecs, ...(suite.suites ?? []).flatMap((child) => testsOf(child, path))];
}

function firstLines(message) {
  return message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .slice(0, 300);
}

const slackEscape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const pageUrl = (page) => (page && BASE_URL ? new URL(page, BASE_URL).href : '');

const report = existsSync(REPORT_FILE) ? JSON.parse(readFileSync(REPORT_FILE, 'utf8')) : null;
const tests = (report?.suites ?? []).flatMap((suite) => testsOf(suite));
const ran = tests.filter((t) => t.status !== 'skipped');
const failed = ran.filter((t) => t.status === 'unexpected');
const passed = JOB_STATUS === 'success';
const cancelled = JOB_STATUS === 'cancelled';
const outcome = passed ? 'passed' : cancelled ? 'cancelled' : 'failed';
const title = `Cymulate forms monitor: ${RUN_LABEL} ${outcome}`;

// Columns follow the project order in playwright.config.ts
const configOrder = (report?.config?.projects ?? []).map((p) => p.name);
const present = new Set(tests.map((t) => t.project));
const columns = [...configOrder.filter((name) => present.has(name)), ...[...present].filter((n) => !configOrder.includes(n))];
const deviceNames = columns.map((c) => DEVICES[c] ?? c);

const rowKey = (t) => `${t.group}\u0000${t.label}`;
const rows = [...new Map(tests.map((t) => [rowKey(t), { group: t.group, label: t.label, page: t.page }])).values()];
const statusOf = (row, project) => tests.find((t) => rowKey(t) === rowKey(row) && t.project === project)?.status;
const marks = (row) => columns.map((c) => MARK[statusOf(row, c)] ?? NOT_RUN);
const groupsWithRows = GROUPS.map(([id, heading]) => [heading, rows.filter((r) => r.group === id)]).filter(([, r]) => r.length);

let headline = '';
if (ran.length) {
  const minutes = Math.max(1, Math.round((report.stats?.duration ?? 0) / 60_000));
  headline = `Total: *${ran.length}*  ·  Passed: *${ran.length - failed.length}*`;
  if (failed.length) headline += `  ·  Failed: *${failed.length}*`;
  headline += `\n${columns.length} devices, ${minutes} min`;
} else if (cancelled) {
  headline = 'The run was cancelled or hit the time limit before the tests reported results.';
} else if (!passed) {
  headline = 'The run failed before the tests reported results. Open the run for details.';
  for (const error of (report?.errors ?? []).slice(0, 3)) headline += `\n• ${firstLines(error.message ?? '')}`;
}

function failedList(format) {
  const items = failed.slice(0, MAX_FAILED).map((f) => format(f));
  if (failed.length > MAX_FAILED) items.push(`…and ${failed.length - MAX_FAILED} more`);
  return items;
}

if (GITHUB_STEP_SUMMARY) {
  const md = [`## ${title}`, '', headline.replaceAll('*', '**').replace('\n', '  \n'), ''];
  for (const [heading, groupRows] of groupsWithRows) {
    md.push(
      `#### ${heading}`,
      '',
      `| ${heading.split(':')[0]} | ${deviceNames.join(' | ')} |`,
      `|---|${columns.map(() => ':-:').join('|')}|`,
      ...groupRows.map((row) => {
        const url = pageUrl(row.page);
        return `| ${url ? `[${row.label}](${url})` : row.label} | ${marks(row).join(' | ')} |`;
      }),
      '',
    );
  }
  if (rows.length) md.push(LEGEND, '');
  if (failed.length) {
    md.push('### Failed', '', ...failedList((f) => `- **[${f.project}]** ${f.title}  \n  \`${firstLines(f.error).replaceAll('`', "'")}\``), '');
  }
  if (ARTIFACT_URL) md.push(`[Full HTML report with traces](${ARTIFACT_URL})`, '');
  appendFileSync(GITHUB_STEP_SUMMARY, `${md.join('\n')}\n`);
}

const text = [headline];
if (rows.length) {
  const matrix = [`_${deviceNames.join(' · ')}_`];
  for (const [heading, groupRows] of groupsWithRows) {
    matrix.push('', `*${heading}*`);
    for (const row of groupRows) {
      const url = pageUrl(row.page);
      const name = slackEscape(row.label);
      matrix.push(`${marks(row).join(' ')}   ${url ? `<${url}|${name}>` : name}`);
    }
  }
  text.push(matrix.join('\n'), LEGEND);
}
if (failed.length) {
  text.push(['*Failed:*', ...failedList((f) => `• *[${f.project}]* ${slackEscape(f.title)}\n      ${slackEscape(firstLines(f.error))}`)].join('\n'));
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
      text: text.filter(Boolean).join('\n\n'),
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
