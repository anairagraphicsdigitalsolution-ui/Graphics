# Anaira AI Growth Engine — Release Notes v6.90.8

## Workflow execution integrity
- Triggered workflows now resolve and enqueue the exact immutable `growth_workflow_versions` snapshot selected by `published_version`.
- The runner verifies that the snapshot belongs to the same organization and rule and that its trigger matches the published rule.
- Missing or mismatched published snapshots fail closed; mutable draft `workflow_steps` are not used as a fallback.
- Publishing an older legacy workflow now creates its immutable baseline snapshot before enabling it.
- Lead-created and lead-transition workflow enqueue errors are surfaced instead of being silently ignored by the automation library.
- Public website lead capture now reports when the lead was saved but automated follow-up could not be queued, and writes a structured server log for operator follow-up.
- Added regression checks for published-version execution, fail-closed behavior, enqueue error propagation, and legacy baseline creation.

## Verification
- `npm run verify:all`: passed (exit code 0).
- Raw verification log: `VERIFICATION-v6.90.8.log`.
- Targeted workflow engine suite: 22/22 checks passed.
- Production build and live Supabase/provider certification are not claimed.

## Release boundary
This is a source-level integrity update. It does not apply Supabase migrations, configure provider credentials, or certify live execution. Existing v6.90.7 migrations remain required and must be applied to the dedicated Growth Engine project in chronological order after project confirmation.
