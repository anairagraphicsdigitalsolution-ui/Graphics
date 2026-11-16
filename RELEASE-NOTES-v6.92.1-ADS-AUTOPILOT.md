# Anaira AI Growth Engine v6.92.1 — Meta Ads Autopilot Builder

## Delivered
- New Ads Autopilot workspace page and navigation entry.
- Tenant/role/feature-gated API creates a complete single-image Meta ad chain in one request: campaign, ad set, creative and ad.
- AI generates structured primary text, headline and description using the workspace OpenAI integration and supplied business/audience context.
- Requires a connected Facebook Page account with `ads_management`, Meta ad account ID, public HTTPS landing page/image, audience targeting JSON and explicit daily budget.
- All provider objects are created in `PAUSED` state. No spend begins automatically.
- Uses the existing owner-only `/api/growth/ad-activation` flow for explicit activation with an approved maximum daily budget; activation audit and rollback remain in place.
- On a partial provider failure, attempts to pause all created Meta objects and marks locally created drafts failed; returns reconciliation details if rollback cannot be confirmed.
- Does not create unsupported media assets. User supplies a public HTTPS image URL. This release is single-image only; video/carousel automation is not claimed.

## Safety and operating boundaries
- Only workspace owner/manager can run the builder.
- Ad account, audience, landing page, image and daily budget are explicitly supplied by the workspace operator.
- AI copy is constrained to the supplied workspace brand/knowledge and business description; it must not invent offers, testimonials, guarantees or certifications.
- Campaign launch remains a separate owner confirmation with a hard daily budget cap.
- This is Meta Ads only. Google Ads is not included in this endpoint.

## Verification
- TypeScript/TSX syntax scan: 186 files, 0 syntax errors.
- Full `npm run verify:all`: 819 PASS, 0 FAIL.
- Targeted Ads Autopilot checks: 13 PASS, 0 FAIL.
- Production Next.js build and live Meta/OpenAI end-to-end execution are not certified in this environment. Connected provider credentials, approved Meta app permissions, ad account configuration, and a real test campaign are required.
