# Anaira AI Growth Engine v6.93.8 — Workspace Context & Switching

## Changes
- Added an active workspace selector to the Growth Engine desktop navigation.
- Workspace choices are restricted to active organizations the signed-in user belongs to; platform administrators can select active platform workspaces.
- The selected workspace is persisted using the same `anaira-growth-active-org` key used by the Growth dashboard.
- The navigation role is resolved for the selected organization only, rather than aggregating the user's strongest role across all memberships.
- Switching workspace reloads the current route so client pages rehydrate against the newly selected workspace.
- Added a 10-assertion source verifier and included it in `verify:all`.

## Verification
- New workspace-context verifier: 10/10 PASS.
- Full suite: see `VERIFICATION-v6.93.8.log`.
- This change improves workspace context in navigation; it is not a substitute for backend tenant-isolation penetration tests.
- Build and live provider/database certification remain external release gates.
