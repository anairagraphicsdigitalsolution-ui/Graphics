# v6.115.0 — Module 1 Function 8: AI Recommendation Learning Insights

- Adds workspace-scoped descriptive aggregation of human outcome feedback by action type.
- Calculates positive/neutral/negative counts, positive rate, and average valid rating.
- Requires feedback across at least five distinct actions before labeling evidence directional; repeated feedback on one action cannot satisfy the threshold.
- Exposes 100-action / 250-feedback history caps and warns when the bounded history reaches either cap.
- Negative feedback exceeding positive feedback recommends human review.
- No automatic model training, recommendation re-ranking, or revenue/KPI causal attribution is performed.
- Uses existing Function 7 feedback migration; no new database migration required.

Verification: run `npm run verify:growth-command-center-learning-v62100` and `npm run verify:all`.
