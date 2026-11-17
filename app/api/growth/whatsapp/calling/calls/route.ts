import { NextRequest } from 'next/server';
import { createHmac, randomUUID } from 'node:crypto';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { getWhatsAppCredentials } from '@/lib/growth-whatsapp';
export const runtime = 'nodejs';

const graphCall = async (version: string, phoneId: string, token: string, payload: Record<string, unknown>) => {
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/calls`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }), signal: AbortSignal.timeout(20000), cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  const providerError = data?.error?.message || data?.response?.error || data?.message;
  if (!response.ok || providerError) throw new Error(String(providerError || `Meta Graph API returned ${response.status}`));
  return data;
};

function getIceServers(userId: string) {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  const urls = String(process.env.WHATSAPP_TURN_URLS || '').split(',').map(x => x.trim()).filter(Boolean);
  const secret = String(process.env.WHATSAPP_TURN_SHARED_SECRET || '').trim();
  if (urls.length && secret) {
    const ttl = Math.max(300, Math.min(3600, Number(process.env.WHATSAPP_TURN_TTL_SECONDS || 900)));
    const username = `${Math.floor(Date.now() / 1000) + ttl}:${userId}`;
    const credential = createHmac('sha1', secret).update(username).digest('base64');
    servers.push({ urls, username, credential });
  }
  return servers;
}

/** Returns manager-only inbound call queue and short-lived TURN credentials. */
export async function GET(req: NextRequest) {
  const c = await growthContext(req);
  if ('response' in c) return c.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!organizationId) return apiJson({ error: 'Workspace is required.' }, 400);
  if (!await requireGrowthRole(c.db, c.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
  if (!await requireGrowthFeature(c.db, c.userId, organizationId, 'whatsapp')) return apiJson({ error: 'WhatsApp is not included in this workspace plan.' }, 402);
  const sessionId = req.nextUrl.searchParams.get('sessionId') || '';
  const [{ data, error }, sessionResult] = await Promise.all([
    c.db.from('growth_whatsapp_call_sessions')
      .select('id,recipient_phone,call_metadata,created_at,whatsapp_call_id')
      .eq('organization_id', organizationId).eq('direction', 'inbound').eq('call_status', 'ringing')
      .order('created_at', { ascending: true }).limit(10),
    sessionId
      ? c.db.from('growth_whatsapp_call_sessions').select('id,call_status,direction,ended_at,provider_error,updated_at').eq('organization_id', organizationId).eq('id', sessionId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);
  if (error || sessionResult.error) return apiJson({ error: 'Could not load the WhatsApp call state.' }, 503);
  if (sessionId && !sessionResult.data) return apiJson({ error: 'Call session was not found in this workspace.' }, 404);
  const iceServers = getIceServers(c.userId);
  return apiJson({ inboundCalls: data || [], callSession: sessionResult.data || null, iceServers, turnConfigured: iceServers.length > 1 });
}

/** Native Meta Calling signaling. Browser WebRTC supplies all SDP; the server never fabricates media descriptions. */
export async function POST(req: NextRequest) {
  const c = await growthContext(req);
  if ('response' in c) return c.response;
  try {
    const body = await req.json(), organizationId = String(body.organizationId || ''), leadId = String(body.leadId || ''), action = String(body.action || '');
    if (!organizationId || !['connect', 'accept', 'reject', 'terminate'].includes(action)) return apiJson({ error: 'Workspace and supported call action are required.' }, 400);
    if (!await requireGrowthRole(c.db, c.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Only workspace owners and managers can manage calls.' }, 403);
    if (!await requireGrowthFeature(c.db, c.userId, organizationId, 'whatsapp')) return apiJson({ error: 'WhatsApp is not included in this workspace plan.' }, 402);

    if (action === 'connect') {
      if (!leadId) return apiJson({ error: 'Lead is required to place an outbound call.' }, 400);
      const sdp = String(body.sdp || '');
      if (sdp.length < 80 || sdp.length > 24000 || !sdp.startsWith('v=0')) return apiJson({ error: 'A valid browser-generated WebRTC SDP offer is required.' }, 400);
      const { data: lead, error: leadError } = await c.db.from('growth_leads').select('id,phone,consent_to_contact,contact_opted_out_at').eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
      if (leadError || !lead?.phone) return apiJson({ error: 'Lead not found or phone missing.' }, 404);
      if (!lead.consent_to_contact || lead.contact_opted_out_at) return apiJson({ error: 'Contact consent is missing or the lead has opted out.' }, 403);
      const digits = String(lead.phone).replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) return apiJson({ error: 'Lead phone must be stored in international format.' }, 400);
      const permissionId = String(body.permissionId || '');
      if (!permissionId) return apiJson({ error: 'A granted WhatsApp call permission record is required.' }, 403);
      const { data: permission, error: permissionError } = await c.db.from('growth_whatsapp_call_permissions').select('id,phone_number_id,recipient_phone,permission_status,is_permanent,expires_at').eq('id', permissionId).eq('organization_id', organizationId).eq('lead_id', leadId).maybeSingle();
      if (permissionError || !permission || permission.permission_status !== 'granted' || (!permission.is_permanent && (!permission.expires_at || Date.parse(permission.expires_at) <= Date.now())) || String(permission.recipient_phone).replace(/\D/g, '') !== digits)
        return apiJson({ error: 'A current, matching customer-granted WhatsApp calling permission is required.' }, 403);
      const wa = await getWhatsAppCredentials(c.db, organizationId, permission.phone_number_id);
      if (!wa) return apiJson({ error: 'The WhatsApp number linked to this permission is not connected.' }, 503);
      const { data: activeSession, error: activeSessionError } = await c.db.from('growth_whatsapp_call_sessions').select('id').eq('organization_id', organizationId).eq('lead_id', leadId).in('call_status', ['connecting', 'ringing', 'active']).limit(1).maybeSingle();
      if (activeSessionError) return apiJson({ error: 'Could not verify active call state.' }, 503);
      if (activeSession) return apiJson({ error: 'An active WhatsApp call already exists for this lead.' }, 409);
      const { data: recentSession } = await c.db.from('growth_whatsapp_call_sessions').select('id,created_at').eq('organization_id', organizationId).eq('lead_id', leadId).gte('created_at', new Date(Date.now() - 60 * 1000).toISOString()).limit(1).maybeSingle();
      if (recentSession) return apiJson({ error: 'Please wait one minute before retrying a WhatsApp call to this lead.' }, 429);
      const { data: session, error: insertError } = await c.db.from('growth_whatsapp_call_sessions').insert({
        organization_id: organizationId, lead_id: leadId, permission_id: permission.id, phone_number_id: wa.phone_number_id,
        recipient_phone: digits, initiated_by: c.userId, direction: 'outbound', call_status: 'connecting',
        room_name: `wa-${randomUUID()}`, agent_name: 'Anaira AI', call_metadata: { provider: 'meta_whatsapp', action: 'connect' },
      }).select('id').single();
      if (insertError?.code === '23505') return apiJson({ error: 'An active WhatsApp call already exists for this lead.' }, 409);
      if (insertError || !session) return apiJson({ error: 'WhatsApp call session could not be created. Check the live calling schema.' }, 503);
      try {
        const result = await graphCall(wa.graph_api_version, wa.phone_number_id, wa.access_token, { to: digits, action: 'connect', session: { sdp_type: 'offer', sdp }, biz_opaque_callback_data: session.id });
        const call = Array.isArray(result.calls) ? result.calls[0] : null, callId = String(call?.id || ''), answerSdp = String(call?.session?.sdp || result.session?.sdp || '');
        if (!callId || !answerSdp.startsWith('v=0')) throw new Error('Meta did not return a usable call ID and SDP answer. Verify Business Calling eligibility and the Graph API response.');
        const { error: saveError } = await c.db.from('growth_whatsapp_call_sessions').update({ whatsapp_call_id: callId, call_status: 'ringing', call_metadata: { provider: 'meta_whatsapp', action: 'connect', offer_sdp: sdp, answer_sdp: answerSdp }, updated_at: new Date().toISOString() }).eq('id', session.id).eq('organization_id', organizationId);
        if (saveError) throw new Error('Call started at Meta, but local session update failed. Reconcile before retrying.');
        await c.db.from('growth_platform_audit_events').insert({ organization_id: organizationId, actor_user_id: c.userId, event_type: 'whatsapp.call.connected_request', metadata: { session_id: session.id, lead_id: leadId, provider_call_id: callId } });
        return apiJson({ ok: true, sessionId: session.id, callId, answerSdp, callStatus: 'ringing' }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Meta calling request failed.';
        await c.db.from('growth_whatsapp_call_sessions').update({ call_status: 'failed', provider_error: message.slice(0, 500), ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', session.id).eq('organization_id', organizationId);
        return apiJson({ error: message }, 502);
      }
    }

    const sessionId = String(body.sessionId || '');
    if (!sessionId) return apiJson({ error: 'Call session ID is required.' }, 400);
    const { data: session, error: sessionError } = await c.db.from('growth_whatsapp_call_sessions').select('id,phone_number_id,whatsapp_call_id,call_status,direction,recipient_phone,call_metadata').eq('id', sessionId).eq('organization_id', organizationId).maybeSingle();
    if (sessionError || !session?.whatsapp_call_id) return apiJson({ error: 'Call session was not found.' }, 404);
    if (action === 'accept' || action === 'reject') {
      if (session.direction !== 'inbound' || session.call_status !== 'ringing') return apiJson({ error: 'Only a pending inbound call can be accepted or rejected.' }, 409);
    }
    if (['terminated', 'completed', 'rejected', 'missed', 'failed'].includes(session.call_status) && action === 'terminate') return apiJson({ ok: true, alreadyEnded: true });
    const wa = await getWhatsAppCredentials(c.db, organizationId, session.phone_number_id);
    if (!wa) return apiJson({ error: 'WhatsApp connection for this call is unavailable.' }, 503);
    if (action === 'accept') {
      const answerSdp = String(body.answerSdp || '');
      if (answerSdp.length < 80 || answerSdp.length > 24000 || !answerSdp.startsWith('v=0')) return apiJson({ error: 'A browser-generated WebRTC SDP answer is required.' }, 400);
      const payload = { call_id: session.whatsapp_call_id, session: { sdp_type: 'answer', sdp: answerSdp } };
      await graphCall(wa.graph_api_version, wa.phone_number_id, wa.access_token, { ...payload, action: 'pre_accept' });
      await new Promise(resolve => setTimeout(resolve, 350));
      const result = await graphCall(wa.graph_api_version, wa.phone_number_id, wa.access_token, { ...payload, action: 'accept' });
      const { error: updateError } = await c.db.from('growth_whatsapp_call_sessions').update({ call_status: 'active', call_metadata: { ...(session.call_metadata || {}), answer_sdp: answerSdp, accept_response: result }, agent_started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', sessionId).eq('organization_id', organizationId);
      if (updateError) return apiJson({ ok: true, warning: 'Meta accepted the call but the local session update failed; reconcile this call.' }, 202);
      await c.db.from('growth_platform_audit_events').insert({ organization_id: organizationId, actor_user_id: c.userId, event_type: 'whatsapp.call.inbound_accepted', metadata: { session_id: sessionId, provider_call_id: session.whatsapp_call_id } });
      return apiJson({ ok: true, callStatus: 'active' });
    }
    if (action === 'reject') {
      await graphCall(wa.graph_api_version, wa.phone_number_id, wa.access_token, { call_id: session.whatsapp_call_id, action: 'reject' });
      await c.db.from('growth_whatsapp_call_sessions').update({ call_status: 'rejected', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', sessionId).eq('organization_id', organizationId);
      return apiJson({ ok: true, callStatus: 'rejected' });
    }
    const result = await graphCall(wa.graph_api_version, wa.phone_number_id, wa.access_token, { call_id: session.whatsapp_call_id, action: 'terminate' });
    const now = new Date().toISOString(), { error: updateError } = await c.db.from('growth_whatsapp_call_sessions').update({ call_status: 'completed', ended_at: now, call_metadata: { ...(session.call_metadata || {}), terminate_response: result }, updated_at: now }).eq('id', sessionId).eq('organization_id', organizationId);
    if (updateError) return apiJson({ ok: true, warning: 'Provider call ended but local status update failed; reconcile the call session.' }, 202);
    return apiJson({ ok: true, callStatus: 'terminated' });
  } catch (error) { return apiJson({ error: error instanceof Error ? error.message : 'WhatsApp call action failed.' }, 502); }
}
