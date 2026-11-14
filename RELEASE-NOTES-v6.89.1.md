# Anaira AI Growth Engine v6.89.1

## Evidence-backed prospect qualification
- Added a tenant-scoped AI qualification endpoint and Growth Intelligence UI action.
- Separates ICP/business fit (`quality_score`) from demonstrated buying intent (`intent_score`).
- Stores structured evidence, source labels, confidence, unknowns, reasoning and a recommended next step.
- The model is explicitly instructed not to infer buying intent from a website, phone number, email address or industry fit alone.
- Qualification is limited to workspace owners/managers and never changes contact consent or sends outreach.
- Added `qualification_status`, `intent_score`, `qualification_evidence`, `qualified_at` and a tenant/status index.

## Database
Migration `20261113154500_growth_prospect_evidence_qualification_v6891` was applied to the connected Anaira Growth Engine Supabase project (`nrsdqrqkffhbicfskilb`). The new columns were verified in `information_schema`.

## Verification
- TypeScript/TSX syntax scan: 163 files, zero syntax errors.
- Growth Intelligence regression: 15/15 passed.
- Prospect qualification regression: 11/11 passed.
- Full configured `npm run verify:all` passed before the final UI copy-only adjustment; the directly affected syntax and Growth Intelligence suites were rerun and passed after that adjustment.
- Production `next build` is not certified in this environment because dependencies are not installed; previous install attempt timed out.

## Limits
AI qualification is an evidence-based recommendation, not proof of a buyer, budget, authority, consent or guaranteed conversion. Live OpenAI calls and provider credentials must be tested in the deployed workspace.
