# Module 15 — Integrations & Settings setup

## Credential ownership

1. Open `/admin/ai-growth/integrations`.
2. Use **Client Workspace APIs** to configure a client-owned provider account. Only workspace owners and managers can save, test or remove these credentials.
3. Use **Anaira Developer APIs** for Anaira-owned app credentials and shared provider defaults. Only Super Admin users can manage this vault.
4. Workspace BYOK credentials take precedence over shared Anaira credentials. Shared fallback remains opt-in and subject to provider and plan-specific monthly request caps.
5. Secret fields are AES-256-GCM encrypted server-side. The browser receives only configured-key names and masked last-four-character hints.
6. Saving a changed secret increments the credential version and records a rotation timestamp. OAuth token refreshes also update the encrypted vault and audit history.
7. Run **Test connection** after saving credentials. OAuth app configuration alone is marked validation-only until the client workspace completes consent and a real account/API access test succeeds.
8. Review recent integration events and webhook processing health in the workspace integration screen. Platform provider test history is visible in the Anaira Developer APIs screen.

## Environment-only secrets

Do not place Supabase service-role keys, `GROWTH_TOKEN_ENCRYPTION_KEY`, CRON secrets or webhook app-signing secrets into client-editable provider forms. These remain server environment variables and must be configured in the deployment environment.

## Billing and usage

- `/admin/ai-growth/billing` is the workspace plan and usage surface.
- `/admin/ai-growth/platform/billing` is the Super Admin plan, subscription and platform billing surface.
- Shared API usage caps are operation/request limits, not exact provider invoice costs. Vendor invoice reconciliation, tax and refund settlement require separate finance acceptance.

## Production validation checklist

- Supply real provider credentials and verify account ownership, OAuth scopes and permissions.
- Complete provider-specific consent, token refresh/rotation and revocation tests.
- Verify Meta, WhatsApp, Google, Twilio and Resend webhooks from provider consoles.
- Run two-tenant authorization tests and verify one workspace cannot read another workspace's credentials, accounts, events or webhook records.
- Complete billing settlement/refund/tax reconciliation, backup/restore and deployed browser acceptance tests.
- Install dependencies from a committed lockfile, run typecheck/lint/build, then deploy and smoke-test the production runtime.
