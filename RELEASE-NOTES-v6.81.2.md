# Anaira AI Growth Engine v6.81.2 — Role Separation & Website Hero Fix

## Role and navigation separation
- The primary navigation now resolves the signed-in user against `admin_users` and `growth_members`.
- Platform-only navigation (`Super Admin`, `Plans & Billing`) is shown only to platform administrators.
- Workspace modules and `Plan & Usage` are shown only to users with a workspace membership.
- Website CMS `/admin` now requires an `admin_users` allow-list entry; an authenticated tenant user is not automatically a platform administrator.
- Existing server-side platform billing checks remain authoritative. Workspace billing remains scoped to owner/manager membership and the selected organization.

## Why two billing routes exist
- `/admin/ai-growth/platform/billing` is the platform billing console: plan catalogue, tenant subscription assignment, manual payment recording, invoices and platform billing history.
- `/admin/ai-growth/billing` is the tenant self-service page: that workspace's subscription, usage counters and available checkout plans.
- These are separate workflows over the same billing data model, not duplicate ledgers. Role-aware navigation prevents both from being presented to every user.

## Website fixes included from this source ZIP
- Software page now passes saved hero eyebrow/title/description colours and overlay colour/opacity to `PageHero`.
- Studio settings updates merge defaults, existing saved page data and the selected patch, preserving existing service cards and workflow data when a colour is changed.

## Verification
- Added `verify:admin-role-billing-website` for role/navigation, billing authorization, Software hero settings and Studio data-preservation assertions.
- Live Supabase users, RLS policies and production deployment must still be checked in the connected environment. No production data has been modified by this source update.

## Route note
- This patch uses role-aware navigation and API authorization on the existing route structure. Workspace modules still resolve under `/admin/ai-growth/...`; a separate `/workspace/...` URL namespace and platform-only route layout are not part of this release.
