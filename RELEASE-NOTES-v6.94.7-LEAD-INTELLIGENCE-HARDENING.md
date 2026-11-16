# Anaira AI Growth Engine v6.94.7 — Lead Intelligence hardening

## Scope
Module 2: Lead Intelligence. This release builds on v6.94.6 AI Command Center and retains the complete project source.

## Changes
- AI prospect qualification accepts an optional, explicit direct-enquiry evidence field.
- Fit score and demonstrated buying intent remain separate. The server forces `intent_score` to zero unless a direct enquiry was supplied and the model returns at least one bounded intent-evidence item whose source is exactly `user_provided_enquiry`.
- Public website details, email addresses, phone numbers, industry fit, and search snippets cannot independently create buying-intent scores.
- Scheduled public-prospect qualification also forces intent score to zero because the discovery workflow has no recorded direct customer enquiry.
- OpenAI qualification requests now have a 20-second timeout and invalid JSON is handled as a controlled error.
- Website, email and phone verification checks run concurrently; MX and optional mailbox checks remain sequential within the email branch.
- Verification endpoint duration budget increased to 45 seconds to cover configured provider checks.
- Prospect discovery stores normalized `website_domain` without `www`, aligning it with duplicate lookup behavior.
- UI explains the direct-enquiry requirement and displays separately recorded intent evidence.

## Verification
- Full `npm run verify:all`: 1,154 PASS, 0 FAIL.
- Syntax verifier: 208 TS/TSX files, 0 syntax errors.
- Focused Lead Intelligence verifier: 14/14 PASS.
- Prospect qualification verifier: 17/17 PASS.
- Prospect enrichment/security verifier: 16/16 PASS.
- Prospect discovery pagination verifier: 10/10 PASS.
- Prospect conversion verifier: 12/12 PASS.
- Existing Growth Intelligence verifier: 15/15 PASS.
- Existing Growth Autopilot verifier: 9/9 PASS.
- Existing Growth Autopilot remainder verifier: 17/17 PASS.

## Remaining certification limits
- `npm run build` remains blocked in this environment because Next.js is not installed (`next: not found`).
- Browser E2E and live ZeroBounce/Twilio/Google CSE/OpenAI provider certification were not run.
- DNS/MX, mailbox provider, phone line intelligence and reachable website checks are technical signals only. They do not prove identity, ownership, buying intent or contact consent.
- No migration was required for this source hardening; existing v6.92.0 verification and v6.89.1 qualification migrations are retained.
