import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { consumeGrowthQuota } from '@/lib/growth-quota';
import { googleAdsRequest, normalizeCustomerId, refreshGoogleAdsAccessToken, saveWorkspaceGoogleAdsCredentials } from '@/lib/growth-google-ads';
export const runtime = 'nodejs';
const clean = (v: unknown, max = 180) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const textLines = (v: unknown, max: number) => Array.isArray(v) ? v.map(x => clean(x, max)).filter(Boolean) : [];
const isAccessibleCustomer = (cfg:any,id:string) => { const list=Array.isArray(cfg.workspace?.settings?.accessible_customer_ids)?cfg.workspace.settings.accessible_customer_ids.map((x:any)=>normalizeCustomerId(x)):[]; return list.length ? list.includes(id) : id===cfg.customerId; };

export async function GET(req: NextRequest) {
  const c = await growthContext(req); if ('response' in c) return c.response;
  const org = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(c.db, c.userId, org, ['owner','manager','editor','viewer'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  if (!await requireGrowthFeature(c.db, c.userId, org, 'ads')) return apiJson({ error: 'Google Ads is not included in this workspace plan.' }, 402);
  try {
    const cfg = await refreshGoogleAdsAccessToken(c.db, org);
    const { data: integration } = await c.db.from('growth_integrations').select('settings,connection_status').eq('organization_id', org).eq('provider', 'google_ads').maybeSingle();
    const customerId = normalizeCustomerId(req.nextUrl.searchParams.get('customerId') || cfg.customerId);
    if (!customerId) return apiJson({ connected: true, customerIds: integration?.settings?.accessible_customer_ids || [], message: 'Choose a Google Ads customer account to continue.' });
    if (!isAccessibleCustomer(cfg,customerId)) return apiJson({ error: 'This customer ID was not returned by the connected Google Ads OAuth account.' }, 403);
    const query = `SELECT customer.id, customer.descriptive_name, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr FROM campaign WHERE segments.date DURING LAST_30_DAYS ORDER BY metrics.cost_micros DESC LIMIT 100`;
    const report = await googleAdsRequest(cfg, `customers/${customerId}/googleAds:searchStream`, { query });
    const rows = Array.isArray(report) ? report.flatMap((batch: any) => batch.results || []) : (report.results || []);
    return apiJson({ connected: true, customerId, customerIds: integration?.settings?.accessible_customer_ids || [], campaigns: rows, apiVersion: cfg.apiVersion });
  } catch (error) { return apiJson({ connected: false, error: error instanceof Error ? error.message : 'Google Ads request failed.' }, 409); }
}

export async function POST(req: NextRequest) {
  const c = await growthContext(req); if ('response' in c) return c.response;
  try {
    const b = await req.json(); const org = String(b.organizationId || ''); const action = String(b.action || 'create_search_campaign');
    if (!await requireGrowthRole(c.db, c.userId, org, ['owner','manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    if (!await requireGrowthFeature(c.db, c.userId, org, 'ads')) return apiJson({ error: 'Google Ads is not included in this workspace plan.' }, 402);
    const cfg = await refreshGoogleAdsAccessToken(c.db, org);
    if (action === 'select_customer') {
      const customerId = normalizeCustomerId(b.customerId); const available = (cfg.workspace.settings?.accessible_customer_ids || []) as string[];
      if (!customerId || !available.includes(customerId)) return apiJson({ error: 'Select a customer account returned by Google OAuth.' }, 400);
      await saveWorkspaceGoogleAdsCredentials(c.db, org, c.userId, {}, { customer_id: customerId });
      return apiJson({ success: true, customerId });
    }
    if (action === 'create_search_campaign') {
      const customerId = normalizeCustomerId(b.customerId || cfg.customerId);
      if (!isAccessibleCustomer(cfg,customerId)) return apiJson({ error: 'This customer ID was not returned by the connected Google Ads OAuth account.' }, 403);
      const name = clean(b.name, 120); const landingUrl = clean(b.finalUrl, 500);
      const dailyBudget = Number(b.dailyBudget); const headlines = textLines(b.headlines, 30); const descriptions = textLines(b.descriptions, 90);
      const keywords = Array.isArray(b.keywords) ? b.keywords.map((x: unknown) => clean(x, 80)).filter(Boolean).slice(0, 30) : [];
      if (!customerId || !name || !/^https:\/\//i.test(landingUrl) || !Number.isFinite(dailyBudget) || dailyBudget < 100 || dailyBudget > 1000000 || headlines.length < 3 || headlines.length > 15 || headlines.some((x:string)=>x.length>30) || descriptions.length < 2 || descriptions.length > 4 || descriptions.some((x:string)=>x.length>90) || !keywords.length) return apiJson({ error: 'Provide customer account, campaign name, HTTPS landing page, daily budget (₹100–₹10,00,000), at least 3 headlines, 2 descriptions and one keyword.' }, 400);
      const quota = await consumeGrowthQuota(c.db, org, 'workflow_runs', 1, `google-ads-create:${org}:${String(b.idempotencyKey || crypto.randomUUID())}`, { provider: 'google_ads', operation: 'create_search_campaign' });
      if (!quota.allowed) return apiJson({ error: quota.reason === 'quota_exceeded' ? 'Your workflow run quota has been reached.' : 'Usage metering unavailable; campaign creation blocked.' }, 429);
      const customer = `customers/${customerId}`; const budgetTemp = `${customer}/campaignBudgets/-1`; const campaignTemp = `${customer}/campaigns/-2`; const adGroupTemp = `${customer}/adGroups/-3`;
      const ops: any[] = [
        { campaignBudgetOperation: { create: { resourceName: budgetTemp, name: `${name} Budget`, amountMicros: String(Math.round(dailyBudget * 1000000)), deliveryMethod: 'STANDARD', explicitlyShared: false } } },
        { campaignOperation: { create: { resourceName: campaignTemp, name, advertisingChannelType: 'SEARCH', status: 'PAUSED', campaignBudget: budgetTemp, manualCpc: {}, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false, targetPartnerSearchNetwork: false }, containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } } },
        { adGroupOperation: { create: { resourceName: adGroupTemp, name: `${name} Ad Group`, campaign: campaignTemp, status: 'ENABLED', type: 'SEARCH_STANDARD' } } },
        ...keywords.map((keyword: string) => ({ adGroupCriterionOperation: { create: { adGroup: adGroupTemp, status: 'ENABLED', keyword: { text: keyword, matchType: 'PHRASE' } } } })),
        { adGroupAdOperation: { create: { adGroup: adGroupTemp, status: 'ENABLED', ad: { finalUrls: [landingUrl], responsiveSearchAd: { headlines: headlines.map((text: string) => ({ text })), descriptions: descriptions.map((text: string) => ({ text })) } } } } },
      ];
      const result = await googleAdsRequest(cfg, `customers/${customerId}/googleAds:mutate`, { mutateOperations: ops, partialFailure: false, validateOnly: false });
      const results = result.mutateOperationResponses || [];
      const campaignResource = results[1]?.campaignResult?.resourceName || '';
      const campaignId = campaignResource.split('/').pop() || '';
      await c.db.from('growth_usage_logs').insert({ organization_id: org, provider: 'google_ads', model: cfg.apiVersion, operation: 'search_campaign_create', input_units: ops.length, output_units: results.length, estimated_cost: 0 });
      await c.db.from('growth_integration_events').insert({ organization_id: org, provider: 'google_ads', event_type: 'campaign_created', status: 'success', message: `Created paused Google Search campaign ${campaignId}` });
      return apiJson({ success: true, campaignId, campaignResource, status: 'PAUSED', operations: results.length, message: 'Google Search campaign, budget, ad group, keywords and responsive search ad created. Campaign remains PAUSED until an owner explicitly activates it.' }, 201);
    }
    if (action === 'activate_campaign') {
      if (b.confirmActivate !== true) return apiJson({ error: 'Explicit activation confirmation is required.' }, 400);
      const customerId = normalizeCustomerId(b.customerId || cfg.customerId); const campaignId = clean(b.campaignId, 30);
      if (!customerId || !/^\d+$/.test(campaignId)) return apiJson({ error: 'Valid customer and campaign IDs are required.' }, 400);
      if (!isAccessibleCustomer(cfg,customerId)) return apiJson({ error: 'This customer ID was not returned by the connected Google Ads OAuth account.' }, 403);
      const resource = `customers/${customerId}/campaigns/${campaignId}`;
      const result = await googleAdsRequest(cfg, `customers/${customerId}/campaigns:mutate`, { operations: [{ update: { resourceName: resource, status: 'ENABLED' }, updateMask: 'status' }], partialFailure: false, validateOnly: false });
      await c.db.from('growth_integration_events').insert({ organization_id: org, provider: 'google_ads', event_type: 'campaign_activated', status: 'success', message: `Owner activated Google Ads campaign ${campaignId}` });
      return apiJson({ success: true, campaignId, status: 'ENABLED', result });
    }
    if (action === 'retry_conversion_upload') {
      const eventId = clean(b.eventId, 160);
      const { data: event, error } = await c.db.from('growth_attribution_events').select('*').eq('organization_id', org).eq('event_id', eventId).maybeSingle();
      if (error || !event) return apiJson({ error: 'Attribution event not found.' }, 404);
      if (event.consent_status !== 'granted' || !event.conversion_action_id || !(event.gclid || event.gbraid || event.wbraid)) return apiJson({ error: 'This event lacks explicit consent, a conversion action, or a supported click identifier.' }, 409);
      const customerId = normalizeCustomerId(b.customerId || cfg.customerId);
      if (!customerId) return apiJson({ error: 'Select the Google Ads conversion customer first.' }, 400);
      const occurred = new Date(event.occurred_at); const conversionDateTime = `${occurred.toISOString().slice(0,19).replace('T',' ')}+00:00`;
      const conversion: any = { conversionAction: `customers/${customerId}/conversionActions/${event.conversion_action_id}`, conversionDateTime, conversionValue: Number(event.revenue), currencyCode: event.currency, orderId: String(event.event_id).slice(0,64), consent: { adUserData: 'GRANTED' } };
      if (event.gclid) conversion.gclid = event.gclid; else if (event.gbraid) conversion.gbraid = event.gbraid; else conversion.wbraid = event.wbraid;
      const uploaded = await googleAdsRequest(cfg, `customers/${customerId}:uploadClickConversions`, { conversions: [conversion], partialFailure: true, validateOnly: false });
      if (uploaded.partialFailureError) return apiJson({ error: uploaded.partialFailureError.message || 'Google Ads rejected the conversion.', details: uploaded.partialFailureError }, 502);
      await c.db.from('growth_attribution_events').update({ google_ads_upload_status: 'uploaded', google_ads_upload_response: uploaded, google_ads_upload_error: null }).eq('id', event.id);
      return apiJson({ success: true, eventId, uploadStatus: 'uploaded', result: uploaded });
    }
    if (action === 'record_conversion') {
      const eventKey = clean(b.eventId, 160); const leadId = clean(b.leadId, 80); const revenue = Number(b.revenue || 0); const currency = clean(b.currency || 'INR', 3).toUpperCase();
      if (!eventKey || (leadId && !/^[0-9a-f-]{36}$/i.test(leadId)) || !Number.isFinite(revenue) || revenue < 0 || !['INR','USD','GBP','EUR','AUD','CAD'].includes(currency)) return apiJson({ error: 'Unique eventId, non-negative revenue and supported currency are required.' }, 400);
      const payload = { organization_id: org, event_id: eventKey, conversion_action_id: clean(b.conversionActionId, 40) || null, lead_id: leadId || null, source: clean(b.source || 'google_ads', 40), campaign_id: clean(b.campaignId, 80) || null, gclid: clean(b.gclid, 500) || null, gbraid: clean(b.gbraid, 500) || null, wbraid: clean(b.wbraid, 500) || null, revenue, currency, event_name: clean(b.eventName || 'purchase', 80), occurred_at: b.occurredAt ? new Date(b.occurredAt).toISOString() : new Date().toISOString(), consent_status: b.consentStatus === 'granted' ? 'granted' : 'unknown', metadata: typeof b.metadata === 'object' && b.metadata ? b.metadata : {} };
      const { data, error } = await c.db.from('growth_attribution_events').upsert(payload, { onConflict: 'organization_id,event_id', ignoreDuplicates: true }).select('id').maybeSingle();
      if (error) return apiJson({ error: 'Attribution event could not be saved. Apply the attribution migration.' }, 500);
      if (!data) return apiJson({ success: true, duplicate: true, eventId: eventKey, note: 'This event ID was already recorded; no duplicate conversion was uploaded.' });
      const conversionCustomerId = normalizeCustomerId(b.customerId || cfg.customerId);
      const conversionActionId = clean(b.conversionActionId, 40);
      const clickId = clean(b.gclid || b.gbraid || b.wbraid, 500);
      let upload: any = { status: 'not_requested' };
      if (conversionActionId && clickId && conversionCustomerId && payload.consent_status === 'granted') {
        if (!/^\d+$/.test(conversionActionId)) return apiJson({ success: true, eventId: eventKey, uploadStatus: 'not_requested', warning: 'Conversion action ID must contain digits only.' });
        const occurred = new Date(payload.occurred_at);
        const conversionDateTime = `${occurred.toISOString().slice(0,19).replace('T',' ')}+00:00`;
        const conversion: any = { conversionAction: `customers/${conversionCustomerId}/conversionActions/${conversionActionId}`, conversionDateTime, conversionValue: revenue, currencyCode: currency, orderId: eventKey.slice(0,64), consent: { adUserData: 'GRANTED' } };
        if (b.gclid) conversion.gclid = clean(b.gclid, 500); else if (b.gbraid) conversion.gbraid = clean(b.gbraid, 500); else conversion.wbraid = clean(b.wbraid, 500);
        await c.db.from('growth_attribution_events').update({ google_ads_upload_status: 'pending' }).eq('id', data.id);
        try {
          const uploaded = await googleAdsRequest(cfg, `customers/${conversionCustomerId}:uploadClickConversions`, { conversions: [conversion], partialFailure: true, validateOnly: false });
          if (uploaded.partialFailureError) throw new Error(uploaded.partialFailureError.message || 'Google Ads reported a partial conversion upload failure.');
          upload = { status: 'uploaded', response: uploaded };
          await c.db.from('growth_attribution_events').update({ google_ads_upload_status: 'uploaded', google_ads_upload_response: uploaded, google_ads_upload_error: null }).eq('id', data.id);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Google Ads conversion upload failed.';
          upload = { status: 'failed', error: message };
          await c.db.from('growth_attribution_events').update({ google_ads_upload_status: 'failed', google_ads_upload_error: message }).eq('id', data.id);
        }
      } else if (conversionActionId || clickId) {
        upload = { status: 'skipped_no_consent', note: 'Google Ads conversion upload requires explicit ad-user-data consent and a click ID plus conversion action.' };
        await c.db.from('growth_attribution_events').update({ google_ads_upload_status: 'skipped_no_consent' }).eq('id', data.id);
      }
      return apiJson({ success: true, duplicate: false, eventId: eventKey, uploadStatus: upload.status, upload, note: upload.status === 'uploaded' ? 'Revenue event recorded and offline click conversion uploaded to Google Ads.' : 'Revenue event recorded in Anaira attribution. Google Ads upload is reported separately.' });
    }
    return apiJson({ error: 'Unsupported Google Ads action.' }, 400);
  } catch (error) { return apiJson({ error: error instanceof Error ? error.message : 'Google Ads operation failed.' }, 502); }
}
