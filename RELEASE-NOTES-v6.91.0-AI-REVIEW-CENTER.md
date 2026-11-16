# Anaira AI Growth Engine v6.91.0 — AI Review Center

## Implemented in source
- Added tenant-scoped review, review-request and review-event tables with RLS policies and indexes.
- Added AI Reviews workspace module and navigation entry.
- Added Google Business Profile account and location discovery using the configured Google OAuth refresh token.
- Added paginated review sync (up to 250 reviews per sync) and tenant/provider/review idempotent upsert.
- Added OpenAI-powered reply drafting with language matching, empathy and anti-hallucination constraints.
- Added explicit human-approved publish action through the Google Business Profile reviews updateReply API.
- Added low-rating service-recovery attention flags; no negative review hiding or suppression.
- Added neutral, optional review request creation; email delivery through configured Resend integration, with persisted delivery outcomes.
- Added manual/WhatsApp/SMS request drafts where an outbound provider workflow is not yet connected.
- Added policy-violation flagging that requires a reason and leaves actual reporting to the official provider process.
- Added 29 targeted source regression assertions.

## Required configuration
1. Apply `supabase/migrations/20261114200000_growth_ai_review_management_v6910.sql` to the dedicated Growth Engine Supabase project.
2. Configure Google OAuth with offline access and scope `https://www.googleapis.com/auth/business.manage`; enable Business Profile Account Management and Business Information APIs, and ensure the reviews API is available to the Cloud project.
3. Save Google `client_id`, `client_secret`, and `refresh_token` in the workspace Google integration.
4. Configure OpenAI API key for AI reply drafting.
5. Configure Resend API key and verified `from_email` for live email review requests.
6. Use AI Reviews → Find Google accounts → Find locations → Save review settings → Sync reviews.

## Behaviour and policy guardrails
- Reviews are never hidden, deleted, or suppressed based on star rating.
- All customers receive the same optional, neutral invitation regardless of satisfaction; no incentive or review gating.
- Low ratings are highlighted for service recovery and still remain visible in the review queue.
- AI replies are drafts; public replies require a human publish action.
- A review can only be flagged for possible policy violation with a documented reason. This source does not auto-report reviews.

## Verification
- `node scripts/verify-syntax.cjs`: 183 TS/TSX files, 0 syntax errors.
- `node scripts/verify-growth-ai-reviews.cjs`: 29 PASS, 0 FAIL.
- `npm run verify:all`: run separately; result recorded in `VERIFICATION-v6.91.0.log`.
- Production build and live Google/Resend/OpenAI end-to-end execution are not certified in this source-only environment.
