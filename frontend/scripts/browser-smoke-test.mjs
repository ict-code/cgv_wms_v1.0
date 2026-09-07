// Real headless-browser click-through of the actual running app (not an
// HTTP-level check). Login -> dashboard -> a few key pages render -> create a
// master-data record through its modal form -> it shows up in the table.
//
// Usage: node scripts/browser-smoke-test.mjs
// Env: SMOKE_BASE_URL (default http://localhost:8080), ADMIN_USERNAME, ADMIN_PASSWORD

import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
const USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error('Set ADMIN_PASSWORD to run the smoke test.');
  process.exit(1);
}

const steps = [];
function step(name, fn) {
  steps.push({ name, fn });
}

step('login redirects to dashboard', async (page) => {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/username/i).fill(USERNAME);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
});

step('dashboard renders real content', async (page) => {
  await page.waitForSelector('text=/dashboard/i', { timeout: 10_000 });
  const bodyText = await page.textContent('body');
  if (!bodyText || bodyText.trim().length < 50) throw new Error('Dashboard body looks empty');
});

for (const path of ['/items', '/inventory', '/receiving', '/issuance', '/reports', '/scan']) {
  step(`${path} renders without a client error`, async (page) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    if (errors.length > 0) throw new Error(`Client-side error(s): ${errors.join('; ')}`);
  });
}

step('create a category through its modal and see it in the table', async (page) => {
  const code = `SMOKE-${Date.now()}`;
  await page.goto(`${BASE}/categories`);
  await page.getByRole('button', { name: /new category/i }).click();
  await page.getByLabel(/^code/i).fill(code);
  await page.getByLabel(/^name/i).fill('Browser Smoke Test Category');
  await page.getByRole('button', { name: /^save$/i }).click();
  await page.waitForSelector(`text=${code}`, { timeout: 10_000 });
});

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let failed = 0;

  for (const { name, fn } of steps) {
    try {
      await fn(page);
      console.log(`PASS  ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${name}`);
      console.log(`      ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await browser.close();
  console.log(`\n${steps.length - failed}/${steps.length} passed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
