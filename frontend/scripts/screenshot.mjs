import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
const USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/login`);
  await page.screenshot({ path: 'scripts/screenshot-login.png' });

  await page.getByLabel(/username/i).fill(USERNAME);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scripts/screenshot-dashboard.png' });

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
