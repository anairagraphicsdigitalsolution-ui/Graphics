# Anaira AI Growth Engine — Product Requirements Traceability

Release: **v6.90.3**  
Basis: user-provided 15-module product vision dated 2026-11-14 and inspected v6.90.1 source archive.  
Status vocabulary: **Source implemented**, **Partial**, **Not implemented**, **Live verification required**.

## Locked product decisions

1. **Business model:** dual use — Anaira's own workspace plus independent customer SaaS workspaces.
2. **Autonomy:** mixed autonomy. Low-risk research, drafting, scoring, summaries and analytics may run automatically within tenant quotas. External contact, publishing, ad spend, billing, account changes and destructive actions require explicit permissions and approval policy.
3. **Tenant isolation:** every tenant's leads, CRM, content, provider credentials, knowledge, usage, billing and audit trail remain isolated.
4. **Safety:** consent and suppression are rechecked at execution time; opt-out, quiet hours, provider policy, rate limits, audit events and human handoff are mandatory.
5. **Honest release status:** source checks do not imply provider certification or production readiness.

## Fifteen-module traceability

| # | Module | Source evidence | Current status | Remaining proof / gap |
|---|---|---|---|---|
| 01 | AI Command Center | `app/admin/ai-growth/overview/page.tsx`, `app/api/growth/briefing/route.ts`, `app/api/growth/readiness/route.ts` | Partial | Browser E2E, live tenant metrics reconciliation, scheduled delivery of briefing |
| 02 | Lead Intelligence | `app/api/growth/prospect-discovery/route.ts`, `app/api/growth/prospect-qualification/route.ts`, `app/api/growth/prospect-convert/route.ts` | Source implemented | Validate discovery coverage and scoring quality on representative live data; verify external search quota/credentials |
| 03 | CRM & Sales | `app/admin/ai-growth/crm/page.tsx`, `app/api/growth/lead*.ts`, meeting/proposal routes and CRM components | Source implemented | Browser lifecycle E2E, live email/customer response E2E and tenant penetration tests |
| 04 | AI Sales Agents | `app/api/growth/voice-calls/route.ts`, `app/api/growth/whatsapp/calling/permission/route.ts`, `app/api/growth/whatsapp/calling/calls/route.ts`, `app/admin/ai-growth/calling/page.tsx`, `services/voice-agent/` | Partial | Outbound WhatsApp Calling now has browser WebRTC SDP offer/answer signaling, permission-gated call initiation, termination, session audit and webhook lifecycle updates. Inbound call answering, production TURN/media reliability, Meta number eligibility and live call certification remain outstanding. Twilio voice remains a separate provider path. |
| 05 | AI Content Studio | `app/admin/ai-growth/marketing/page.tsx`, `app/api/growth/content/route.ts`, `app/api/growth/media/route.ts` | Partial | Verify end-to-end creative review, asset handling, publishing and content analytics across real provider accounts |
| 06 | Social Media | `app/admin/ai-growth/channels/page.tsx`, `app/api/growth/social-connect/route.ts`, social publishing/insights routes | Partial | OAuth/app-review eligibility and real publish/comment/inbox tests per provider |
| 07 | Campaign Manager | `app/admin/ai-growth/campaigns/page.tsx`, Meta campaign/adset/creative/ad and activation routes | Partial | Live Meta account permissions, attribution, approval/rollback E2E; Google Ads provider workflow not certified |
| 08 | SEO Intelligence | `app/admin/ai-growth/website-intelligence/page.tsx`, `app/api/growth/website-intelligence/route.ts` | Partial | External Search Console/GA4 OAuth, keyword/rank data providers and browser workflow certification |
| 09 | Website Intelligence | `app/api/growth/website-verification/route.ts`, `app/api/growth/website-intelligence/route.ts` | Source implemented | Live DNS verification and browser E2E against tenant-owned websites |
| 10 | WhatsApp & Email | `app/api/growth/inbox/route.ts`, `app/api/growth/email/route.ts`, WhatsApp integration/webhook routes | Partial | Live WABA templates/send/receive, verified sender/domain, bounce/complaint and webhook retry tests |
| 11 | Marketing Automation | `app/admin/ai-growth/automation/page.tsx`, `app/api/growth/automation/route.ts`, worker/scheduler/DLQ routes | Source implemented | Production worker cadence, concurrency, recovery drills and multi-tenant load test |
| 12 | Analytics & Reports | `app/admin/ai-growth/analytics/page.tsx`, `app/api/growth/analytics/route.ts`, briefing route | Partial | Reconcile attribution and provider totals against real ad/channel/customer revenue records |
| 13 | Customer Retention | `app/api/growth/retention/route.ts`, CRM retention UI and readiness metrics | Partial | Current implementation creates internal tasks only; consent-aware customer messaging journeys are not implemented as part of retention |
| 14 | AI Knowledge Hub | `app/api/growth/knowledge/route.ts` | Partial | Document ingestion/indexing, source citations, retrieval evaluation and adversarial cross-tenant tests |
| 15 | Integrations & Settings | `app/admin/ai-growth/integrations/page.tsx`, `app/api/growth/integrations/route.ts` | Partial | Test every tenant's actual OAuth/credential, token rotation, webhook, secret custody and incident lifecycle |

## Cross-cutting platform status

- Multi-tenant workspace, roles, team lifecycle, billing/entitlements, audit, usage and credential vault have source implementations.
- Platform Super Admin and tenant workspace views exist in source; operational and browser-level certification remains required.
- The workflow runtime includes schedules, retries, dead-letter handling and recovery foundations; production reliability is not certified.
- WhatsApp call permission and WhatsApp voice calling are separate workflows. The permission endpoint resolves tenant credentials with the correct organization ID. Outbound native calling now has browser WebRTC media/signaling; inbound call answering and production media reliability remain unimplemented.
- Twilio outbound voice is a separate provider path and must not be marketed as native WhatsApp Calling.

## Release blockers

1. Native WhatsApp Calling is implemented for outbound signaling/browser WebRTC, but inbound answering, production TURN/media reliability and real Meta certification remain outstanding.
2. Clean dependency installation and production `next build`; the inspected archive has no lockfile and no `node_modules`.
3. Real provider credentials/OAuth grants/webhooks and channel-by-channel E2E tests.
4. Two-tenant penetration tests, load/concurrency tests, backup/restore and worker failure drills.
5. Deploy the exact release and verify deployment SHA/version.
6. Identify the dedicated Growth Engine Supabase project before applying its 65 source migrations. Do not apply these migrations to a database merely because it is a connected Anaira project.

## v6.90.2 source correction

The readiness API referenced `meetingRows` and `proposalRows` without defining them, which would throw at runtime while constructing readiness metrics. It now defines both from the already tenant-scoped query results. Retention query errors are also included in operational data-health status. Regression checks cover these cases.

## Supabase project identification note

The connected project `bhptqdoteucuymmdzsmg` is named `Anairacrm0084's Project`. Its migration history and visible public lead tables belong to the wider Anaira CRM/platform schema; the Growth Engine-specific `growth_*` tables were not present in the inspected public-table query. It is therefore **not approved as the Growth Engine database target**. No Growth Engine migration was applied to it.
