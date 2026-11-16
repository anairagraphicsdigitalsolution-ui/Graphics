# Anaira AI Growth Engine v6.124.3 — Build and OpenAI 429 handling

## Fixed
- Google Ads reporting page now gives `row.campaign` an explicit `Campaign['campaign']` type with a complete safe fallback object. This removes the TypeScript `{}` inference that caused `Property 'id' does not exist on type '{}'`.
- Daily briefing now distinguishes exhausted OpenAI API credits (`429` / `insufficient_quota`) from generic provider failures and explains that rule-based metrics remain available.

## Important operational note
The OpenAI `no credits remaining` response is an account billing/quota condition, not a source-code defect. Add credits or use an appropriately funded API key in the OpenAI Platform organization. The application cannot create provider credits. The briefing endpoint continues to return HTTP 200 with rule-based fallback metrics.

## Verification
- Added `verify:growth-openai-credit-fallback-v61243`.
- Production `next build` has not been run in this container because project dependencies are not installed. Run `npm ci` (if a lockfile is available) or `npm install`, then `npm run build` in the project environment.
