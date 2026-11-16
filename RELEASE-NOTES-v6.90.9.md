# Anaira AI Growth Engine v6.90.9

## Prospect website enrichment security hardening
- Reject unsafe URL schemes, credentials, local hosts and IP literals.
- Validate DNS answers before crawling and before each page request.
- Disable redirects and enforce same-host HTTPS crawling.
- Enforce HTML-only responses and a 750 KB streaming body cap.
- Added 13 dedicated source regression checks and included them in `verify:all`.

## Verification
- Full configured regression suite: 768 PASS assertions, 0 FAIL assertions.
- Production build and live provider/database tests are not certified in this release.
