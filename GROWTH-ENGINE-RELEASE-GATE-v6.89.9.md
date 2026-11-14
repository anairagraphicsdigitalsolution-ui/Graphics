# Anaira AI Growth Engine v6.89.9 — Release Gate

## Website Intelligence
- [x] Exact missing audit-history migration applied to connected Supabase project.
- [x] Local migration filename aligned with remote version `20261113180052`.
- [x] Audit table, tenant foreign key, website foreign key and history index verified.
- [x] RLS enabled; direct anon/authenticated access denied.
- [x] Service-role SELECT/INSERT privileges verified.
- [x] Server route distinguishes missing-table failures from database/permission failures.
- [x] HTTP redirects followed only after validating every destination.
- [x] Non-standard ports blocked.
- [x] HTML, robots.txt and sitemap downloads bounded by byte limits.
- [x] Robots parser handles CRLF and LF line endings and honors root Disallow for the crawler.
- [x] Website selector reloads the selected website's scan history.
- [x] Previous scan entry reopens its stored report.

## Regression
- [x] `npm run verify:all` — exit code 0.
- [x] 675 PASS assertions, 0 FAIL assertions.
- [x] 173 TypeScript/TSX files syntax-checked; 0 syntax errors.
- [x] Website Intelligence suite: 24/24.

## Not certified in this environment
- [ ] Next.js production build: dependency installation timed out; no `node_modules` were available.
- [ ] Browser click-through against the user's running localhost session.
- [ ] External Search Console / GA4 connections; these require the workspace's OAuth accounts and scopes.

## Test procedure after replacing source
1. Stop the local development server.
2. Extract this ZIP into the project folder.
3. Run `npm install` on the user's machine.
4. Start the app again with `npm run dev`.
5. Open Growth Engine → Website SEO.
6. Select `Anaira Graphics · graphics.anairapos.in`.
7. Click `Run SEO & health scan`.
8. Confirm the summary appears and the result is listed under `Previous scans`. Selecting a previous scan should reopen its saved report.

The reported "Audit completed but report could not be saved" issue was caused by the absent `growth_website_audits` table. That table is now installed in the connected database.
