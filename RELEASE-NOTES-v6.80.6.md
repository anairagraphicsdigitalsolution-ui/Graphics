# Anaira AI Growth Engine v6.80.6

## Feature entitlement enforcement expansion

- Extended plan feature checks to Meta Ads campaign, ad set, creative, ad draft, insights and optimization APIs.
- Extended social-channel plan checks to social insights and YouTube status/analytics APIs.
- Extended AI Employee plan checks to authenticated inbox, email outbound and knowledge APIs.
- Added social-channel plan enforcement to AI content generation.
- Added a dedicated 13-route entitlement regression check and included it in `verify:all`.

## Compatibility and safety

- Platform admins retain their existing bypass.
- Existing legacy plan compatibility behavior remains unchanged: only explicitly disabled feature keys are denied.
- Public visitor chatbot/lead capture, OAuth callbacks, provider webhooks and billing endpoints were not blindly gated because they have separate public/provider lifecycle requirements.
- Main portfolio website pages and general Website Settings were not modified.

## Validation limitations

This is a targeted SaaS hardening release, not full production certification. Live provider tests, full cross-tenant/role matrix, clean dependency install, production build and deployment smoke tests remain outstanding.
