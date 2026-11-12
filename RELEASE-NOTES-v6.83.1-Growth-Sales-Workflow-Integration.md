# Anaira AI Growth Engine v6.83.1

## Changes
- Connected the Phase 25 AI Sales Follow-up draft action to the Growth Intelligence workspace UI.
- Added a workspace-scoped CRM lead list to the Growth Intelligence GET response.
- Added channel selection for WhatsApp, email and internal call-script drafts.
- Existing server-side consent and opt-out checks remain authoritative.
- Drafts are not sent automatically; delivery is explicitly not performed by this screen.

## Existing capabilities reused
- Meta campaign draft, submission and guarded activation routes.
- Multi-step workflow builder, simulation, versioning, retries and dead-letter recovery.
- Meta Conversions API event queue with consent, hashed identifiers, idempotency and delivery status.

## Not certified / external dependencies
- WhatsApp Business Calling / voice AI is not implemented as a live dialer in this release. It requires an enabled calling provider, business eligibility, webhook/SIP or media transport, consent and provider credentials.
- Meta ad publishing and conversion delivery require valid Meta app permissions, connected ad account, pixel/token and live provider testing.
- No autonomous spend or unsolicited messaging is enabled.
- Production build and live Supabase/Meta/OpenAI integration tests were not run in this build environment.
