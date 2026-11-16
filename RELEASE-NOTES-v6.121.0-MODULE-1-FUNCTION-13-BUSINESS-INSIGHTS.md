# Anaira AI Growth Engine v6.121.0 — Module 1 Function 13

## Smart Business Insights & Predictive Risk Signals

- Added an authenticated, organization-scoped Command Center insights endpoint.
- Compares lead inflow across the latest 30 days and preceding 30 days.
- Detects elevated overdue task pressure using overdue count and active-task share.
- Detects a cold-heavy lead mix when the minimum sample threshold is met.
- Detects elevated failed execution share among terminal AI action attempts.
- Displays evidence, severity, confidence label, data-quality warnings and recommended human review.
- Risk index is a deterministic heuristic, not a machine-learning forecast, probability, financial projection or causal estimate.
- No automatic changes, outbound messages, budget changes or task reassignment are performed.

## Verification

Run `npm run verify:growth-command-center-insights-v62600` and `npm run verify:syntax`.
Authenticated browser E2E, production build and live workspace-data verification remain separate release gates.
