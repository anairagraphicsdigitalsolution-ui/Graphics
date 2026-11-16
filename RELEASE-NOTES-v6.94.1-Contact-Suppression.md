# Anaira AI Growth Engine v6.94.1 — Contact Suppression Controls

## Implemented
- Added an owner/manager-only CRM control for per-customer email, WhatsApp, SMS and voice suppression.
- Suppression always overrides channel consent at dispatch time through the existing shared send-policy helper.
- Added a tenant-scoped read API and an atomic, row-locked service-role RPC for updates to prevent concurrent JSON overwrite races.
- Every change is recorded in the customer activity timeline with channel, action and reason.
- Suppression can be lifted by an authorized workspace owner or manager; lifting suppression does not grant consent.
- Added migration `20261115170000_growth_contact_suppression_controls_v6941.sql`.

## Apply before live use
Apply the new migration to the dedicated Anaira AI Growth Engine Supabase project. Do not apply it to the Anaira CRM project unless that is explicitly confirmed as the Growth Engine database.

## Verification boundary
Static regression checks verify source wiring and policy enforcement. They do not prove remote migration application, RLS behavior in a live database, provider delivery, or production deployment. Live production certification remains pending.
