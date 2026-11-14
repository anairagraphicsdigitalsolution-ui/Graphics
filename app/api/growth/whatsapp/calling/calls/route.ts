import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { getWhatsAppCredentials } from '@/lib/growth-whatsapp';
export const runtime = 'nodejs';
const graphCall = async (version: string, phoneId: string, token: string, payload: Record<string, unknown>) => {
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/calls`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }), signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  const providerError = data?.error?.message || data?.response?.error || data?.message;
  if (!response.ok || providerError) throw new Error(String(providerError || `Meta Graph API returned ${response.status}`));
  return data;
};
/** Native WhatsApp Business Calling signaling. Browser WebRTC supplies real SDP; no SDP is fabricated here. */
export async function POST(req: NextRequest) {
  const c = await growthContext(req);
  if ('response' in c) return c.response;
  try {
    const body = await req.json(), organizationId = String(body.organizationId || ''), leadId = String(body.leadId || ''), action = String(body.action || '');
    if (!organizationId || !leadId || !['connect', 'terminate'].includes(action)) return apiJson({ error: 'Workspace, lead and supported call action are required.' }, 400);
    if (!await requireGrowthRole(c.db, c.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Only workspace owners and managers can place or terminate calls.' }, 403);
    if (!await requireGrowthFeature(c.db, c.userId, organizationId, 'whatsapp')) return apiJson({ error: 'WhatsApp is not included in this workspace plan.' }, 402);
    if (action === 'connect') {
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
      const { data: activeSession, error: activeSessionError } = await c.db.from('growth_whatsapp_call_sessions')
        .select('id').eq('organization_id', organizationId).eq('lead_id', leadId)
        .in('call_status', ['initiating', 'ringing', 'connected']).limit(1).maybeSingle();
      if (activeSessionError) return apiJson({ error: 'Could not verify active call state.' }, 503);
      if (activeSession) return apiJson({ error: 'An active WhatsApp call already exists for this lead.' }, 409);
      const { data: recentSession } = await c.db.from('growth_whatsapp_call_sessions')
        .select('id,created_at').eq('organization_id', organizationId).eq('lead_id', leadId)
        .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString()).limit(1).maybeSingle();
      if (recentSession) return apiJson({ error: 'Please wait one minute before retrying a WhatsApp call to this lead.' }, 429);
      const { data: session, error: insertError } = await c.db.from('growth_whatsapp_call_sessions').insert({ organization_id: organizationId, lead_id: leadId, permission_id: permission.id, phone_number_id: wa.phone_number_id, recipient_phone: digits, initiated_by: c.userId, call_status: 'initiating' }).select('id').single();
      if (insertError?.code === '23505') return apiJson({ error: 'An active WhatsApp call already exists for this lead.' }, 409);
      if (insertError || !session) return apiJson({ error: 'Native calling migration is not applied or session could not be created.' }, 503);
      try {
        const result = await graphCall(wa.graph_api_version, wa.phone_number_id, wa.access_token, { to: digits, action: 'connect', session: { sdp_type: 'offer', sdp }, biz_opaque_callback_data: session.id });
        const call = Array.isArray(result.calls) ? result.calls[0] : null, callId = String(call?.id || ''), answerSdp = String(call?.session?.sdp || result.session?.sdp || '');
        if (!callId || !answerSdp.startsWith('v=0')) throw new Error('Meta did not return a usable call ID and SDP answer. Verify Business Calling eligibility and the Graph API response.');
        const { error: saveError } = await c.db.from('growth_whatsapp_call_sessions').update({ provider_call_id: callId, call_status: 'ringing', provider_payload: { provider: 'meta_whatsapp', action: 'connect' }, updated_at: new Date().toISOString() }).eq('id', session.id).eq('organization_id', organizationId);
        if (saveError) throw new Error('Call started at Meta, but local session update failed. Reconcile before retrying.');
        await c.db.from('growth_platform_audit_events').insert({ organization_id: organizationId, actor_user_id: c.userId, event_type: 'whatsapp.call.connected_request', metadata: { session_id: session.id, lead_id: leadId, provider_call_id: callId } });
        return apiJson({ ok: true, sessionId: session.id, callId, answerSdp, callStatus: 'ringing' }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Meta calling request failed.';
        await c.db.from('growth_whatsapp_call_sessions').update({ call_status: 'failed', failure_message: message.slice(0, 500), ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', session.id);
        return apiJson({ error: message }, 502);
      }
    }
    const sessionId = String(body.sessionId || '');
    if (!sessionId) return apiJson({ error: 'Call session ID is required to terminate a call.' }, 400);
    const { data: session, error: sessionError } = await c.db.from('growth_whatsapp_call_sessions').select('id,phone_number_id,provider_call_id,call_status').eq('id', sessionId).eq('organization_id', organizationId).eq('lead_id', leadId).maybeSingle();
    if (sessionError || !session?.provider_call_id) return apiJson({ error: 'Active call session was not found.' }, 404);
    if (['terminated', 'rejected', 'failed'].includes(session.call_status)) return apiJson({ ok: true, alreadyEnded: true });
    const wa = await getWhatsAppCredentials(c.db, organizationId, session.phone_number_id);
    if (!wa) return apiJson({ error: 'WhatsApp connection for this call is unavailable.' }, 503);
    const result = await graphCall(wa.graph_api_version, wa.phone_number_id, wa.access_token, { call_id: session.provider_call_id, action: 'terminate' });
    const now = new Date().toISOString(), { error: updateError } = await c.db.from('growth_whatsapp_call_sessions').update({ call_status: 'terminated', ended_at: now, provider_payload: { provider: 'meta_whatsapp', action: 'terminate', result }, updated_at: now }).eq('id', sessionId).eq('organization_id', organizationId);
    if (updateError) return apiJson({ ok: true, warning: 'Provider call ended but local status update failed; reconcile the call session.' }, 202);
    return apiJson({ ok: true, callStatus: 'terminated' });
  } catch (error) { return apiJson({ error: error instanceof Error ? error.message : 'WhatsApp call action failed.' }, 502); }
}
