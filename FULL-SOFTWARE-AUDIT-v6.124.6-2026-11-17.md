# Anaira AI Growth Engine v6.124.6 — Full Software Audit

Audit date: 2026-11-17  
Scope: available source tree `function15_work` from the v6.124.6 Full Completion Package, plus the previously recorded live Supabase/Vercel evidence.  
Audit type: source/static review, complete repository verification suite, configuration and release-readiness review. This is not a live authenticated browser E2E or penetration test.

## Executive verdict

**Status: NOT production-certified.** The source regression suite passes, and the recorded database hardening is in good shape. The remaining risk is concentrated in live provider connectivity, background-worker cadence, tenant-isolation E2E, operational recovery, and release reproducibility/deployment parity. Several product surfaces are implemented as controlled drafts/approvals or internal task workflows rather than autonomous external execution.

## Repository inventory and checks actually run

| Item | Observed result |
|---|---:|
| API route handlers | 120 |
| Application pages | 50 |
| React/TypeScript components | 54 |
| Library TypeScript/JavaScript files | 20 |
| SQL migrations in source | 118 |
| Dedicated verification scripts | 137 |
| `npm run verify:all` | **1,825 PASS / 0 FAIL** |
| TypeScript/TSX syntax check | **249 files / 0 syntax errors** (latest recorded syntax log) |
| Local dependency-backed Next build | Not run: dependency install timed out in the prior audit environment |
| Exact ZIP deployed to Vercel | No; current READY deployment is a different Git commit |

The complete verification suite was executed during this audit and exited with code 0. The 1,825 assertions are predominantly repository-specific verification scripts; they are not a substitute for browser workflows against real tenant accounts and third-party providers.

## Confirmed strengths

1. Live Supabase evidence records 9 migrations applied on 2026-11-17.
2. All 98 public tables have RLS enabled; no public table was reported with RLS disabled.
3. Supabase performance advisor findings for unindexed foreign keys, overlapping permissive policies, and duplicate indexes were reduced to zero; 58 FK indexes were added.
4. Supabase health advisor reported zero health lints.
5. The recorded source verification suite is green; current full run confirms 1,825 PASS / 0 FAIL.
6. Public website event/form ingress has website-key/origin checks and rate limiting; website form also has duplicate-submission handling and quota checks.
7. Meta webhook code verifies request signatures; Twilio voice status/TwiML callbacks verify provider signatures; public proposal response uses hashed, expiring bearer tokens.
8. Voice sending checks workspace role, explicit voice consent, suppression, communication policy, E.164 number format, and records call attempts.
9. Command action workflow separates proposal, independent approval, and internal task execution; it does not silently trigger ads spend or public communications.

## Findings — blockers and risks

### P0 — Release / production blockers

| Finding | Evidence | Impact / required action |
|---|---|---|
| Exact audited source package is not deployed | Vercel READY deployment corresponds to Git commit `10231889322336f1fded10cbebe579d428f2b45c`; the full completion ZIP was not pushed/deployed | Production may not contain the audited fixes/migrations. Obtain access to `anairagraphicsdigitalsolution-ui/Graphics`, push the exact source, then verify deployment commit and smoke tests. |
| External provider setup is incomplete | Previous live audit found OpenAI HTTP 429/no credits and no connected social-account rows | AI briefing and live social publishing cannot be certified. Fund OpenAI API billing and connect intended provider accounts, then test each channel with approved test content. |
| Worker cadence is not certified | `vercel.json` schedules worker daily at 03:00 UTC. GitHub Actions workflow is intended every 5 minutes but needs `ANAIRA_GROWTH_SITE_URL` and `ANAIRA_GROWTH_CRON_SECRET`; repo access/runs were unavailable | Near-real-time automation is not proven. Configure GitHub secrets and verify successful scheduled runs, retries, and worker health. |
| Tenant isolation adversarial E2E not run | Prior audit explicitly records no two-tenant authenticated browser test | Cross-tenant read/write/storage denial remains unproven end-to-end. Run tests with two independent tenant accounts, including API, RPC, storage, exports, and background jobs. |
| Financial lifecycle not E2E certified | Cashfree/billing source checks exist, but sandbox checkout, signed webhook, duplicate webhook, refund, invoice, and ledger reconciliation were not run end-to-end | Do not treat billing as production-certified until gateway sandbox and ledger reconciliation evidence exists. |
| Backup/restore and incident recovery not drilled | No completed restore drill evidence in the audit package | Create backup, restore to isolated environment, verify row/file counts and tenant boundaries, and record recovery time. |
| Supabase leaked-password protection disabled | Prior Supabase Auth security advisor finding | Enable leaked-password protection in Supabase Auth security settings and re-check advisor. |

### P1 — Functional gaps / incomplete product behavior

| Area | Confirmed limitation / current behavior | Required work |
|---|---|---|
| AI Command Center | Action execution UI states that execution is limited to internal CRM task creation. External communication, publishing, ad spend and payments are not executed by this action path. Feedback is human-entered; revenue/KPI impact is not automatically attributed. | Either keep product promise explicitly “recommendation + approved internal task” or implement separately governed provider actions with idempotency, approval, consent, audit and rollback. |
| Knowledge Hub | `lib/growth-knowledge-extract.js` supports TXT, CSV, Markdown, PDF, DOCX and XLSX, but scanned PDFs fail with “Scanned PDFs require OCR and are not supported yet.” | Add OCR pipeline, page-level extraction confidence, retry/review states and tests for scanned/mixed PDFs. |
| Social publishing | No connected social-account rows were present in prior live audit; publishing, comments and provider refresh/revocation were not live-certified. | Connect each intended Meta/Instagram/LinkedIn/YouTube account and verify post, reply, sync, token refresh, revocation and webhook idempotency. |
| Google OAuth / Ads integration | Platform integration test explicitly returns validation-only messaging for Google OAuth app credentials and Google Ads developer token; client consent/customer account is required for actual access. | Complete tenant OAuth consent and test real account-scoped reads/writes in approved sandbox/test account. |
| WhatsApp native Calling | Native Calling media/signalling, Meta eligibility, WebRTC/SIP, SDP and call lifecycle remain uncertified. Voice route currently initiates Twilio calls; when `VOICE_AGENT_WS_URL` is absent it uses scripted text-to-speech fallback rather than two-way AI conversation. | Distinguish Twilio outbound voice from WhatsApp native calling in UI; complete provider eligibility/media tests and test two-way agent with a configured WebSocket endpoint. |
| AI briefing | Previous runtime log recorded OpenAI HTTP 429/no credits. Rule-based fallback exists, so fallback response is not proof of successful LLM execution. | Fund provider or configure funded workspace key; test successful LLM response and usage metering. |
| Campaign lifecycle | UI says a campaign can be approved/activated as a campaign record only; it explicitly does not launch ads. Google Ads creation code creates campaigns paused. | Keep status labels clear (record active vs provider campaign live) and implement a separate approved activation workflow if actual launch is required. |
| Email/SMS/WhatsApp outbound | Code has consent/suppression/queue controls, but live provider delivery and webhook outcomes were not certified in this audit. | Verify verified sender/domain, provider credentials, consent, opt-out, delivery/bounce/failure webhooks, retry and duplicate suppression using controlled test recipients. |

### P2 — Engineering quality / maintainability

| Finding | Evidence | Impact / recommendation |
|---|---|---|
| No dependency lockfile in source root | No `package-lock.json`, npm/yarn/pnpm lockfile or shrinkwrap found | Installs can resolve different transitive versions. Generate and commit one lockfile, then use `npm ci` in CI. |
| Lint command is not reproducibly provisioned | `package.json` defines `lint: next lint`, but `eslint` is not listed in the declared devDependencies and no ESLint config was found at the source root | Add ESLint/config compatible with Next 15 and make lint a required CI gate, or remove/replace the stale command. |
| Local production build not verified for this exact source | Dependency install timed out; Vercel build evidence is for a different Git commit | Run clean install, lint, typecheck and `next build` on the exact audited commit/ZIP before release. |
| Image optimization disabled | `next.config.ts` sets `images.unoptimized: true` | Portfolio and admin pages may ship unnecessarily large images. Review image sizing/format/CDN and enable optimization where compatible. |
| Many migrations require lifecycle governance | 118 SQL migration files in source; nine recent production migrations have recorded apply evidence | Maintain a migration manifest, verify clean database replay, and compare source migration history to remote history before every release. |
| Security advisor informational items remain | 29 RLS-enabled/no-policy INFO findings (previously checked as service-role-only with no anon/authenticated SELECT grants); 159 unused-index INFO findings; two SECURITY DEFINER warnings | Do not blindly add policies/drop indexes/revoke functions. Review grants, function ownership/search_path/execute privileges and index usage over a longer window. |
| Public contact form abuse controls need review | `app/api/contact/route.ts` has honeypot and input-length checks; no explicit shared rate-limit call appears in that handler | Add edge/server rate limiting and spam telemetry; test abuse throttling. This is a hardening recommendation, not proof of an exploitable vulnerability. |

## Security and operations notes

- 24 route files did not contain the small set of common inline auth-helper strings used by a static scan. Most are expected public ingress routes, OAuth callbacks, webhooks, or bearer-token endpoints; this is **not** a list of confirmed unauthenticated vulnerabilities. Each route still needs manual authorization/signature review and negative tests.
- The 29 `rls_enabled_no_policy` INFO findings were previously checked for absence of anon/authenticated SELECT grants and appear intended for service-role-only access. Preserve this boundary and retest service-role usage.
- Two SECURITY DEFINER function warnings remain. They were not revoked blindly because of policy/dependency usage; review `search_path`, ownership and execute grants with migration-aware tests.
- 159 unused-index INFO findings should be observed over a longer production workload window before removal.
- Do not run the worker manually against production just to test it: it can trigger external side effects. Use isolated test tenants and provider sandbox accounts.

## Prioritized completion plan

1. **Release parity:** connect the GitHub identity that has write access to the Vercel-linked repository; push this exact source; verify deployment commit and production build.
2. **Build hygiene:** add lockfile and ESLint; run `npm ci`, lint, TypeScript check and `next build` from a clean environment.
3. **Tenant security:** run two-tenant browser/API/RLS/storage/RPC negative tests and record evidence.
4. **Worker reliability:** configure GitHub Actions secrets; verify 5-minute schedule, lease expiry, retries, DLQ, duplicate suppression and alerting in a test tenant.
5. **Provider certification:** OpenAI billing, social OAuth, WhatsApp/email/SMS, Google OAuth/Ads and Twilio/Calling test accounts; test refresh/revocation and outbound consent.
6. **Finance and recovery:** Cashfree sandbox lifecycle, duplicate webhook/refund/ledger reconciliation, backup restore and incident drill.
7. **Feature completion:** OCR for scanned PDFs; clarify Command Center execution scope; implement or clearly label real ad activation and WhatsApp native calling.
8. **Auth hardening:** enable leaked-password protection and review remaining SECURITY DEFINER grants.

## Final assessment

- **Source regression checks:** PASS (1,825/1,825).
- **Recorded database hardening:** PASS for RLS enabled coverage, FK indexing, policy overlap, duplicate index and health lint checks.
- **Local clean build/lint on exact package:** NOT VERIFIED.
- **Live third-party provider workflows:** NOT CERTIFIED.
- **Tenant adversarial E2E, billing E2E, backup/restore:** NOT RUN.
- **Exact package deployed:** NO.

**Overall: strong automated source/database baseline, but not yet a fully certified production SaaS release.**

---

## v6.124.7 follow-up — Module 13 retention dispatch

The earlier Module 13 email-only dispatch limitation has been addressed in source and the connected database. Retention touchpoints now support email, approved WhatsApp templates and SMS, with channel-specific consent/suppression checks, mandatory human approval, scheduled idempotent worker jobs, duplicate/outcome-unknown protections and terminal lifecycle updates. Migration `20261117060000_growth_retention_multichannel_v61310` was applied and verified on the connected Supabase project. Focused verification: 37/37 retention checks, 65/65 worker checks, 19/19 send-policy checks, 249 TS/TSX files with zero syntax errors. Provider credentials and real delivery tests remain external gates.
