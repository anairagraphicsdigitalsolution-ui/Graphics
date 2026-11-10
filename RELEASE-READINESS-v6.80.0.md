# Release readiness — v6.80.0

## Completed in source
- Resend/Svix signed inbound email webhook with timestamp freshness validation.
- Tenant-specific inbound address mapping API, owner-only writes.
- Idempotent provider event ledger.
- Email conversation creation/update in tenant-scoped unified inbox.
- Delivery, delayed, bounce and complaint event logging.
- Bounced/complained lead email suppression in manual and worker send paths.
- New migration applied to live Anaira Graphics & Digital Solution Supabase project.
- Live SQL verification confirms the new inbox, event ledger and lead suppression columns exist.

## Verification
- `npm run verify:all`: PASS.
- TypeScript/TSX syntax scan: 129 files, 0 syntax errors.
- Inbound email lifecycle regression: 10/10 PASS.
- Workflow engine: 17/17 PASS.
- CRM attachments: 8/8 PASS.
- Cashfree: 11/11 PASS.
- WhatsApp multi-number: 14/14 PASS.
- ZIP integrity: verified.

## External setup still required
- Set `RESEND_WEBHOOK_SECRET` in Vercel.
- Configure Resend receiving domain, webhook event subscriptions and tenant inbox addresses.
- Live inbound email test requires DNS/domain and Resend account access.

## Not certified
- `npm run build` still fails in this environment with `next: Permission denied`; this source extraction has no node_modules or package-lock.
- Live Meta/WhatsApp/LinkedIn/YouTube production E2E, Cashfree settlement/refund, complete cross-tenant penetration testing, Vercel deployment, and full graph workflow parallel-join engine remain pending.
- This release is not 100% production-certified.
