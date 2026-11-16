# Anaira AI Growth Engine v6.124.5

## Build fix: Automation reliability nullable age guard

- Added a shared `isStaleLease` predicate which evaluates `ageMinutes` once and narrows the nullable result before comparing it to a threshold.
- Applied the predicate to stale workflow runs, autonomous schedule leases, and processing jobs.
- Preserves thresholds: 10 minutes for workflow runs and jobs; 20 minutes for enabled schedules.
- Added focused regression verifier and registered it in `verify:all`.
- Bumped package version to 6.124.5.

This source-level fix addresses the TypeScript nullability error reported in `app/api/growth/automation/reliability/route.ts`. A full Windows Next.js production build must still be run in the user's configured environment to certify the entire application.
