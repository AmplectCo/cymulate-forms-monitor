// Posts the result of a CI run to Slack. Reads the Playwright JSON report.
import { existsSync, readFileSync } from 'node:fs';

const { SLACK_WEBHOOK_URL, JOB_STATUS = 'failure', RUN_LABEL = 'Run', BASE_URL = '', RUN_URL = '' } = process.env;
const REPORT = 'test-results/results.json';
const MAX_LINES = 15;

if (!SLACK_WEBHOOK_URL) {
  console.log('::warning::SLACK_WEBHOOK_INTERNAL is not set, skipping the Slack notification');
  process.exit(0);
}

function testsOf(suite, titles = []) {
  const path = suite.title ? [...titles, suite.title] : titles;
  const fromSpecs = (suite.specs ?? []).flatMap((spec) =>
    spec.tests.map((test) => ({
      title: [...path.slice(1), spec.title].join(' › '),
      project: test.projectName,
      status: test.status,
      error: test.results.at(-1)?.error?.message ?? '',
    })),
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

const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : null;
const tests = (report?.suites ?? []).flatMap((suite) => testsOf(suite)).filter((t) => t.status !== 'skipped');
const failed = tests.filter((t) => t.status === 'unexpected');
// A pass that needed a retry is an early sign of a flaky page or test
const flaky = tests.filter((t) => t.status === 'flaky');
const passed = JOB_STATUS === 'success';
const cancelled = JOB_STATUS === 'cancelled';

const lines = [];
if (tests.length) {
  const counts = [`Total: *${tests.length}*`, `Passed: *${tests.length - failed.length}*`];
  if (failed.length) counts.push(`Failed: *${failed.length}*`);
  const devices = new Set(tests.map((t) => t.project)).size;
  const minutes = Math.max(1, Math.round((report.stats?.duration ?? 0) / 60_000));
  lines.push(counts.join('  ·  '), `${devices} devices, ${minutes} min`);
} else if (cancelled) {
  lines.push('The run was cancelled or hit the time limit before the tests reported results.');
} else if (!passed) {
  lines.push('The run failed before the tests reported results. Open the run for details.');
  for (const error of (report?.errors ?? []).slice(0, 3)) lines.push(`• ${firstLines(error.message ?? '')}`);
}

if (failed.length) {
  lines.push('', '*Failed:*', ...failed.slice(0, MAX_LINES).map((f) => `• *[${f.project}]* ${f.title}\n      ${firstLines(f.error)}`));
  if (failed.length > MAX_LINES) lines.push(`…and ${failed.length - MAX_LINES} more`);
}
if (flaky.length) {
  lines.push('', '*Passed only after a retry:*', ...flaky.slice(0, MAX_LINES).map((f) => `• *[${f.project}]* ${f.title}`));
}

const outcome = passed ? 'passed' : cancelled ? 'cancelled' : 'failed';
const title = `Cymulate forms monitor: ${RUN_LABEL} ${outcome}`;
const payload = {
  attachments: [
    {
      fallback: title,
      color: passed ? 'good' : cancelled ? 'warning' : 'danger',
      title,
      title_link: RUN_URL,
      text: lines.join('\n'),
      footer: `${BASE_URL} | <${RUN_URL}|${passed ? 'Open run' : 'Open run, report and traces'}>`,
    },
  ],
};

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
