#!/usr/bin/env node
/*
 * Read-only production smoke checks for Anaira AI Growth public endpoints.
 * This script never invokes the authenticated worker and never prints secrets.
 * Usage:
 *   ANAIRA_GROWTH_SITE_URL=https://graphics.anairapos.in \
 *   WHATSAPP_VERIFY_TOKEN=... META_WEBHOOK_VERIFY_TOKEN=... \
 *   node scripts/smoke-growth-public.cjs
 */
const base = String(process.env.ANAIRA_GROWTH_SITE_URL || process.argv[2] || '').replace(/\/$/, '');
const checks = [];
function record(label, ok, detail = '') {
  checks.push({ label, ok, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}\n`);
}
async function request(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try { return await fetch(url, { redirect: 'manual', cache: 'no-store', signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}
(async () => {
  if (!base || !/^https:\/\//i.test(base)) {
    console.error('Set ANAIRA_GROWTH_SITE_URL to the deployed HTTPS origin.');
    process.exitCode = 2;
    return;
  }
  try {
    const home = await request(base);
    record('Production website responds', home.status >= 200 && home.status < 400, `HTTP ${home.status}`);
  } catch (error) { record('Production website responds', false, error.message); }

  try {
    const worker = await request(`${base}/api/growth/worker`);
    record('Worker rejects unauthenticated requests', worker.status === 401, `HTTP ${worker.status}`);
  } catch (error) { record('Worker rejects unauthenticated requests', false, error.message); }

  const whatsappToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (whatsappToken) {
    try {
      const challenge = `anaira-whatsapp-${Date.now()}`;
      const url = new URL(`${base}/api/growth/whatsapp/webhook`);
      url.searchParams.set('hub.mode', 'subscribe');
      url.searchParams.set('hub.verify_token', whatsappToken);
      url.searchParams.set('hub.challenge', challenge);
      const response = await request(url.toString());
      const body = await response.text();
      record('WhatsApp webhook verification challenge', response.status === 200 && body === challenge, `HTTP ${response.status}`);
    } catch (error) { record('WhatsApp webhook verification challenge', false, error.message); }
  } else record('WhatsApp webhook verification challenge', false, 'WHATSAPP_VERIFY_TOKEN not supplied; skipped');

  const metaToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (metaToken) {
    try {
      const challenge = `anaira-meta-${Date.now()}`;
      const url = new URL(`${base}/api/growth/meta/webhook`);
      url.searchParams.set('hub.mode', 'subscribe');
      url.searchParams.set('hub.verify_token', metaToken);
      url.searchParams.set('hub.challenge', challenge);
      const response = await request(url.toString());
      const body = await response.text();
      record('Meta Lead Ads webhook verification challenge', response.status === 200 && body === challenge, `HTTP ${response.status}`);
    } catch (error) { record('Meta Lead Ads webhook verification challenge', false, error.message); }
  } else record('Meta Lead Ads webhook verification challenge', false, 'META_WEBHOOK_VERIFY_TOKEN not supplied; skipped');

  const failed = checks.filter(x => !x.ok);
  process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks passed. This is a public-endpoint smoke test, not a provider send/publish E2E test.\n`);
  process.exitCode = failed.length ? 1 : 0;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
