# Live Supabase Verification — v6.77.0

- Project ref: `nrsdqrqkffhbicfskilb`
- Project: Anaira Graphics & Digital Solution
- Region/status: `ap-northeast-1` / `ACTIVE_HEALTHY`

## Migrations applied and confirmed in migration history
- `growth_billing_usage_entitlements_v677`
- `growth_quota_subscription_guard_v6771`
- `growth_quota_idempotency_fix_v6772`
- `growth_crm_activities_v6773`
- `growth_crm_activity_fk_indexes_v6774`

## Privileges / RLS
RLS is enabled on `growth_plans`, `growth_subscriptions`, `growth_usage_counters`, `growth_usage_events` and `growth_lead_activities`. The `anon` and `authenticated` roles do not have SELECT access; `service_role` does. `consume_growth_quota(uuid,text,bigint,text,jsonb)` cannot be executed by anon/authenticated and is executable by service_role.

## Quota RPC transaction test
- A temporary plan with `ai_messages: 1` and a temporary subscription were inserted inside a transaction.
- First call: allowed, used=1, limit=1.
- Second non-idempotent call: denied with `quota_exceeded`.
- Retry with the original idempotency key: allowed as duplicate, used remained 1.
- The transaction was rolled back; no test plan/subscription/usage row was retained.

## Live tenant data snapshot
| Metric | Count |
|---|---:|
| Organizations | 1 |
| Active organizations | 1 |
| Memberships | 1 |
| Leads | 0 |
| Websites | 0 |
| Connected social accounts | 0 |
| Connected WhatsApp accounts | 0 |
| Billing plans | 0 |
| Subscriptions | 0 |
| CRM activities | 0 |

No plan has been created or assigned to the current organization yet. It remains on legacy/unmetered access until a platform administrator configures and assigns a plan.

## Advisors
- Security Advisor: new service-role-only tables show informational RLS-enabled/no-policy notices by design. Existing warnings remain for `public.is_anaira_admin()` SECURITY DEFINER being executable by authenticated users and leaked-password protection being disabled.
- Performance Advisor: no unindexed FK notice remains for the new CRM activity table after two FK indexes were applied. Existing unused-index notices and multiple permissive policies on `projects` and `site_settings` remain.
