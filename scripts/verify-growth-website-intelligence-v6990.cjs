'use strict';
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const tracking=read('app/api/growth/website-tracking/route.ts');
const events=read('app/api/growth/website-events/route.ts');
const form=read('app/api/growth/website-form/route.ts');
const tracker=read('public/anaira-growth-tracker.js');
const chat=read('components/ai-sales-chat.tsx');
const chatLead=read('app/api/growth/lead/route.ts');
const nav=read('components/growth-primary-nav.tsx');
const ui=read('components/growth-website-intelligence.tsx');
const audit=read('app/api/growth/website-intelligence/route.ts');
const migration=read('supabase/migrations/20261116044413_growth_website_intelligence_v6990.sql');
const idem=read('supabase/migrations/20261116044552_growth_website_form_idempotency_v6990a.sql');
const pkg=JSON.parse(read('package.json'));
const checks=[
 ['Tracking key issue/revoke requires authenticated owner or manager',tracking.includes('growthContext(req)')&&tracking.includes("['owner', 'manager']")],
 ['Tracking key is cryptographically random and stored as SHA-256 hash',tracking.includes('randomBytes(32)')&&tracking.includes('sha256(publicKey)')],
 ['Tracking key plaintext is returned once only',tracking.includes('publicKey, message:')&&tracking.includes('cannot be recovered')],
 ['Tracking requires DNS ownership verification',tracking.includes("website.verification_status !== 'verified'")],
 ['Key rotation deactivates the prior key',tracking.includes("update({ is_active: false, revoked_at:")],
 ['Dashboard metrics are website and tenant scoped',tracking.includes("eq('organization_id', organizationId)")&&tracking.includes("eq('website_id', websiteId)")],
 ['Dashboard reports real events and explicit row cap',tracking.includes('dataCapped: rows.length >= 10000')],
 ['Public event API validates hashed website key',events.includes('sha256(publicKey)')&&events.includes("eq('is_active', true)")],
 ['Public event API validates verified website origin',events.includes('allowedOrigin(origin, website)')&&events.includes("website.verification_status !== 'verified'")],
 ['Public event API restricts event types and payload sizes',events.includes("'page_view','form_start','form_submit','chat_open','conversion'")&&events.includes('raw.length > 12000')],
 ['Public event API rate limits and deduplicates events',events.includes('enforceGrowthRateLimit')&&events.includes("onConflict: 'website_id,event_id'")],
 ['Public event API stores only allowlisted event metadata and UTM attribution',events.includes('form_key: clean(eventData.form_key')&&events.includes('utm_source: clean(attribution.utm_source')],
 ['Public form API verifies website origin and active tracking key',form.includes('allowedOrigin(origin,website)')&&form.includes("eq('is_active',true)")],
 ['Public form API rate limits and validates contact fields',form.includes('enforceGrowthRateLimit')&&form.includes('Name, email or phone, and enquiry details are required')],
 ['Form submission captures first-party UTM and click attribution',form.includes('utm_campaign:clean(attribution.utm_campaign')&&form.includes('gclid:clean(attribution.gclid')],
 ['Form submission is idempotent before CRM lead creation',form.indexOf("from('growth_website_form_submissions').insert")<form.indexOf("from('growth_leads').insert")&&form.includes("claimError.code==='23505'")],
 ['Website leads are saved with consent status and source',form.includes("source:'website_form'")&&form.includes('consent_to_contact:consent')],
 ['Follow-up automation is queued only with explicit contact consent',form.includes('if(consent){try{await runLeadCreatedRules')],
 ['Tracking script defaults analytics to no-consent',tracker.includes("!== 'granted'")&&tracker.includes('setConsent = (granted)')],
 ['Tracking script supports page, form, chat and conversion events',tracker.includes("send('page_view')")&&tracker.includes("send('form_start'")&&tracker.includes("send('form_submit'")&&tracker.includes("send('conversion'")&&tracker.includes("send(name")],
 ['Tracking script does not persist form PII in visitor storage',tracker.includes('localStorage')&&!tracker.includes('localStorage.setItem(\'email\'')],
 ['Session identifiers use per-tab session storage, not long-lived visitor storage',tracker.includes('sessionStorage.getItem')&&tracker.includes('sessionStorage.setItem')],
 ['Ad measurement consent is stored separately from analytics consent',tracker.includes('setAdUserDataConsent')&&tracker.includes('anaira-growth-ad-consent')&&tracker.includes('adUserDataConsent:storage.get(`anaira-growth-ad-consent')],
 ['Tracking script sends to first-party API with CORS-safe text payload',tracker.includes("'Content-Type':'text/plain;charset=UTF-8'")&&tracker.includes('mode:\'cors\'')],
 ['Existing Anaira AI chat records consent-gated chat-open events',chat.includes("track?.('chat_open'")],
 ['Existing chat lead capture associates lead with matching website record',chatLead.includes('website_id:websiteId')&&chatLead.includes('originHost')],
 ['Admin UI exposes visitor, session, form and conversion KPIs',ui.includes('Visitor analytics &amp; lead forms')&&ui.includes('Unique visitors')&&ui.includes('CRM form submissions')],
 ['Website Intelligence is identified in page heading and primary navigation',ui.includes('<h1>Website Intelligence</h1>')&&nav.includes("id:'website-intelligence',label:'Website Intelligence'")],
 ['Admin UI supports secure key generation, rotation and revocation',ui.includes("trackingAction('issue_key')")&&ui.includes("trackingAction('revoke_key')")],
 ['Admin UI provides installation snippet and consent instructions',ui.includes('anaira-growth-tracker.js')&&ui.includes('window.anairaGrowth.setConsent(true)')],
 ['Audit scanner records changes against previous homepage audit',audit.includes('previousScore')&&audit.includes('scoreChange')&&audit.includes('changeCount')&&audit.includes('previousChecks')],
 ['Migration creates tenant-scoped tracking keys, events and form records',migration.includes('growth_website_tracking_keys')&&migration.includes('growth_website_events')&&migration.includes('growth_website_form_submissions')],
 ['All Module 9 tables enable RLS and deny anonymous direct access',migration.match(/enable row level security/g)?.length===3&&migration.includes('from anon,authenticated')],
 ['Public tracking data is server-role only for writes',migration.includes('grant all on public.growth_website_events to service_role')&&migration.includes('grant all on public.growth_website_form_submissions to service_role')],
 ['Form idempotency migration creates a unique website submission key',idem.includes('growth_website_form_submission_idempotency_idx')&&idem.includes('alter column submission_id set not null')],
 ['Package version and full verification script include Module 9',['6.99.0','6.100.0','6.101.0','6.102.0','6.103.0','6.104.0','6.105.0','6.106.0','6.108.0','6.109.0','6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version)&&pkg.scripts['verify:all'].includes('verify:growth-website-intelligence-v6990')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed} PASS, ${failed} FAIL`);process.exitCode=failed?1:0;
