# Anaira AI Growth Engine v6.110.0 — Module 1, Function 4

## Scope
Adds an authenticated Playwright browser E2E runner for the AI Command Center overview.

## Browser journey covered
1. Sign in through `/growth-login` using a dedicated test account.
2. Select the explicitly configured workspace through the existing active-workspace preference.
3. Open `/admin/ai-growth/overview` and assert the Command Center, KPI cards, reconciliation table and Daily Business Briefing render.
4. Verify the analytics API returns HTTP 200 and every request carries the configured `organizationId`.
5. Verify the briefing API returns HTTP 200.
6. Click **Refresh KPIs** and assert another analytics request is made.
7. Fail on browser runtime errors or console errors; save success/failure screenshots.

## Run
Install the Playwright package and Chromium browser in the project environment, then set:

- `AIGE_BASE_URL`
- `AIGE_TEST_EMAIL`
- `AIGE_TEST_PASSWORD`
- `AIGE_TEST_ORGANIZATION_ID`

Run `npm run e2e:command-center`.

Use a dedicated non-production test account and workspace. The test only reads dashboard data and refreshes views; it does not send customer messages or modify CRM records.

## Verification boundary
The offline verifier checks the E2E harness wiring and required assertions. The authenticated browser journey was **not executed in this build environment** because the project has no installed `node_modules`, Playwright package/browser, or authorized test-account credentials. Do not interpret harness checks as browser E2E certification.
