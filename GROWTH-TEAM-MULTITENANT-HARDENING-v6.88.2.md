# Multi-tenant team invitation hardening — v6.88.2

## Implemented
1. Invitation creation checks the target account against existing membership in the selected organization.
2. Invitation creation blocks inactive organizations.
3. Invitation acceptance checks that the target organization still exists and is active before membership upsert.
4. Regression checks cover all three safeguards.

## Operational note
Account resolution currently uses the Supabase Admin user directory, paginated up to 10,000 users. For very large deployments, replace this with a dedicated, service-role-only email lookup function or a provider-supported exact user lookup to avoid directory scans.

## Not certified by static checks
These changes do not replace staging tests using distinct authenticated tenant accounts, nor do they prove production RLS, provider connectivity, or deployment health.
