# Anaira Graphics & Digital Solution — Portfolio Website

A Next.js 15 portfolio website with Supabase-powered editable content and an admin CMS, designed for deployment on Vercel.

## Included
- Luxury editorial visual system: deep forest green, antique gold, oversized serif typography, framed hero, refined motion and premium responsive cards
- Homepage, services, about, portfolio filters and contact enquiry form
- Separate portfolio types: Anaira products, client software, websites, creative work
- Admin login using Supabase Auth
- Admin project CRUD: add/edit/delete, category, type, descriptions, live URL, technologies, featured order and image URL
- Direct image uploads from Admin to Supabase Storage (10 MB limit; PNG/JPG/WebP/GIF/SVG)
- SQL setup automatically creates the public `portfolio-media` bucket and admin-only upload/update/delete policies; no service-role key is exposed in the browser
- Editable company details, homepage copy, CTA labels and social links
- Supabase SQL schema, seed portfolio projects and RLS policies

## Local setup
1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`. This creates the database tables, seed portfolio content, RLS policies and the `portfolio-media` Storage bucket automatically.
3. In Supabase Authentication, create an admin user with email/password.
4. In SQL Editor, grant that user admin access (replace with the user's Auth UID):

```sql
insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');
```

5. Copy `.env.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

6. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and `http://localhost:3000/admin`.

## Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel, import that repository.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Project Settings → Environment Variables (Production, Preview and Development as needed).
4. Deploy. Vercel will run `npm run build` automatically.
5. Add your custom domain in Vercel → Settings → Domains and update DNS as instructed by Vercel.
6. Set `NEXT_PUBLIC_SITE_URL` to the final public URL and redeploy.

## Admin usage
Visit `/admin`, sign in using the Supabase Auth admin user, and use:
- **Projects & Portfolio** to create, edit, delete, upload images and reorder projects.
- **Website Settings & Text** to update company details, headings, about text, contact information, social URLs, logo and hero background image.
- Image upload fields send files directly to your Supabase Storage bucket and save the resulting public URL into the relevant project/site setting.

## Visual direction
The public site uses a bespoke luxury editorial direction: forest-green canvas, muted gold detailing, Playfair Display headline typography, fine framing, dark portfolio cards and a contrasting warm-stone services/contact treatment. The content remains editable from the CMS.

## Important before public launch
- Replace placeholder phone/email/contact details in Admin.
- Add genuine project screenshots and approved live URLs. Existing portfolio entries are starter records based on the project names supplied; some descriptions are deliberately generic until confirmed.
- Add final logos and hero imagery in Admin / project records.
- Add a privacy policy and spam protection (e.g. CAPTCHA/rate limiting) before running paid traffic.
- Use only client-approved screenshots, logos and case-study details.

## Notes
- Do not put Supabase `service_role` keys in `NEXT_PUBLIC_` variables or browser code.
- Admin write access is restricted by the `admin_users` table and RLS policies in the included SQL.
- If Supabase is not configured, the public site falls back to the starter portfolio data, while CMS sign-in remains unavailable.


## Expanded services (v2.1)
The Services section now includes editable offerings for:
- Graphic Design & Brand Identity
- Social Media Marketing & Account Handling (Facebook / Instagram)
- Paid Advertising & Campaign Management (Meta, Google, YouTube)
- Content Creation, Reels, Copywriting and Ad Creatives
- SEO, Local SEO and Google Business Profile optimization
- Website & E-commerce Development
- Software, POS, CRM and ERP Development
- Digital Consulting, Website Maintenance and Support

### Apply the update to an existing Supabase database
Run `supabase/migrations/20261108000100_add_social_media_marketing_services.sql` in the Supabase SQL Editor. It updates only the `services` and `services_intro` keys in the `main` site settings record and preserves the other settings.

### Edit services
Sign in at `/admin`, open **Website Settings & Text**, edit the `Services` JSON list, and save. The service cards on the homepage read from this saved setting.

### Media uploads
Project images, logo and hero background uploads use the `portfolio-media` Supabase Storage bucket. Run `supabase/schema.sql` once on a fresh Supabase project to create the bucket, tables and policies. Never put a Supabase service-role key in browser or public Vercel variables.

## Department-wise project management (v2.2)
The Admin CMS now has separate department filters and a department-specific **Add Project** action for:
- Graphics & Printing
- Website Development
- Software Development
- Social Media Management
- Digital Advertising
- SEO & Digital Growth
- Content & Reels
- Branding & Identity

Each department can create, edit and delete its own portfolio entries. Project fields include title, category, department, portfolio type, summary, full description, live URL, technologies, featured status, display order and direct Supabase Storage image upload. The public portfolio filters by the same departments.

### Existing Supabase database upgrade
Run `supabase/migrations/20261108000200_add_project_departments.sql` in the Supabase SQL Editor before deploying this version. On a fresh database, run `supabase/schema.sql` instead; it includes the `department` column and seeds the existing portfolio items.

### Editable services
The service catalogue remains in Website Settings & Text as editable JSON. Update service titles/descriptions there; portfolio projects are managed separately under their department tabs.


## Anaira Supabase connection (configured)
- Project: `Anaira Graphics & Digital Solution`
- Project ref: `nrsdqrqkffhbicfskilb`
- Region: `ap-northeast-1`
- Local environment file: `.env.local` (uses the publishable key; never add a secret/service-role key to browser env)
- `.env.local` is ignored by Git. For Vercel, add the same URL and publishable key as Environment Variables.

The connected Supabase project was found and is active. At package preparation time, its `public` schema had no application tables and Storage had no buckets. Run `supabase/schema.sql` once in that project's SQL Editor to create portfolio tables, seed records, RLS policies and the `portfolio-media` bucket. Create the first Auth user and add its UUID to `public.admin_users` as described above.

## v3.1 additions
- Separate Privacy Policy and Terms & Conditions pages.
- Premium About and enquiry-focused Contact pages.
- Business address: Near Petrol Pump, Akhara Bazar, Kullu 175101, Himachal Pradesh, India.
- Phone/WhatsApp: +91 97365 80084.
- Click-to-call and WhatsApp enquiry actions.
- Facebook and Instagram footer icons; URLs are managed in Admin > Website Settings (facebook, instagram, linkedin fields).
- Contact form stores enquiries in Supabase `public.inquiries`; department is included in the message field.
- Legal pages are general templates and should be reviewed for your actual practices before publication.

## Website enquiry email notifications
Website enquiries are saved to the Supabase `inquiries` table when Supabase is configured. To also email every enquiry to `anairagraphicsdigitalsolution@gmail.com`, configure Resend on the deployment:

- `RESEND_API_KEY`: a Resend API key.
- `RESEND_FROM_EMAIL`: a sender address on a domain verified in Resend (for example `Anaira Website <website@yourdomain.com>`).

Add both as Vercel Environment Variables and redeploy. The destination is already set to `anairagraphicsdigitalsolution@gmail.com`. Without these mail settings, the form can still save to Supabase, but email delivery is not enabled.


## Homepage Hero Studio (v3.6)
In Admin CMS → Website Settings & Text → Homepage Hero Studio:
- Upload multiple hero images directly to the `portfolio-media` Supabase Storage bucket.
- Remove a slide or reorder slides with the arrow controls.
- Configure overlay colour and strength, heading/highlight/body text colours.
- Configure image fit and focal position, transition (fade, slide, zoom/fade, horizontal scroll), autoplay and interval.
- Use previous/next arrows and slide indicators on the public homepage.
- Save Website Settings to publish changes. Supabase schema and Storage bucket must be initialized first.


## Dynamic brand logo (v6.32)
The header and footer now read `logo_url` from the public `site_settings` row (`id=main`) and use `/anaira-logo.png` only as a fallback. In Admin → Website Settings & Text → General Settings, upload the logo, then click **Save Website Settings**. The uploaded Supabase Storage URL is then used by both header and footer.


## AI Growth Engine v6.43

Phase 2 adds CRM lead scoring/status controls, follow-up tasks, content approval and schedule-queue controls, and campaign lifecycle records. Apply `supabase/anaira-ai-growth-phase2.sql` before deploying. See `ANAIRA-AI-GROWTH-SETUP.md` for credential and provider prerequisites.


## Anaira AI Growth Engine v6.45

The `/admin/ai-growth` workspace now includes tenant CRM, lead scoring, follow-up tasks, content approval and scheduling, editable AI knowledge base, automation rules, 30-day analytics, Meta OAuth, WhatsApp text webhook AI replies, and a protected Vercel Cron publishing/WhatsApp job worker. See `ANAIRA-AI-GROWTH-SETUP.md` for required provider environment variables and integration limitations.

### v6.47 Meta messaging webhook

Instagram DM and Facebook Messenger inbound webhook endpoint: `/api/growth/meta/messaging-webhook`. Configure the Meta Webhooks callback URL on the production domain, verify with `META_WEBHOOK_VERIFY_TOKEN`, subscribe Page `messages` and Instagram `messages`, and request `pages_messaging` / `instagram_manage_messages` permissions. Meta App Review and eligible professional/Page accounts are required. Messaging is limited by Meta's conversation windows and platform policies. See `ANAIRA-AI-GROWTH-SETUP.md` for details and known limitations.


## v6.48 — Inbox and email handoff update
- Added authenticated workspace inbox API with conversation listing, assignment to workspace members, human takeover (pauses automated Meta DM replies), resume and close actions.
- Added conversation assignment, human-handoff and last-message timestamp migration.
- Added consent-checked Resend email queue endpoint and worker delivery support. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; the sender domain must be verified with Resend.
- Email jobs require a lead with explicit `consent_to_contact=true`; worker retries transient failures and records terminal failures.
- Full social platform analytics, visual branching workflow designer, paid ads management, media upload/storage UI, LinkedIn/YouTube publishing and full external-provider E2E certification remain outside this release.


## AI Growth Engine media uploads (v6.51)
The Social Content Studio uploads media through the authenticated `/api/growth/media` endpoint. Configure `GROWTH_MEDIA_BUCKET` optionally (defaults to `growth-media`). The server's Supabase service-role key needs Storage bucket-management and upload permissions. Uploaded social assets are public-read because Meta's current publishing flow fetches media by URL. Do not store private customer documents in this bucket. Images are limited to 12 MB; MP4/MOV videos to 80 MB. New content remains draft and requires the existing approval workflow.


## AI Growth Engine — v6.52 multi-step workflow runtime
Apply `supabase/migrations/20261109123000_growth_multistep_workflows.sql` before deploying. The Control Center now builds sequential Lead Created workflows with up to 12 steps: create follow-up, admin review, wait/delay, consent-gated WhatsApp, and consent-gated email. Workflows save disabled; an owner/manager must review and enable them. The protected worker advances one step per run, persists run status, and uses an atomic database claim function to reduce duplicate concurrent execution. Configure the existing `CRON_SECRET`; the Vercel Hobby schedule remains daily, so delayed steps may execute later than their requested due time unless a more frequent external scheduler calls the worker. Delivery is at-least-once around provider/network failures; inspect run/job logs before manually retrying.

## AI Growth Engine v6.53 — Meta Insights
- The Growth Control Center now has a **Sync Meta Insights** action for connected Facebook Pages and Instagram Professional accounts.
- The authenticated endpoint persists read-only provider metrics in `growth_social_insights`; owners/managers trigger sync and workspace viewers can inspect saved snapshots.
- Apply `supabase/migrations/20261109143000_growth_social_insights.sql` on installations that have not received the migration. It is already applied to the connected Anaira Supabase project.
- Meta OAuth now requests `read_insights`, `instagram_manage_insights`, and `ads_read` in addition to existing publishing/messaging scopes. Meta App Review and account eligibility may be required; unsupported metrics are reported per account.
- `ads_read` is for future read-only reporting only. This release does not create ads, change budgets, or publish to LinkedIn/YouTube.


## v6.54 — Meta Ads Reporting (read-only)

- Added `/api/growth/ads-insights` GET/POST endpoints.
- Added campaign-level Meta Ads Insights sync using a connected Facebook Page token and manually supplied Meta Ad Account ID.
- Added tenant-scoped `growth_ads_insights` snapshots with RLS and unique period key.
- Added Control Center UI for read-only spend, impressions, reach/clicks/CPC/CTR and campaign rows.
- Requires Meta `ads_read` permission, eligible app access and Ad Account access. This release does not create, edit, pause or publish ads and cannot spend budget.
- Migration: `20261109160000_growth_meta_ads_reporting.sql`.
- Provider sync and full production build still require user credentials and local dependency installation.


## AI Growth Engine — v6.55 LinkedIn and YouTube publishing foundation

- Added manager-only OAuth initiation at `/api/growth/social-connect` for LinkedIn and YouTube.
- Added one-time, expiring OAuth callbacks at `/api/growth/social-callback/linkedin` and `/api/growth/social-callback/youtube`; provider tokens are AES-256-GCM encrypted before being saved to the tenant's connected social account.
- LinkedIn publishing uses the LinkedIn Posts API and requires `openid profile w_member_social` product access. This release publishes text-only LinkedIn posts; image/video asset publishing is not included.
- YouTube publishing uses the resumable Data API upload flow, requires a public HTTPS video URL and an offline refresh token, and rejects videos larger than 80 MB. Videos default to **private**. Set `YOUTUBE_DEFAULT_PRIVACY_STATUS=public` only after the owner explicitly chooses public publishing.
- YouTube refresh tokens are used to refresh expired access tokens. LinkedIn token renewal/refresh is not automated; reconnect when LinkedIn credentials expire.

### Additional Vercel environment variables

```env
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://YOUR-DOMAIN/api/growth/social-callback/linkedin
LINKEDIN_API_VERSION=202501
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN/api/growth/social-callback/youtube
YOUTUBE_DEFAULT_PRIVACY_STATUS=private
```

Register both exact callback URLs in their respective developer consoles. Apply `supabase/migrations/20261109173000_growth_linkedin_youtube_oauth.sql` before connecting these providers. OAuth consent, provider app verification, account eligibility, quotas and actual posting still require owner credentials and external E2E testing.

## AI Growth Engine — v6.56 Meta campaign draft and paused submission

- `GET /api/growth/ads-campaigns?organizationId=...` lists tenant campaign drafts.
- `POST /api/growth/ads-campaigns` saves a draft only; it does not contact Meta or spend budget.
- `PATCH /api/growth/ads-campaigns` requires owner/manager permission and a connected Facebook account with `ads_management`. It creates the Meta campaign in `PAUSED` state only. It does not create ad sets, creatives, ads, or activate delivery.
- Configure the Meta app/account with the required Marketing API access and `ads_management` permission before using approval.
- Apply migration `20261109150000_growth_meta_campaign_drafts.sql` (already applied to the connected Anaira Supabase project for this release).
- Budget is stored as a draft planning field in currency minor units; it is not sent to Meta by this endpoint.


## v6.58 — Meta Ad Creative Studio
- Added tenant-scoped creative drafts for single image, single video and carousel formats.
- Added authenticated GET/POST API with role checks, public HTTPS URL validation, CTA allowlist and optional workspace-owned Ad Set association.
- Added Control Center form and saved-draft list.
- Saving a creative is draft-only; Meta creative/ad submission and campaign activation are not implemented in this increment.
- Applied Supabase migration `growth_meta_creative_drafts_v658`; RLS and grants verified.


## v6.59 Meta Ad Set Submission

- Added `ads_management` to the Meta OAuth permission request and the saved Facebook Page scope record. Existing connections must reconnect and grant this permission.
- Added owner/manager-only Ad Set submission using the saved campaign provider ID, Ad Set budget and targeting. Meta Ad Sets are created with `PAUSED` status only.
- Added Campaign and Ad Set builder UI in the Growth Control Center.
- Ad Set submission requires a previously submitted Meta campaign, a connected Facebook Page with recorded `ads_management`, a positive daily budget and `targeting.geo_locations`.
- Meta Creative submission, actual Ad creation/linking, campaign activation and conversion attribution remain incomplete.
- Syntax validation is not a full Next.js build or live Meta API certification.


## v6.60 — Meta Creative Submission and Ad Creation

- Adds owner/manager-only Meta single-image creative submission to `/{ad_account_id}/adcreatives`.
- Requires a submitted (PAUSED) parent Ad Set, connected Facebook Page, and recorded `ads_management` scope.
- Adds `growth_ad_drafts` with tenant RLS and a unique creative-to-ad draft relationship.
- Adds Ad draft creation and owner/manager submission to Meta `/{ad_account_id}/ads`.
- All created Meta Ads are explicitly `PAUSED`; no campaign activation or spend is initiated.
- UI now links an Ad Set, submits eligible image creative, creates an Ad draft, and submits the Ad.
- Video and carousel are draft-only; their Meta media upload / child attachment pipeline is not implemented.
- Requires migration `growth_meta_ad_drafts_v660` (file `20261109210000_growth_meta_ad_drafts.sql`).
- Live Meta calls still require valid app review, actual `ads_management` grant, ad account permissions, and valid media URLs.


## v6.61 — Video/Carousel Creative and Conversion Attribution

- Extends Meta creative submission to IMAGE, VIDEO (remote HTTPS file URL uploaded to Meta `advideos`) and CAROUSEL (2–10 public image URLs).
- Adds consent-gated Meta Conversions API endpoint at `/api/growth/conversions`.
- Requires pre-hashed SHA-256 user identifiers; raw email/phone are rejected.
- Deduplicates conversion events per organization and event ID, stores provider result and status.
- Adds activation status columns to Campaign, Ad Set and Ad draft tables. All objects remain PAUSED by default; no automatic activation endpoint is exposed.
- Requires migration `growth_conversion_attribution_v661` (file `20261109220000_growth_conversion_attribution.sql`).
- Required Vercel vars for CAPI: `META_PIXEL_ID`, `META_CONVERSIONS_ACCESS_TOKEN`, `META_GRAPH_API_VERSION`.
- This endpoint is not a browser pixel and does not collect consent itself; caller must record explicit consent and submit only lawful, pre-hashed identifiers.


## v6.62 — Guarded Meta Campaign Activation

- Adds owner-only campaign activation and emergency pause endpoint at `/api/growth/ad-activation`.
- Activation requires explicit `ACTIVATE` confirmation, connected Facebook account with `ads_management`, submitted Campaign/Ad Sets/Ads, and a caller-provided maximum daily budget cap.
- Verifies the combined Ad Set daily budget does not exceed the approved cap.
- Activates Ads, then Ad Sets, then Campaign. If a provider step fails, previously activated objects are rolled back to PAUSED where possible.
- Emergency pause requires owner role and typed `PAUSE` confirmation.
- Adds `growth_ad_activation_audit` for activation/pause audit history.
- Requires migration `growth_ad_activation_audit_v662` (file `20261109230000_growth_ad_activation_audit.sql`).
- Activation is an explicit user action; this release does not automatically activate campaigns or initiate spend.
- Meta live activation, rollback behavior, and full Next.js build require deployment credentials and provider test account for verification.


## v6.63 — Unified Inbox Human Replies

- Adds authenticated `POST /api/growth/inbox/reply` for manual replies in Instagram DM, Facebook Messenger and WhatsApp conversations.
- Meta replies resolve the exact Page/account ID captured on the inbound message; WhatsApp uses the configured phone-number ID and access token.
- Agent role is restricted to conversations assigned to that agent; owner/manager can reply across the workspace.
- Sending a human reply keeps the conversation handed off so AI does not resume automatically.
- Adds idempotency reservation through `growth_webhook_events` to prevent duplicate submissions from repeated client requests.
- Inbox UI now includes a human reply composer and distinguishes Anaira Team messages from customer messages.
- Meta/WhatsApp provider delivery requires valid production credentials, app permissions and an eligible conversation window. Live delivery has not been tested here.


## v6.64 — WhatsApp Human Handoff Guard

- WhatsApp inbound webhook now checks conversation `needs_human` / `handed_off` before invoking OpenAI or sending an automated response.
- When a conversation is under human takeover, incoming messages are appended to the existing conversation and webhook event is marked processed; no AI reply is generated.
- WhatsApp manual free-form replies are blocked when the most recent inbound customer message is older than 24 hours. Use an approved WhatsApp message template for later business-initiated follow-up.
- WhatsApp conversation updates now persist `last_message_at` consistently.
- No schema migration required.
- Live WhatsApp webhook and 24-hour policy behavior require a configured Meta test number for E2E verification.


## v6.65 — Contact Consent & Opt-out Lifecycle

- Adds consent evidence fields to `growth_leads`: consent timestamp, source, method, opt-out timestamp and opt-out source.
- Adds owner/manager-only `PATCH /api/growth/lead-consent` for recording confirmed opt-in or immediate opt-out.
- Website lead capture records explicit checkbox consent metadata.
- WhatsApp STOP / UNSUBSCRIBE / CANCEL / END / QUIT keywords revoke contact consent and suppress the sales AI response; a one-time opt-out acknowledgement is attempted.
- Email and WhatsApp workers re-check opt-out status at delivery time, not only when a workflow is queued.
- Multi-step workflows block outbound sends when a lead has opted out.
- Growth dashboard adds Record consent / Opt out controls with source confirmation.
- Supabase migration `growth_contact_consent_lifecycle_v665` applied and new columns/index verified.

## v6.66 — WhatsApp webhook reliability and source verification

- Human handoff and STOP opt-out are processed even if the OpenAI API key is missing. Automatic AI replies still require OpenAI configuration.
- STOP opt-out database errors now prevent a false success response. An unsuccessful one-time opt-out acknowledgement no longer incorrectly marks the successful opt-out as a failed webhook.
- Adds reproducible `npm run verify:syntax` command using the project TypeScript dependency.
- Run `npm install`, `npm run verify:syntax`, `npx tsc --noEmit`, and `npm run build` in an internet-connected CI or development environment before production deployment.
- Meta/WhatsApp real-provider E2E testing remains pending.


## v6.67 — Workflow WhatsApp Dispatch & 24-hour Policy Guard

- Fixed workflow action routing: `queue_whatsapp` now creates the `send_whatsapp` job type consumed by the worker (previously the worker would reject it as unsupported).
- Worker rechecks lead consent and opt-out state before sending.
- Free-form workflow WhatsApp messages now require a linked conversation with a customer message inside the last 24 hours. Outside that window, the job is blocked and requires an approved WhatsApp template; template sending is not yet implemented in this worker.
- Added `npm run verify:growth-worker` static regression checks.
- No Supabase schema migration required.


## v6.68 — Approved WhatsApp Template Manager

- Adds tenant-scoped WhatsApp template registry with RLS enabled and service-role-only table access.
- Adds manager-only template draft creation, submission status and explicit confirmation that approval was checked in WhatsApp Manager.
- Adds approved template send queue API; sending is asynchronous through the protected worker.
- Worker sends Cloud API `type=template` messages, validates organization-scoped template approval, variable count, active contact consent and opt-out status.
- Multi-step workflow builder supports `queue_whatsapp_template`, resolving configured variables from lead fields.
- Meta template creation/review is still performed in WhatsApp Manager; Anaira does not claim provider approval or create templates on Meta automatically.
- Supabase migrations `growth_whatsapp_template_manager_v668` and `growth_whatsapp_template_job_type_v668` applied; template table, indexes, RLS/grants and the worker job-type constraint verified.


## v6.69 — Social Performance Analytics UI

- Replaces the minimal metric-name list with a dedicated Social Performance Analytics view.
- Adds selectable 7/14/30-day sync windows for eligible connected Facebook Pages and Instagram Professional accounts.
- Displays the latest provider-returned observations, prior-day comparisons where available, account/platform, reporting window, sync time and provider errors.
- Reuses the existing `growth_social_insights` snapshots; no database migration required.
- Values are shown as returned by Meta. They are not blended across platforms or misrepresented as unique cross-platform totals.
- Live provider metrics remain dependent on Meta permissions, account eligibility and current Graph API metric support.


## v6.70 — Meta Ads Optimization Advisor

- Adds organization-scoped read-only `GET /api/growth/ads-optimization`.
- Analyses latest synced Meta campaign insights and compares campaign IDs against the previous available snapshot for the same ad account.
- Rule-based flags include low CTR, rising CPC, spend without clicks and CTR decline.
- Adds a Growth Control Center recommendations panel with source snapshot, metrics, priority and suggested human review.
- No budget, bid, campaign, ad-set or ad status is changed; no provider write calls are made by the advisor.
- No database migration required; uses existing `growth_ads_insights` snapshots.
- Recommendations are heuristic, depend on the metrics returned by Meta, and are not proof of attribution or guaranteed performance.


## v6.71 — LinkedIn Image Publishing

- LinkedIn scheduled posts can now publish one JPG, PNG or GIF image alongside commentary.
- Worker initializes an image asset through LinkedIn Images API, uploads the bytes to the returned upload URL, then attaches the resulting image URN to the Posts API request.
- Enforces HTTPS source URL, supported image MIME type, 10 MB transfer cap, and a single-image limit. Multiple images/carousels are rejected explicitly rather than silently truncated.
- Text-only LinkedIn publishing remains supported. LinkedIn video and carousel publishing remain out of scope for this release.
- Requires the connected LinkedIn member token to have the required LinkedIn posting/image permissions and the configured `LINKEDIN_API_VERSION`.


## v6.72 — YouTube Publishing Lifecycle Monitor

- Adds an authenticated, organization-scoped read-only YouTube video status endpoint.
- Refreshes expired Google OAuth access tokens and persists the rotated access token securely.
- Reads YouTube upload status, processing status/progress, failure/rejection reason and available statistics.
- Adds a Growth Control Center panel to select a connected YouTube channel and inspect a video ID.
- Uses the existing YouTube OAuth `youtube.readonly` scope; no database migration required.
- Does not retry or resume interrupted uploads; this monitor reports provider state only.


## v6.73 — YouTube Resumable Upload Recovery

- Replaces the one-shot YouTube video PUT with bounded 8 MB resumable chunks.
- Persists encrypted Google resumable session URLs and byte offsets in `growth_youtube_upload_sessions`.
- On worker re-entry, probes YouTube for the server-acknowledged byte range before resuming; this handles a lost response after a chunk was accepted.
- Partial progress requeues the same publish job without consuming its normal failure-attempt budget.
- Provider video ID is persisted to make completion idempotent if the worker exits after upload completion but before updating the content row.
- Sessions are scoped by organization/content/account and expire after six days; expired sessions are restarted on the next worker run.
- Migration: `20261109010000_growth_youtube_resumable_upload_sessions.sql`.
- Session URLs are encrypted at rest. Table RLS is enabled; anon/authenticated have no table privileges; service_role only.
- Maximum supported video size remains 80 MB and each worker invocation uploads for up to 25 seconds before yielding. Frequent continuation requires a scheduler that calls the protected worker endpoint.


## v6.74 — LinkedIn Multi-Image Publishing & Unified Analytics

- LinkedIn publishing worker now uploads multiple image assets individually through the Images API and creates an organic `multiImage` post through the Posts API.
- Enforces 2–20 images for explicit carousel content; rejects more than 20 images, non-public URLs, unsupported MIME types and images above 10 MB each.
- Keeps single-image publishing behavior intact; image assets are not silently dropped.
- Adds a unified Social & Ads Analytics panel showing latest saved Facebook/Instagram snapshots and Meta Ads snapshots per account.
- Keeps provider metrics and currencies separate; spend is shown as provider units because the stored snapshot does not persist account currency.
- No new database migration required. Uses existing social and ads insights snapshot tables.
- LinkedIn multi-image publishing requires the applicable LinkedIn write permission and author asset ownership; live provider publishing has not been run in this environment.


## v6.75 — YouTube Advanced Analytics

- Adds channel-level YouTube Analytics reports for views, watch time, average view duration, likes, comments and subscriber gain/loss.
- Supports 7, 28 and 90 day windows; excludes the latest two days to reduce partial-report confusion.
- Adds the `yt-analytics.readonly` OAuth scope and requires a channel reconnect to grant it.
- Refreshes Google OAuth credentials server-side and keeps tokens encrypted.
- No database migration required. Live channel report access depends on YouTube Analytics API enablement and OAuth consent.


## v6.75.1 — Release readiness patch
- `.env.example` now lists the source-referenced Google, YouTube, LinkedIn, Meta Conversions API, media and worker variables.
- See `RELEASE-READINESS-v6.75.1.md` for exact callback URLs, remaining provider setup and production acceptance tests.
- This patch has source syntax and static regression validation; it is not a full Next.js build or live provider certification.


## v6.75.2 — Conditional workflow branching
- Workflow builder now supports lead-field conditions on temperature, status and source.
- Supports equals / not-equals / contains comparisons and bounded false-branch step skipping.
- See `RELEASE-READINESS-v6.75.2.md` for validation results and remaining production gates.


## v6.75.3 — Lead lifecycle workflow triggers
- Added workflow triggers for lead status and temperature transitions.
- See `RELEASE-READINESS-v6.75.3.md` for deployment and remaining production acceptance gates.


## v6.75.4 — Workflow trigger UI
- Exposes lead-created, lead-status-changed and lead-temperature-changed trigger selection in Growth Control Center.


## v6.75.5 — Growth worker scheduler
- Added a Vercel Pro one-minute scheduler profile (`vercel.pro.json`).
- Added a GitHub Actions five-minute scheduler fallback for Vercel Hobby deployments.
- Added scheduler setup instructions and regression checks. The default `vercel.json` remains Hobby-compatible.
- Run `npm run verify:all` for source syntax, growth-worker and scheduler static checks.


## v6.75.7 — Queue crash recovery
- Added a Supabase migration that recovers jobs left in `processing` after a worker crash or timeout.
- Jobs below the retry limit are requeued with bounded exponential backoff; exhausted jobs become `failed`.
- Atomic `FOR UPDATE SKIP LOCKED` claiming and service-role-only execution are retained.
- Added a dedicated static regression suite for queue recovery.

- Supabase migration `20261109160539_growth_job_stale_lock_recovery_v6756` applied and verified on the connected Anaira Graphics & Digital Solution project.


Latest release: v6.75.9. See `RELEASE-READINESS-v6.75.9.md` for live database changes, worker scheduler setup and outstanding production gates.


## ANAIRA AI GROWTH ENGINE v6.75.8

The Growth Engine release adds production public-endpoint smoke checks. See `ANAIRA-AI-GROWTH-SETUP.md` and `RELEASE-READINESS-v6.75.8.md` for scheduler configuration, Supabase security posture, and the remaining production certification steps. Run `npm run verify:all` for static regression checks and `npm run smoke:growth-public` after deployment.

## ANAIRA AI GROWTH ENGINE v6.75.9

Adds a GitHub Actions CI gate that installs dependencies, runs `npm run verify:all`, and executes `npm run build` on pushes and pull requests. The CI job uses build-only placeholder public Supabase values and does not expose production secrets. Run `npm run verify:all` locally; after pushing, confirm the `Anaira AI Growth CI` workflow passes before deploying. See `RELEASE-READINESS-v6.75.9.md` for certification boundaries and activation requirements.

---

## AI Growth Engine v6.77.0

See `RELEASE-READINESS-v6.77.0.md`, `LIVE-SUPABASE-VERIFICATION-v6.77.0.md` and `BILLING-SETUP-v6.77.0.md` for the CRM Customer 360 workspace, website human handoff, plan/subscription management, usage quotas, live migration verification and remaining production gaps.

## AI Growth Engine v6.78.0 — Multi-Number WhatsApp

Adds multiple tenant-owned WhatsApp Business phone numbers with globally unique Meta phone-number mapping, encrypted per-number credentials, receiving-number-aware conversations, and sender-consistent human replies/CRM/worker sends. Ambiguous sender selection fails closed. Migration `20261109170828_growth_whatsapp_multi_number_v678` was applied and verified on the linked Anaira Supabase project. Run `npm run verify:all`; see `RELEASE-READINESS-v6.78.0.md` and `LIVE-SUPABASE-VERIFICATION-v6.78.0.md`. Live Meta E2E and a full Next.js build remain separate certification steps.

## AI Growth Engine v6.79.0 — Workflow Versioning & Operations

Adds immutable tenant-scoped workflow version history, restore-as-new-version, safe no-side-effect simulation, workflow execution event logs, failed-run retry and queued/failed-run cancellation. Every workflow edit creates an unpublished version; legacy rules receive a baseline snapshot on first edit. Workflow history and event writes are restricted to server-side service-role APIs, with tenant-scoped authenticated reads. Three matching migrations were applied and verified on the linked Anaira Supabase project. See `RELEASE-READINESS-v6.79.0.md` and `LIVE-SUPABASE-VERIFICATION-v6.79.0.md`. The editor remains sequential rather than drag-and-drop; parallel graph branches, payment gateway, inbound email lifecycle, full provider E2E, production build and Vercel deployment remain outstanding.

## v6.79.0 verification

- Full regression suite: PASS (`npm run verify:all`).
- Workflow engine: 11/11 checks passed.
- Syntax: 118 TS/TSX files, zero syntax errors.
- Live Supabase workflow migrations and access controls verified.
- Full Next.js build and Vercel deployment not certified in this environment.
