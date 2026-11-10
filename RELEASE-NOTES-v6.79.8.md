# Anaira AI Growth Engine v6.79.8

## Workflow condition groups

- Added bounded nested workflow condition expressions using `all` / `any` combinators.
- Retained backward compatibility with existing flat `field` / `operator` / `value` conditions.
- Enforced a maximum nesting depth of 3, 8 children per group, allowlisted lead fields/operators, and bounded skip targets.
- Worker evaluates nested conditions against the tenant-scoped lead loaded for the workflow run.
- Added regression coverage for validation and runtime evaluation.

## Important release boundary

This release does not complete the full visual graph editor, parallel branch fan-out/join execution, inbound email lifecycle, provider live certification, Cashfree recurring billing, or full production certification. These remain explicit follow-up work. Apply SQL migrations from the package before deploying; no new database migration is required for this change.
