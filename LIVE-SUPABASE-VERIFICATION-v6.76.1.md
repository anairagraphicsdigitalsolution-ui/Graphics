# Live Supabase Verification — v6.76.1

Target project verified before applying migrations:
- Project: Anaira Graphics & Digital Solution
- Project ref: `nrsdqrqkffhbicfskilb`
- Region: `ap-northeast-1`
- Status: `ACTIVE_HEALTHY`

Applied migrations:
1. `growth_team_invitations_v676` — creates `growth_team_invitations` and `growth_platform_audit_events`.
2. `growth_whatsapp_tenant_connections_v6761` — creates `growth_whatsapp_connections`.

Post-migration SQL verification:

| Table | RLS | anon SELECT | authenticated SELECT | service_role SELECT |
|---|---:|---:|---:|---:|
| `growth_team_invitations` | Enabled | No | No | Yes |
| `growth_platform_audit_events` | Enabled | No | No | Yes |
| `growth_whatsapp_connections` | Enabled | No | No | Yes |

Security Advisor after the changes still reports expected INFO findings for service-role-only RLS tables with no policies (including these tables), a WARN for authenticated execution of `public.is_anaira_admin()` (kept because the app's platform-admin authorization path relies on it), and leaked-password protection disabled. Existing multiple permissive policies on portfolio `projects` and `site_settings` remain outside this AI Growth Engine scope.

No WhatsApp token or customer data was inserted during this schema deployment. Meta webhook and provider E2E remain pending until the owner configures server-side Meta credentials and connects a real tenant phone number.
