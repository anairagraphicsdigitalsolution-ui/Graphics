# Anaira AI Growth Engine v6.84.9 — Autonomous Growth Foundations

## Added
- Workspace-scoped Google Programmable Search prospect discovery. Saves public business website records, deduplicates within the workspace, and explicitly leaves contact consent false. Requires `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX`.
- Consent-gated outbound voice call initiation through Twilio Programmable Voice, E.164 validation, workspace owner/manager authorization, and a per-call audit table. Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VOICE_FROM`, and `APP_BASE_URL`.
- Live Meta campaign insights retrieval for the last 30 days, with CTR/CPC/spend/conversion/CPA diagnostics and recommendations. Requires a connected Facebook account with `ads_read` and Meta Graph API version configuration.
- Migration: `20261112120000_growth_autonomous_execution_foundations_v6849.sql`.

## Important scope boundaries
- Discovery searches indexed public business websites; it does not scrape private/personal data, infer personal contact details, or authorize outreach.
- Voice calling is provider-backed outbound TTS script playback, not a conversational AI/WebRTC agent. A live call requires configured Twilio credentials, an approved caller ID, applicable consent, and regulatory compliance. Call status reconciliation, recording/transcription and conversational agent are not included in this release.
- Campaign optimization produces recommendations only. It does not change budgets, bids, targeting, campaign status, or activate ads. Meta pixel/event quality affects conversion analysis.
- No external credentials or live provider calls were available during offline verification.
