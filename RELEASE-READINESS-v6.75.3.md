# Anaira AI Growth Engine v6.75.3

## Implemented in this increment
- Added two workflow event triggers: `lead_status_changed` and `lead_temperature_changed`.
- Lead updates now read the previous lead state within the same organization before applying the requested update.
- Workflow runs are enqueued only when status or temperature actually transitions; unchanged values do not generate duplicate event runs.
- Enqueued workflow context records the event name, changed field, previous value and current value.
- Existing `lead_created` workflows remain supported.
- Added six static regression guards for trigger allow-listing, transition detection, organization-scoped prior-state reads and event enqueue invocation.

## Database
- No schema migration is required: trigger types are stored as text and workflow run context is JSONB in the existing multi-step workflow migration.
- Ensure the existing v6.52+ workflow migrations are applied before enabling workflows.

## Validation
- Source syntax validation and static regression checks are run against this package.
- This is not a live Supabase, provider or Vercel test. Full Next.js build and real-account E2E remain separate release gates.

## Configuration / deployment
1. Back up the existing source and database.
2. Replace source with this package.
3. Run `npm install`, `npm run verify:syntax`, `npm run verify:growth-worker`, and `npm run build`.
4. Deploy to Vercel.
5. Create disabled test workflows for `lead_status_changed` and `lead_temperature_changed`, update one test lead, and verify exactly one queued run per actual transition.
6. Keep external message actions disabled until consent, provider delivery and opt-out tests pass.

## Still outstanding for production completion
- Workflow time-based/segment-entry triggers, visual canvas, parallel branches, versioning and richer nested condition groups.
- Live Meta/WhatsApp/Instagram/Messenger/LinkedIn/YouTube provider E2E.
- Real Meta Ads campaign/ad-set/creative/ad lifecycle, spend reporting and conversion attribution acceptance.
- Verified email sender and real delivery.
- Strict TypeScript / production build in an installed dependency environment.
- Cross-tenant, webhook signature, OAuth token rotation, consent revocation and rate-limit security acceptance.
- Vercel production env, Cron and live WhatsApp webhook 200/verification response.

## Follow-on UI completion in this package
- Growth Control Center now lets a manager choose `lead_created`, `lead_status_changed`, or `lead_temperature_changed` in the workflow builder.
- The selected trigger is sent to the API and shown in the trigger summary; previously the UI silently hardcoded `lead_created`.
- This is a source-level UI completion; verify it in the deployed workspace after build/deploy.
