# Anaira AI Growth Engine — Multi-Tenant foundation

## Portfolio separation
The public portfolio remains the existing Anaira website: `/`, `/portfolio`, `/gallery`, `/services`, `/software`, etc. Its `site_settings`, `projects`, and `inquiries` tables are unchanged. The Growth Engine is a separate admin workspace at `/admin/ai-growth`, linked from the existing Admin header.

## Included
- Multi-tenant organizations and memberships
- Multiple client websites per organization
- Tenant-scoped AI agent configuration records
- Website conversation records
- Tenant-scoped leads and lead temperature/status
- Social account connection metadata (no tokens stored in browser)
- Content calendar with approval statuses
- Campaigns and automation rule records
- AI usage log table
- RLS policies for tenant separation and Anaira platform-admin access
- Admin dashboard to create client workspaces, register websites, inspect leads and content queue

## Supabase deployment status (2026-11-09)
The two Growth Engine migrations have been applied directly to the connected production project `nrsdqrqkffhbicfskilb` (Anaira Graphics & Digital Solution):
- `20261109000100_anaira_ai_growth_multitenant.sql` — 11 tenant tables, RLS and private membership helpers.
- `20261109000200_anaira_ai_growth_fk_indexes.sql` — supporting indexes for foreign keys.

The initial Anaira organization and owner membership were seeded using the existing `public.admin_users` allow-list. Verification confirmed all 11 Growth Engine tables have RLS enabled and their expected policies. Do not rerun the SQL manually in production; the database is already updated.

For a fresh/staging project, apply the two migration files in timestamp order, then bootstrap an authorized Anaira admin account using the bootstrap SQL. Deploy the code, sign in through `/admin`, and open `/admin/ai-growth`.

The migration does not create a new project, modify the portfolio tables, or move the portfolio into tenant workspaces.

## Verification notes
- Live database: both migrations succeeded; initial Anaira owner workspace seeded.
- Security advisor still reports pre-existing public SECURITY DEFINER RPC exposure for `public.is_anaira_admin()` and `public.rls_auto_enable()`, plus leaked-password protection disabled. These were not changed because they are shared with the existing portfolio and require a separate review.
- Performance advisor's missing foreign-key indexes for Growth Engine were addressed by the second migration. Existing portfolio multiple-permissive-policy notices are unchanged.
- The dashboard had an undefined `websiteBusy` state; this has been corrected in this package.

## Important current limits
- This ZIP provides the secure multi-tenant database foundation and initial control dashboard. It is not yet an autonomous live marketing system.
- OpenAI API chat endpoint, website visitor embed/snippet, Meta OAuth app, Instagram/Facebook publishing permissions, WhatsApp Business Cloud API, webhooks, scheduler/worker, email delivery and billing are not activated by this migration.
- Do not paste service-role keys or Meta/WhatsApp access tokens into client-side settings. Future integrations must store credentials server-side (encrypted/secret store) and use official OAuth/API permissions.
- Content statuses support approval workflow, but actual publishing is not wired until Meta/other platform integrations are configured.
- Membership bootstrap is deliberately controlled by the Anaira platform admin. Client users must be invited/assigned membership; self-service signup is not enabled.
- Apply this SQL to a staging project first if possible, then production. Confirm existing admin_users and is_anaira_admin() from the portfolio schema are present.

## v6.42 implementation update (2026-11-09)

### Implemented in source
- Public floating Anaira AI sales chat (`components/ai-sales-chat.tsx`) available on the public website.
- Server route `POST /api/growth/lead`: validates required fields and explicit contact consent, verifies the linked conversation belongs to Anaira, and stores a website chat lead in `growth_leads`.
- Server route `POST /api/growth/chat`: loads the active Anaira workspace knowledge base, calls OpenAI server-side, stores conversation messages in `growth_conversations`, and logs token usage in `growth_usage_logs`.
- Admin AI Social Content Studio: authorized workspace members can generate content drafts. Drafts are saved to `growth_content` with `status='draft'`; no social publishing is performed.
- Server route `POST /api/growth/content` verifies the Supabase user access token and workspace membership before generation and persistence.
- Anaira workspace knowledge base populated with company overview, services, owned products, contact information and conservative sales guidance. No public price list is configured, so the AI must not invent prices.

### Required Vercel environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or existing anon key variable)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to browser)
- `OPENAI_API_KEY` (server-only)
- `OPENAI_MODEL` (optional; defaults to `gpt-4.1-mini`)

### Important boundaries
WhatsApp, Meta OAuth, Instagram/Facebook publishing, email delivery, background scheduling, and reliable distributed rate limiting are not implemented by this update. They require provider credentials, approved Meta app permissions, webhook configuration and/or a durable job runner. The public chat endpoint must be protected with production rate limiting/WAF before high-volume public launch. The usage log records token counts; exact spend is not calculated yet.

### Deployment checklist
1. Add the server-only variables in Vercel for Production and Preview as appropriate.
2. Redeploy the Next.js project.
3. Test the floating chat from a logged-out browser and confirm a conversation row is created.
4. Sign in to `/admin/ai-growth`, generate a draft, and confirm it appears in the approval queue with Draft status.
5. Do not enable live Meta/WhatsApp automation until OAuth scopes, webhook signatures, consent and approval workflow are verified.

## Phase 2 operational workflows (v6.43)
The additive migration `supabase/anaira-ai-growth-phase2.sql` adds lead scoring/follow-up fields and the tenant-isolated `growth_tasks` table. Apply it before using the v6.43 dashboard.

Implemented in this phase:
- Lead score (0–100) and Hot/Warm/Cold classification at website lead capture, plus admin lead status/temperature updates.
- Follow-up task creation and completion with due dates.
- Content draft submission, approval/rejection and scheduling queue state transitions. Scheduling stores a future timestamp; it does not publish without a configured publisher worker.
- Campaign draft creation, submission for approval, activation/pause/completion state transitions. Activating a record does not launch paid advertising.
- Authenticated server API routes validate the user's Supabase session and tenant membership before changing tenant data.

Still requires provider credentials / external setup: OpenAI key for live AI generation; Meta app credentials, business/page permissions, webhook URL and token encryption configuration for Facebook/Instagram; WhatsApp Business Cloud API account, phone number ID, access token and webhook verification. No external messages or social posts are sent by these workflow records alone.

## Phase 3 — operational integrations and control center (v6.44)

Added source modules:
- `/api/growth/knowledge` — tenant-authorized knowledge base and brand profile editor.
- `/api/growth/automation` — automation rule create/list/enable/disable. New rules default to disabled.
- `/api/growth/analytics` — last-30-day lead, content, campaign, task and usage rollups.
- `/api/growth/meta/connect` + `/api/growth/meta/callback` — Meta OAuth with one-time hashed state and AES-256-GCM encrypted page credentials.
- `/api/growth/whatsapp/webhook` — Meta signature validation, webhook event deduplication, inbound WhatsApp AI reply and conversation/lead capture. WhatsApp-created leads do not imply consent for future marketing follow-up.
- `/api/growth/whatsapp/send` — manager-only outbound messages; requires a lead phone and explicit contact consent.
- `/api/growth/worker` — protected durable queue worker with retry/backoff for scheduled Facebook Page and Instagram image/Reel publishing and consented WhatsApp jobs.
- `vercel.json` — five-minute cron schedule for the worker.
- Dashboard includes Knowledge Base editor, automation controls, social account connection, analytics and publishing-worker setup guidance.

### Phase 3 Supabase migration
The following production migrations have been applied: `20261109082213_anaira_ai_growth_phase3_integrations_worker`, `20261109082259_anaira_ai_growth_phase3_job_claim_rpc`, `20261109082405_anaira_ai_growth_phase3_webhook_deduplication`, `20261109082519_anaira_ai_growth_webhook_atomic_claim`, and `20261109082715_anaira_ai_growth_webhook_unique_key_inference`. The SQL source is `supabase/anaira-ai-growth-phase3.sql`.

### Additional Vercel environment variables
- `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_API_VERSION`
- `GROWTH_TOKEN_ENCRYPTION_KEY` — 32 random bytes encoded as base64 (or 64 hex characters); used for AES-256-GCM encryption at rest. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ORGANIZATION_ID`
- `CRON_SECRET` — Vercel Cron Authorization bearer secret.
- `NEXT_PUBLIC_SITE_URL`

Meta redirect URL must exactly match the Meta Developer App OAuth redirect allowlist. Configure WhatsApp webhook callback to `/api/growth/whatsapp/webhook`, subscribe to `messages`, and use `WHATSAPP_VERIFY_TOKEN`. Configure the Facebook Page Lead Ads webhook separately at `/api/growth/meta/webhook` with `META_WEBHOOK_VERIFY_TOKEN` and subscribe the Page object to `leadgen`. Meta app webhook signature validation requires `META_APP_SECRET`.

### Operational boundaries
- Meta app review, business verification, Page/Instagram permissions and account eligibility remain provider-side prerequisites.
- Instagram publishing needs a publicly accessible media URL; image posts and Reels are supported by the worker. Instagram Stories, multi-item carousel publishing, LinkedIn and YouTube publishing are not implemented.
- WhatsApp inbound automation handles text messages. Media, interactive buttons, templates and opt-in campaign broadcasts are not implemented. Outbound free-form messages are only sent to leads with explicit `consent_to_contact=true`; Meta's messaging window/template policies still apply.
- Automation rules currently support follow-up task creation, admin review task creation and consent-gated WhatsApp queueing for `lead_created`. Other trigger/action combinations can be stored but are not yet executed.
- Email jobs, billing, exact provider cost calculation, media uploads, campaign ad buying and analytics attribution are not implemented.
- Vercel Cron and provider credentials must be configured before scheduled jobs or external messaging can execute. Worker requires `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`.


## Phase 4 — public endpoint protection and Facebook Lead Ads (v6.45)

Implemented in this source update:
- Atomic database-backed rate limits for public website AI chat (20 requests / IP / minute) and lead capture (5 submissions / IP / 10 minutes). Only a SHA-256 digest is stored; raw IP addresses are not persisted. The endpoints fail closed if the rate-limit database function is unavailable.
- Production migration `20261109083000_growth_public_rate_limits.sql` creates an RLS-protected limiter table and a `service_role`-only atomic RPC. This migration has been applied to the linked Anaira production Supabase project and verified: table exists, RLS is enabled, service_role can execute, anon cannot.
- Facebook Lead Ads webhook at `/api/growth/meta/webhook`: verifies `X-Hub-Signature-256`, verifies the Meta webhook challenge, deduplicates leadgen events, retrieves lead form details with the connected Page token, and creates CRM leads. Facebook lead forms are imported with `consent_to_contact=false`; they are not automatically messaged.
- Meta OAuth now requests `leads_retrieval` in addition to existing Page/Instagram permissions. Meta App Review and Page webhook subscription are still required.
- OpenAI token usage now receives approximate INR cost estimates for the configured GPT-4.1 / GPT-4.1 mini / GPT-4o families. Unknown models remain unpriced (zero estimate); WhatsApp provider message fees are not calculated. Set `USD_TO_INR_ESTIMATE` to a current exchange-rate estimate.

### Facebook Lead Ads setup
1. Add `META_WEBHOOK_VERIFY_TOKEN` as a long random secret in Vercel.
2. In Meta Developer App → Webhooks, subscribe the **Page** object to the `leadgen` field and set callback URL to `https://YOUR_DOMAIN/api/growth/meta/webhook`.
3. Use the exact same verify token in Meta and Vercel. Keep `META_APP_SECRET` configured for request signature verification.
4. Reconnect Facebook from AI Growth Control Center after adding the `leads_retrieval` permission; the Page must be subscribed to the app for Lead Ads webhooks.
5. Submit a test lead through Meta's Lead Ads testing tool and confirm it appears in Anaira CRM with source `facebook_lead_ads`.

### Still not fully implemented / requires external credentials
- Instagram Direct Messages and Facebook Messenger conversational inbox automation are not included; Meta webhook currently processes Facebook Lead Ads only (WhatsApp has its separate text webhook).
- Email delivery and email follow-up workflow are not implemented, despite the optional legacy Resend variables in `.env.example`.
- Social analytics insights import, paid-ad campaign creation/spend, campaign attribution, image/video asset upload, Instagram carousel/Stories, LinkedIn and YouTube publishing remain out of scope. Campaign records are workflow metadata, not ad campaigns.
- Automation execution currently supports only `lead_created` with follow-up task, admin review task or consent-gated WhatsApp queue. A general-purpose visual workflow builder and other triggers are not present.
- Provider-side Meta review, verified business, approved scopes, Vercel deployment, API keys and public media URLs are still needed for live end-to-end tests.


## Phase 5 — automation execution consistency (v6.46)

- The automation API now accepts only combinations that the worker actually executes: `lead_created` with `create_follow_up`, `notify_admin`, or consent-gated `queue_whatsapp`. Unsupported trigger/action combinations are rejected instead of being saved as misleading inactive workflows.
- Facebook Lead Ads CRM imports now invoke the same lead-created automation engine. Since Lead Ads imports have `consent_to_contact=false`, WhatsApp follow-up actions are skipped; internal follow-up/review tasks can still be created.
- The Control Center now describes the currently executable automation scope accurately.

### Still not implemented
Instagram DM and Facebook Messenger inbox automation, email sending/follow-ups, multi-trigger visual workflow builder, social insights import, paid-ad campaign execution, media upload pipeline, Instagram carousel/Stories, LinkedIn/YouTube publishing, campaign attribution and full end-to-end provider certification. These remain explicit development items, not completed features.

## v6.47 — Instagram DM + Facebook Messenger webhook

- Meta OAuth now requests `pages_messaging` and `instagram_manage_messages` in addition to the existing Page, Lead Ads and publishing scopes. These permissions require the appropriate Meta App products, review/advanced access and Page/Instagram account eligibility.
- Configure a Meta Webhooks callback at `https://YOUR_DOMAIN/api/growth/meta/messaging-webhook` and use the same `META_WEBHOOK_VERIFY_TOKEN` configured for the Meta app. Subscribe the Page object to `messages` (and required messaging referral fields as needed); subscribe the Instagram object to `messages`.
- The endpoint validates `X-Hub-Signature-256`, deduplicates message IDs, stores conversations, creates a CRM lead with contact consent false, generates a knowledge-base-grounded AI reply and attempts a reply through the connected Page/Instagram account.
- The sender must have initiated the conversation; replies remain subject to Meta messaging-window, policy, permission and account restrictions. This webhook is not a bulk messaging or unsolicited follow-up system.
- CRM deduplication uses `growth_leads.external_contact_id` plus organization/source. The production migration `20261109103000_growth_social_dm_contact_identity` adds this nullable field and a partial unique index.
- This adds inbound DM automation, not a complete human-agent inbox, message assignment UI, attachments, comment automation, story replies or analytics ingestion. Those remain separate work.


## v6.48 — Inbox and email handoff update
- Added authenticated workspace inbox API with conversation listing, assignment to workspace members, human takeover (pauses automated Meta DM replies), resume and close actions.
- Added conversation assignment, human-handoff and last-message timestamp migration.
- Added consent-checked Resend email queue endpoint and worker delivery support. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; the sender domain must be verified with Resend.
- Email jobs require a lead with explicit `consent_to_contact=true`; worker retries transient failures and records terminal failures.
- Full social platform analytics, visual branching workflow designer, paid ads management, media upload/storage UI, LinkedIn/YouTube publishing and full external-provider E2E certification remain outside this release.
