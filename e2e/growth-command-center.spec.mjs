import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseURL = (process.env.AIGE_BASE_URL || '').replace(/\/$/, '');
const email = process.env.AIGE_TEST_EMAIL || '';
const password = process.env.AIGE_TEST_PASSWORD || '';
const organizationId = process.env.AIGE_TEST_ORGANIZATION_ID || '';

for (const [name, value] of Object.entries({ AIGE_BASE_URL: baseURL, AIGE_TEST_EMAIL: email, AIGE_TEST_PASSWORD: password, AIGE_TEST_ORGANIZATION_ID: organizationId })) {
  if (!value) throw new Error(`${name} is required for authenticated Command Center E2E.`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
const analyticsResponses = [];
const briefingResponses = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('response', response => {
  const url = response.url();
  if (url.includes('/api/growth/analytics?')) analyticsResponses.push({ status: response.status(), url });
  if (url.endsWith('/api/growth/briefing')) briefingResponses.push({ status: response.status(), method: response.request().method() });
});

try {
  await page.goto(`${baseURL}/growth-login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/ai-growth\/overview/, { timeout: 30000 });

  await page.evaluate(id => localStorage.setItem('anaira-growth-active-org', id), organizationId);
  await page.goto(`${baseURL}/admin/ai-growth/overview`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'AI Command Center' }).waitFor({ timeout: 30000 });

  await page.getByText('Leads · last 30 days', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole('heading', { name: 'AI Daily Business Briefing' }).waitFor({ timeout: 30000 });
  await page.getByText('KPI source reconciliation', { exact: true }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(500);

  assert.ok(analyticsResponses.length >= 1, 'Command Center should request analytics on initial render');
  assert.ok(analyticsResponses.every(item => item.status === 200), `Analytics API returned non-200: ${JSON.stringify(analyticsResponses)}`);
  assert.ok(analyticsResponses.every(item => new URL(item.url).searchParams.get('organizationId') === organizationId), 'Analytics request must be scoped to the selected workspace');
  assert.ok(briefingResponses.some(item => item.method === 'POST' && item.status === 200), `Briefing API did not return 200: ${JSON.stringify(briefingResponses)}`);

  const beforeRefresh = analyticsResponses.length;
  await page.getByRole('button', { name: 'Refresh KPIs' }).click();
  const refreshDeadline = Date.now() + 15000;
  while (analyticsResponses.length <= beforeRefresh && Date.now() < refreshDeadline) await page.waitForTimeout(100);
  assert.ok(analyticsResponses.length > beforeRefresh, 'Refresh KPIs must issue a new analytics request');
  assert.equal(pageErrors.length, 0, `Browser runtime errors: ${pageErrors.join(' | ')}`);
  assert.equal(consoleErrors.length, 0, `Browser console errors: ${consoleErrors.join(' | ')}`);

  await page.screenshot({ path: 'artifacts/growth-command-center-e2e.png', fullPage: true });
  console.log('PASS authenticated sign-in and overview navigation');
  console.log('PASS KPI dashboard renders and analytics API is tenant-scoped');
  console.log('PASS KPI refresh triggers a fresh API request');
  console.log('PASS daily briefing API returns successfully');
  console.log('PASS browser runtime and console are error-free');
} catch (error) {
  await page.screenshot({ path: 'artifacts/growth-command-center-e2e-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
