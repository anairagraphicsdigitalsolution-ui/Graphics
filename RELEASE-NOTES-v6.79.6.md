# Anaira AI Growth Engine v6.79.6

## Visual workflow builder usability tranche
- Added a dedicated `/admin/ai-growth/automation/builder` URL.
- Added native drag-and-drop reordering for workflow step cards in the existing workflow editor.
- Reordering invalidates any prior simulation result so stale simulation output is not shown as current.
- Added explicit UI disclosure: this release still executes sequential steps with condition false-path skip; parallel branches and graph joins are not implemented.

## Verification
- `npm run verify:all` passed.
- Syntax scan: 125 TS/TSX files, 0 syntax errors.
- Workflow engine: 16/16 checks passed.
- New visual builder checks: 5/5 passed.
- Next.js production build not run: `node_modules/.bin/next` is unavailable in this working copy.
- No live Supabase, Vercel, Cashfree, Meta, WhatsApp or email provider E2E test was performed.

## Remaining work
- True graph-based parallel branches, joins, nested conditions and graph execution runtime.
- Inbound email processing, bounce/unsubscribe lifecycle.
- CRM sales attribution and conversion reporting.
- Advanced platform tenant lifecycle and feature entitlements.
- Cashfree live checkout, refunds and settlement reconciliation.
- Social provider E2E verification and production certification.
