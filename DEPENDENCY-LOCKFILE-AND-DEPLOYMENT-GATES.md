# v6.124.6 Dependency Lockfile and Release Gates

## What changed in this package

- CI now generates `package-lock.json` from the exact checked-out `package.json` using `npm install --package-lock-only`.
- CI then performs a clean `npm ci` install.
- CI runs ESLint, TypeScript typecheck, the full regression suite, and the Next.js production build.
- CI uploads the generated `package-lock.json` as a 14-day workflow artifact, including when a later validation step fails, so the lockfile can be reviewed and committed.

## Why the lockfile is not bundled yet

The local execution environment cannot resolve `registry.npmjs.org` (`EAI_AGAIN`). A previous GitHub `main` package manifest was v6.110.0, not this package's v6.124.6 manifest; its lockfile is therefore not a safe substitute. This package intentionally does not contain a fabricated or mismatched lockfile.

## Required release sequence

1. Commit/push this exact v6.124.6 source package to the authorized repository branch (the currently connected `main` branch was observed at v6.110.0 and is not source-parity).
2. Run the `Anaira AI Growth CI` workflow.
3. Download the `anaira-growth-engine-v6.124.6-package-lock` artifact and commit the generated `package-lock.json` alongside the exact `package.json`.
4. Change CI to use the committed lockfile directly (remove the lockfile-generation step; keep `npm ci`).
5. Confirm ESLint, TypeScript, regression checks and production build all pass.
6. Deploy the exact validated commit to Vercel and verify the production deployment SHA before calling it released.

## External certification gates

OpenAI OCR/AI requests, Resend email, WhatsApp messaging, Meta Calling, two-tenant authenticated E2E, payment reconciliation, backup/restore, and incident recovery require valid provider accounts, approved credentials, safe test recipients, and/or an operational test environment. No credentials are embedded in this package and no live external messages or calls are sent by CI.
