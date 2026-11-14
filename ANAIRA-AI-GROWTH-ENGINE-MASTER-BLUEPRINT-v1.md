# Anaira AI Growth Engine — Master SaaS Blueprint
Version: 1.1
Target release baseline: v6.90.2
Scope: AI Growth Engine only. The public Anaira marketing website / portfolio CMS is explicitly out of scope.

## Product decision
**Locked business model:** Anaira internal workspace plus customer SaaS workspaces.

**Locked autonomy model:** mixed autonomy — low-risk internal work may run automatically within quotas; customer-facing, financial, publishing, spend-changing, account-changing and destructive actions require explicit permissions and approval policy.

Build a multi-tenant, multi-user SaaS platform that Anaira operates as Platform Owner and sells to independent businesses. Anaira also has its own tenant/workspace. Every customer organization receives an isolated workspace, provider connections, brand profile, knowledge base, members, leads, CRM, content, campaigns, workflows, analytics, usage and subscription.

Default autonomy model: mixed autonomy.
- Low-risk internal work (research, draft generation, scoring, summaries, analytics) can run automatically within quotas.
- External customer contact, publication, ad spend, account changes, financial actions and destructive operations require explicit tenant policy and/or human approval.
- All outbound communication must enforce channel eligibility, lawful basis/consent, suppression lists, quiet hours, provider policies and auditable opt-out.

## Platform topology
1. Platform Super Admin: tenant lifecycle, plan catalogue, entitlements, billing, usage, support, security events, provider health and platform-level settings.
2. Tenant Workspace: one business organization, with independent business profile, industry, products/services, ICP, locations, brand assets, knowledge base, provider credentials and usage limits.
3. Workspace Team: owner, business admin/manager, marketing manager, sales manager, sales agent, content editor, analyst/viewer and client viewer. Permissions must be enforced in server APIs and RLS, not only hidden in navigation.
4. Shared execution layer: durable queues, scheduler, workflow engine, webhook inbox, retries, dead-letter queue, idempotency, audit logs, rate limits and tenant-aware usage metering.

## Navigation and product areas
### 1. AI Command Center
KPI dashboard: new/discovered/qualified leads, contact eligibility, replies, appointments, pipeline, won revenue, content output, channel engagement, campaign spend, CAC, ROAS, queue health, provider health and AI usage. Daily AI briefing must cite underlying tenant data and distinguish facts from recommendations.

### 2. Lead Intelligence
ICP builder; approved source discovery; bounded website research; contact enrichment; source provenance; duplicate resolution; email/phone verification; company matching; lead scoring; evidence-backed qualification; segments; territory routing; import/export; discovery history; suppression and retention controls. A public contact record is not proof of consent or buying intent.

### 3. CRM & Sales
Configurable pipeline; Customer 360; contacts/companies; activities; tasks; notes; calls; messages; meetings; proposals; quotations; deals; products/services; revenue attribution; bulk actions; imports; attachments; assignment; SLAs; lost reasons; audit trail.

### 4. AI Sales Agents
Research agent, qualification agent, inbound website agent, voice agent, WhatsApp agent, email agent, follow-up agent, appointment agent and sales copilot. Each agent needs a tenant knowledge scope, tools/permissions, policies, usage cap, transcript/log, escalation path, human handoff and evaluation set. Voice must support real two-way conversation and opt-out; scripted TTS is not a conversational agent.

### 5. AI Content Studio
Brand-aware post/caption/reel script/blog/SEO/ad/email/product-copy generation; image/video creative workflow; multilingual content; campaign variants; brand templates; asset library; content calendar; review/approval; versioning; scheduling; publishing and post-publication metrics.

### 6. Social Media
Tenant-owned OAuth connections; supported publishing per provider; calendar; multi-account publishing; inbox/comments where APIs permit; media validation; publish retries; token refresh; account health; post analytics; platform permission diagnostics.

### 7. Campaign Manager
Organic, email, WhatsApp, Meta Ads and Google Ads campaigns; audiences; creative/ad drafts; budgets; approval; launch/pause; conversion tracking; attribution; experiments; CPL/CAC/ROAS; guardrails; rollback. No autonomous spend change without explicit policy, cap and approval.

### 8. SEO Intelligence
Verified domains; crawl and technical audit; metadata/H1/canonical/schema/robots; keyword research/tracking; content briefs; competitor visibility; Search Console and GA4; prioritized tasks; audit history and change tracking.

### 9. Website Intelligence
Visitor/event tracking; landing page analytics; source attribution; forms; conversion funnels; form abandonment; chat/widget handoff; domain verification; consent/privacy controls; CRM lead capture; multi-site per tenant.

### 10. WhatsApp & Email Center
Unified inbox; tenant-owned sender identities; WhatsApp templates; inbound/outbound email; SMS only through configured compliant providers; conversations; assignment; templates; consent; opt-out; delivery/bounce/complaint tracking; 24-hour WhatsApp window; retries and provider webhook history.

### 11. Marketing Automation
Visual workflow builder; triggers; conditions; branches; waits; actions; schedules; versioning; simulation; approvals; execution logs; retries; idempotency; queue recovery; dead letters; pause/resume; per-tenant quotas and rate limits.

### 12. Analytics & Reports
Lead funnel; source/channel attribution; campaign spend; conversions; pipeline velocity; revenue; CAC; CPL; ROAS; content performance; agent quality; automation health; exports; scheduled reports; metric definitions and date/timezone correctness.

### 13. Customer Retention
Segments; feedback; reviews; loyalty; repeat-purchase journeys; renewal reminders; reactivation; churn risk; consent-aware customer lifecycle campaigns.

### 14. AI Knowledge Hub
Tenant-specific company profile, products, services, prices, policies, FAQs, sales scripts, uploaded documents, website sources, brand voice, assets and prior approved content. Retrieval must be tenant-isolated; citations/source links should be available for factual answers. Never invent prices, guarantees or claims.

### 15. Integrations & Settings
Workspace credential vault; OAuth; provider test; scopes/permissions; webhook setup; token refresh; audit history; usage; plan entitlements; team roles; business profile; timezone; locale; notification and data retention settings. Secrets encrypted server-side and never returned to browser.

## End-to-end business growth loop
Business goal → ICP & campaign strategy → source discovery → enrichment → verification → evidence-based qualification → contact eligibility → approved outreach → reply classification → appointment/human handoff → proposal/deal → won/lost → attribution → retention and next-best action.
Every step must be observable, replay-safe, tenant-scoped and stoppable.

## Non-negotiable SaaS controls
- Organization-scoped RLS for every tenant table and storage object.
- Server-side membership and role checks on every mutation and sensitive read.
- Active organization must be explicitly resolved; never trust a client-supplied org ID alone.
- Platform admin bypass is explicit, audited and not exposed to tenant roles.
- Per-tenant provider credentials, quotas, billing and feature entitlements.
- Invite-based membership; no open signup into an existing tenant.
- Tenant switching must re-resolve role and entitlements.
- Audit events for credential changes, outbound communication, ad spend, membership, billing and platform-admin actions.
- Consent and suppression checks immediately before send/call, not only at draft time.
- Rate limits, abuse detection, data retention, deletion/export, backup and restore.
- AI actions must have budgets, model allowlists, prompt/tool policies and traceable usage.
- Provider failures must not silently mark a job as complete.

## Definition of Done
A module is not complete because a screen or API route exists. It is complete only when:
1. UI workflow is usable on desktop and mobile.
2. API validates authenticated user, active tenant, role and feature entitlement.
3. Database schema has correct constraints, indexes, RLS and storage policies.
4. Provider calls use tenant credentials and handle expiry, errors, retries and rate limits.
5. Audit, usage and cost events are recorded.
6. Automated tests cover success, failure, unauthorized, cross-tenant denial and idempotent retry.
7. Live sandbox/provider test passes; production certification is separately recorded.
8. Help/setup/diagnostics explain missing credentials and required provider permissions.

## Delivery sequence
P0 — SaaS Core & Revenue Foundation
- Tenant onboarding and lifecycle, membership invitations, roles, active workspace resolution.
- Tenant isolation/RLS/storage audits.
- Plans, subscriptions, entitlements, usage metering, invoices/payment webhooks.
- CRM/Customer 360, lead pipeline, tasks, consent and audit.
- Lead discovery/enrichment provenance and qualification evidence.
- Provider vault, connection tests and workspace setup wizard.

P1 — Autonomous Growth Operations
- Orchestrator, workflow execution, schedules, queue health, recovery and runbooks.
- Email/WhatsApp inbound/outbound lifecycle with consent/suppression.
- AI sales agent and conversational voice with handoff.
- Content calendar, approvals, social publishing and analytics.
- Campaigns, conversion attribution and spend guardrails.

P2 — Intelligence & Retention
- SEO and website intelligence.
- Customer retention and loyalty.
- Advanced attribution, experiments, forecasts and recommendations.
- Enterprise SSO, advanced audit, retention/export and governance.

## Product status policy
Use four honest statuses: Implemented in source, Partial, Not implemented, Live-verified. Never call an integration live merely because credentials fields exist. A release must include a current gap audit and test evidence.
