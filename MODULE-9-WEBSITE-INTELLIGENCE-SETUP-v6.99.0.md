# Anaira AI Growth Engine — Module 9: Website Intelligence (v6.99.0)

## What is included

- First-party website page-view, visitor and per-tab session tracking.
- Consent-gated analytics events: page view, form start, form submit, chat open and conversion.
- UTM and Google click-id attribution capture (gclid, gbraid, wbraid).
- Website enquiry form capture directly into the correct tenant CRM workspace.
- Explicit contact-consent recording; follow-up automation is queued only when the visitor checks the contact-consent field.
- Duplicate form submission protection using a site-scoped submission identifier.
- 30-day visitor/session, landing-page, source and form funnel dashboard.
- Domain DNS verification required before tracking-key issuance and public tracking.
- Tracking-key rotation/revocation; plaintext key is returned only once and only its SHA-256 hash is stored.
- Homepage audit change detection against the preceding saved audit.

## Live database migrations

1. `20261116044413_growth_website_intelligence_v6990.sql`
2. `20261116044552_growth_website_form_idempotency_v6990a.sql`

Both migrations were applied to the connected Anaira Growth Supabase project. All three Module 9 tables have RLS enabled. Public/anonymous direct table access is revoked; event/form writes use the server-side service role after key, website, verified-origin, payload and rate-limit checks.

## Activation

1. Open **Admin → AI Growth → Website Intelligence** and select a verified website.
2. Under **Visitor analytics & lead forms**, choose **Generate tracking key**.
3. Copy the displayed script snippet immediately. The key is shown only once; rotate it if it is lost.
4. Install the script on the website before the closing `</body>` tag. The snippet points to the current Anaira Growth Engine deployment as the API origin.
5. Integrate the website's consent manager. Only after analytics permission is granted, call:

   ```js
   window.anairaGrowth.setConsent(true);
   ```

   On withdrawal, call `window.anairaGrowth.setConsent(false)`. Ad measurement permission is separate; call `window.anairaGrowth.setAdUserDataConsent(true)` only after the required ad-data consent is obtained.

6. To capture a form into CRM, add `data-anaira-capture` and `data-anaira-form="contact"` to the form. Provide fields named `name`, `email` or `phone`, and `requirement` (or `message`). An optional checkbox named `consent` records contact permission. Example:

   ```html
   <form data-anaira-capture data-anaira-form="contact">
     <input name="name" required>
     <input name="email" type="email">
     <textarea name="requirement" required></textarea>
     <label><input type="checkbox" name="consent"> I agree to be contacted about this enquiry.</label>
     <button type="submit">Send enquiry</button>
   </form>
   ```

7. The existing Anaira AI sales chat emits `chat_open` automatically when the widget is opened (when the tracker and analytics consent are active). Other website chat integrations can call `window.anairaGrowth.track('chat_open')`; conversion points can call `window.anairaGrowth.track('conversion', { campaign_id: '...' })`.

## Data and consent rules

- The tracker does not send analytics events until analytics consent is granted. This is an integration hook; the website owner must connect it to their actual consent manager and publish an appropriate privacy notice.
- Contact consent and ad-measurement consent are separate flags. Submitting a form does not imply either consent.
- A CRM enquiry can be saved without contact consent, but automated follow-up is not queued unless the contact checkbox is explicitly checked.
- Visitor identifiers are random pseudonymous values; the tracker does not send or store form PII in browser storage. Session identifiers are stored in sessionStorage; visitor identifiers are stored in localStorage.
- No IP address is persisted in the event table. The rate-limit subsystem stores a one-way digest as defined by the existing platform limiter.
- Dashboard figures are actual received events/submissions only. No sample or fabricated visitor counts are inserted.
- Form abandonment is an estimate from consented form-start and form-submit events; it is not a full per-form behavioural replay. Analytics events are absent for visitors who do not grant analytics consent.

## Known limitations / production certification

- The tracker requires the website to load the Anaira public tracker script and allow requests to the Anaira API origin (CSP/CORS/firewall configuration may be required).
- The tracker does not inject or create a consent banner. The site must provide and operate its own consent manager.
- Landing-page creation/design builder is not introduced in this module; tracking can be embedded in existing landing pages/forms.
- Chat-open events require the website chat widget to call the documented tracking hook.
- Funnel metrics are first-party observed events and CRM submissions; cross-device identity resolution is not implemented.
- Browser E2E on a verified external domain, two-tenant isolation test, consent-manager integration, live form submission and provider/deployment checks remain outstanding.
- `npm run build` was attempted but could not start because the working environment has no installed Next.js binary (`next: not found`).

## Verification

- Module 9 static assertions: see `VERIFY-GROWTH-WEBSITE-INTELLIGENCE-v6.99.0.log`.
- Full regression: see `VERIFY-ALL-v6.99.0.log`.
- Syntax: 224 TS/TSX files, 0 syntax errors.
- Static migration audit: see `MIGRATION-AUDIT-v6.99.0.log`; live RLS and grants were separately checked in the connected database.
