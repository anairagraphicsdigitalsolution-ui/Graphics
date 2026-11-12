# Anaira AI Growth Engine v6.83.0 — Phase 23–25 foundation

## Added
- Phase 23: tenant-scoped AI 30-day marketing strategy generation using the workspace brand profile and knowledge base. Strategies are saved as drafts; campaign publishing/spend is not triggered.
- Phase 24: tenant-scoped prospect register for manually researched/referral/permissioned business prospects. HTTPS website validation and duplicate website protection are included. No public-web scraping or contact harvesting is performed.
- Phase 25 foundation: consent-aware AI follow-up draft API for existing CRM leads. WhatsApp/email drafts require recorded contact consent and no opt-out; call scripts can be generated as internal drafts. Nothing is sent automatically.
- New Growth Intelligence workspace page and navigation entry.
- New Supabase migration: `20261111130000_growth_intelligence_phase23_25.sql`.

## Required setup
Apply the new migration to the same Supabase project used by Anaira AI Growth Engine. Ensure `OPENAI_API_KEY` is configured on the server. Existing workspace membership and role checks are reused.

## Not claimed complete
This release does not implement autonomous public prospect discovery/enrichment, automatic sales closing, automatic ad activation, WhatsApp voice calling, or a fully autonomous campaign orchestrator. Phase 25 is a follow-up drafting foundation, not automatic outbound messaging. Phases 26–30 remain to be implemented and provider-tested.

## Safety
Prospect storage does not grant marketing consent. Outbound actions remain disabled from this module. Strategy plans are saved as drafts. Existing CRM consent/opt-out state is checked before generating outbound follow-up drafts.
