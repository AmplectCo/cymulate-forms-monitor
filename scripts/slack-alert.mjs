// Posts the failed tests of a CI run to Slack. Reads the Playwright JSON report.
import { existsSync, readFileSync } from 'node:fs';

const { SLACK_WEBHOOK_URL, RUN_LABEL = 'Run', BASE_URL = '', RUN_URL = '' } = process.env;
const REPORT = 'test-results/results.json';
const MAX_LINES = 15;

if (!SLACK_WEBHOOK_URL) {
  console.log('::warning::SLACK_WEBHOOK_INTERNAL is not set, skipping the Slack alert');
  process.exit(0);
}

function failedTests(suite, titles = []) {
  const path = suite.title ? [...titles, suite.title] : titles;
  const fromSpecs = (suite.specs ?? []).flatMap((spec) =>
    spec.tests
      .filter((test) => test.status === 'unexpected')
      .map((test) => ({
        title: [...path.slice(1), spec.title].join(' › '),
        project: test.projectName,
        error: test.results.at(-1)?.error?.message ?? '',
      })),
  );
  return [...fromSpecs, ...(suite.suites ?? []).flatMap((child) => failedTests(child, path))];
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

let lines = ['The run failed before the tests reported results. Open the run for details.'];
if (existsSync(REPORT)) {
  const report = JSON.parse(readFileSync(REPORT, 'utf8'));
  const failed = report.suites.flatMap((suite) => failedTests(suite));
  if (failed.length) {
    lines = failed.slice(0, MAX_LINES).map((f) => `• *[${f.project}]* ${f.title}\n      ${firstLines(f.error)}`);
    if (failed.length > MAX_LINES) lines.push(`…and ${failed.length - MAX_LINES} more`);
  } else if (report.errors?.length) {
    lines = report.errors.slice(0, 3).map((error) => `• ${firstLines(error.message ?? '')}`);
  }
}

const payload = {
  attachments: [
    {
      fallback: `Cymulate forms monitor: ${RUN_LABEL} failed`,
      color: 'danger',
      title: `Cymulate forms monitor: ${RUN_LABEL} failed`,
      title_link: RUN_URL,
      text: lines.join('\n'),
      footer: `${BASE_URL} | <${RUN_URL}|Open run, report and traces>`,
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
console.log('Slack alert sent');
