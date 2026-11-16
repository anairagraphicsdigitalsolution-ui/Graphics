# v6.93.6 — Migration Security Audit

## Changes
- Added `npm run audit:growth-migrations`, a read-only static analyzer for the 74 SQL migration files.
- Inventories created tables, explicit RLS enablement, detected policies, SECURITY DEFINER functions, nearby `search_path` declarations, grants to `anon`/`public`, migration filename order and duplicate timestamp prefixes.
- Emits `MIGRATION-SECURITY-AUDIT-v6.93.6.json` for review.
- Added 12 assertions to `verify:all`.

## Source scan results
- 74 migration files, lexical filename order valid.
- 67 table declarations detected.
- No table declaration was missing an explicit `ENABLE ROW LEVEL SECURITY` statement in the static scan.
- 21 RLS-enabled tables had no explicit policy detected by the simple static parser. This is not automatically a vulnerability: some are intentionally service-role-only and revoke `anon`/`authenticated`; each must be checked against its migration grants and live database catalog.
- 23 SECURITY DEFINER function declarations detected; no nearby missing `search_path` was detected by the static scan.
- No `GRANT ... TO anon/public` statements and no duplicate timestamp prefixes detected.

## Verification
- `npm run verify:all`: 992 PASS, 0 FAIL.
- Migration audit verifier: 12/12 PASS.
- Production build remains blocked in this environment because `node_modules/next` is absent; the dependency lockfile is also absent.
- No live database was connected. This release does not apply migrations or certify live RLS behavior.

## Limitations
The analyzer uses static regular expressions. It cannot prove effective privileges, dynamic SQL behavior, inherited policies, or runtime database configuration. A live catalog audit and authenticated two-tenant tests remain mandatory.
