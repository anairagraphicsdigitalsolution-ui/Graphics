import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
import { decryptSecret } from '@/lib/growth-crypto';
export const runtime = 'nodejs';

type TestResult = { success: boolean; validationOnly?: boolean; message: string; status?: number; details?: Record<string, unknown> };
const timeout = (ms = 15000) => AbortSignal.timeout(ms);
async function request(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, cache: 'no-store', signal: init.signal || timeout() });
}
async function oauthRefresh(tokenUrl: string, clientId: string, clientSecret: string, refreshToken: string) {
  const response = await request(tokenUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  });
  const body: any = await response.json().catch(() => ({}));
  return { response, body };
}
export async function POST(req: NextRequest) {
  const c = await growthContext(req); if ('response' in c) return c.response;
  let rowId = '', org = '', provider = '';
  try {
    const b = await req.json(); org = String(b.organizationId || ''); provider = String(b.provider || '').toLowerCase();
    if (!org || !provider) return apiJson({ error: 'Workspace and provider are required.' }, 400);
    if (!await requireGrowthRole(c.db, c.userId, org, ['owner', 'manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    const { data, error } = await c.db.from('growth_integrations').select('id,encrypted_credentials,settings').eq('organization_id', org).eq('provider', provider).maybeSingle();
    if (error || !data) return apiJson({ error: 'Save credentials before testing.' }, 404);
    rowId = data.id;
    const s: any = decryptSecret(data.encrypted_credentials) || {}, cfg: any = data.settings || {};
    let response: Response | undefined, result: TestResult | undefined;

    if (provider === 'openai') {
      if (!s.api_key) return apiJson({ error: 'OpenAI API key is missing.' }, 400);
      response = await request('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${s.api_key}` } });
    } else if (provider === 'anthropic') {
      if (!s.api_key) return apiJson({ error: 'Anthropic API key is missing.' }, 400);
      response = await request('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': s.api_key, 'anthropic-version': '2023-06-01' } });
    } else if (provider === 'gemini') {
      if (!s.api_key) return apiJson({ error: 'Gemini API key is missing.' }, 400);
      response = await request(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(s.api_key)}`);
    } else if (provider === 'google_cse') {
      if (!s.api_key || !cfg.cx) return apiJson({ error: 'Google API key and Search Engine ID (cx) are required.' }, 400);
      const u = new URL('https://www.googleapis.com/customsearch/v1'); u.searchParams.set('key', s.api_key); u.searchParams.set('cx', cfg.cx); u.searchParams.set('q', 'Anaira integration test'); u.searchParams.set('num', '1');
      response = await request(u.toString());
    } else if (provider === 'resend') {
      if (!s.api_key) return apiJson({ error: 'Resend API key is missing.' }, 400);
      response = await request('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${s.api_key}` } });
    } else if (provider === 'twilio') {
      if (!s.account_sid || !s.auth_token) return apiJson({ error: 'Twilio Account SID and Auth Token are required.' }, 400);
      response = await request(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(s.account_sid)}.json`, { headers: { Authorization: `Basic ${Buffer.from(`${s.account_sid}:${s.auth_token}`).toString('base64')}` } });
    } else if (provider === 'whatsapp') {
      if (!s.access_token || !cfg.phone_number_id) return apiJson({ error: 'WhatsApp Access Token and Phone Number ID are required.' }, 400);
      response = await request(`https://graph.facebook.com/${cfg.graph_api_version || 'v22.0'}/${encodeURIComponent(cfg.phone_number_id)}?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${s.access_token}` } });
    } else if (provider === 'meta' || provider === 'instagram') {
      const token = s.access_token;
      if (token) {
        response = await request(`https://graph.facebook.com/${cfg.graph_api_version || 'v22.0'}/me?fields=id,name`, { headers: { Authorization: `Bearer ${token}` } });
      } else if (provider === 'meta' && s.app_id && (s.app_secret || s.app_id_secret)) {
        const secret = s.app_secret || s.app_id_secret;
        response = await request(`https://graph.facebook.com/${cfg.graph_api_version || 'v22.0'}/${encodeURIComponent(s.app_id)}?fields=id,name&access_token=${encodeURIComponent(`${s.app_id}|${secret}`)}`);
      } else return apiJson({ error: `${provider} needs a valid access token${provider === 'meta' ? ' or App ID and App Secret' : ''}.` }, 400);
    } else if (provider === 'cashfree') {
      if (!s.client_id || !s.client_secret) return apiJson({ error: 'Cashfree Client ID and Client Secret are required.' }, 400);
      const base = cfg.environment === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
      response = await request(`${base}/orders?limit=1`, { headers: { 'x-client-id': s.client_id, 'x-client-secret': s.client_secret, 'x-api-version': cfg.api_version || '2023-08-01' } });
    } else if (provider === 'razorpay') {
      if (!s.key_id || !s.key_secret) return apiJson({ error: 'Razorpay Key ID and Key Secret are required.' }, 400);
      response = await request('https://api.razorpay.com/v1/payments?count=1', { headers: { Authorization: `Basic ${Buffer.from(`${s.key_id}:${s.key_secret}`).toString('base64')}` } });
    } else if (provider === 'google' || provider === 'youtube') {
      const clientId = s.client_id, clientSecret = s.client_secret, refreshToken = s.refresh_token;
      if (refreshToken && clientId && clientSecret) {
        const refreshed = await oauthRefresh('https://oauth2.googleapis.com/token', clientId, clientSecret, refreshToken);
        if (!refreshed.response.ok || !refreshed.body.access_token) {
          response = new Response(JSON.stringify({ error: refreshed.body.error_description || refreshed.body.error || 'Google refresh token failed.' }), { status: refreshed.response.status || 401 });
        } else if (provider === 'youtube') {
          const channel = String(cfg.channel_id || '').trim();
          const u = new URL('https://www.googleapis.com/youtube/v3/channels'); u.searchParams.set('part', 'id,snippet'); u.searchParams.set('mine', 'true');
          response = await request(u.toString(), { headers: { Authorization: `Bearer ${refreshed.body.access_token}` } });
        } else {
          response = await request(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(refreshed.body.access_token)}`);
        }
      } else if (provider === 'youtube' && s.api_key && cfg.channel_id) {
        const u = new URL('https://www.googleapis.com/youtube/v3/channels'); u.searchParams.set('part', 'id,snippet'); u.searchParams.set('id', cfg.channel_id); u.searchParams.set('key', s.api_key);
        response = await request(u.toString());
      } else if (clientId && clientSecret) {
        result = { success: false, validationOnly: true, message: 'OAuth app credentials are present. Complete the user consent flow to verify the authorization and refresh token.' };
      } else return apiJson({ error: `${provider} requires Client ID and Client Secret${provider === 'youtube' ? ', plus a refresh token or API key and Channel ID' : ', plus a refresh token for a live test'}.` }, 400);
    } else if (provider === 'linkedin') {
      if (s.access_token) response = await request('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${s.access_token}` } });
      else if (s.client_id && s.client_secret) result = { success: false, validationOnly: true, message: 'LinkedIn OAuth app credentials are present. Connect a member account to test the access token and scopes.' };
      else return apiJson({ error: 'LinkedIn requires an access token or OAuth Client ID and Client Secret.' }, 400);
    } else if (provider === 'smtp') {
      const host = String(cfg.host || '').trim(), port = Number(cfg.port || 587), username = String(s.username || cfg.username || '').trim();
      if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !s.password) return apiJson({ error: 'SMTP host, valid port and password are required.' }, 400);
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({ host, port, secure: cfg.secure === true || port === 465, auth: username ? { user: username, pass: s.password } : undefined, connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 15000, tls: { minVersion: 'TLSv1.2' } });
      try { await transporter.verify(); result = { success: true, message: 'SMTP connection and authentication succeeded. No email was sent.' }; }
      finally { transporter.close(); }
    } else return apiJson({ error: 'Unsupported provider.' }, 400);

    if (response) {
      const raw = await response.text(); let parsed: any = {}; try { parsed = JSON.parse(raw); } catch {}
      const ok = response.ok && !(provider === 'youtube' && Array.isArray(parsed.items) && parsed.items.length === 0);
      const message = ok ? 'Provider authentication and API access test succeeded.' : String(parsed?.error?.message || parsed?.message || parsed?.error_description || (provider === 'youtube' && !parsed.items?.length ? 'No accessible YouTube channel was returned for this account.' : `Provider returned HTTP ${response.status}.`)).slice(0, 400);
      result = { success: ok, message, status: response.status, details: ok ? { account: parsed.name || parsed.display_phone_number || parsed.items?.[0]?.snippet?.title || parsed.items?.[0]?.id || undefined } : undefined };
    }
    const stamp = new Date().toISOString();
    await c.db.from('growth_integrations').update({ connection_status: result?.success ? 'connected' : result?.validationOnly ? 'saved' : 'error', last_tested_at: stamp, last_success_at: result?.success ? stamp : undefined, last_error: result?.success ? null : result?.message }).eq('id', rowId);
    await c.db.from('growth_integration_events').insert({ organization_id: org, provider, event_type: 'connection_test', status: result?.success ? 'success' : result?.validationOnly ? 'validation_only' : 'failed', message: result?.message || 'Test completed.', metadata: { http_status: result?.status || null, actor_id: c.userId } });
    if (result?.success && provider === 'whatsapp' && cfg.phone_number_id) {
      const { error: syncError } = await c.db.from('growth_whatsapp_connections').upsert({ organization_id: org, phone_number_id: String(cfg.phone_number_id), waba_id: cfg.waba_id || null, graph_api_version: cfg.graph_api_version || 'v22.0', encrypted_credentials: data.encrypted_credentials, connection_status: 'connected', connected_by: c.userId, last_verified_at: stamp, last_error: null, updated_at: stamp }, { onConflict: 'phone_number_id' });
      if (syncError) return apiJson({ success: false, error: 'Token verified but WhatsApp connection could not be synchronized. Apply the WhatsApp tenant migration.' }, 503);
    }
    return apiJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Provider test failed.';
    if (rowId) {
      await c.db.from('growth_integrations').update({ connection_status: 'error', last_tested_at: new Date().toISOString(), last_error: message.slice(0, 400) }).eq('id', rowId);
      await c.db.from('growth_integration_events').insert({ organization_id: org, provider, event_type: 'connection_test', status: 'failed', message: message.slice(0, 400), metadata: { actor_id: c.userId } });
    }
    return apiJson({ success: false, error: message.slice(0, 400) }, 502);
  }
}
