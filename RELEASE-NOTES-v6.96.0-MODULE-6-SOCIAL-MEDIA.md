# Anaira AI Growth Engine v6.96.0 — Module 6: Social Media Management

## Implemented in source
- Dedicated Social Media workspace page and navigation entry.
- Tenant-scoped account inventory for Facebook Pages, linked Instagram Professional accounts, LinkedIn and YouTube.
- Provider health checks, account diagnostics, token refresh through the existing OAuth resolver, and explicit disconnect.
- Meta OAuth requests Facebook Page engagement and Instagram comment-management permissions.
- Safer Meta Page-token handling: Page/Instagram tokens are validated with provider calls rather than refreshed using the parent user's expiry timestamp.
- Recent Facebook and Instagram post sync with engagement snapshots.
- Account-specific best-time suggestions calculated from observed post engagement in Asia/Kolkata; recommendations remain unavailable until sufficient data exists.
- Social comment inbox for the latest 25 synced Meta posts, up to 50 comments per post, with public replies.
- Atomic comment-reply claim to prevent concurrent duplicate replies; ambiguous provider outcomes are held for manual verification instead of blind retry.
- Explicit privilege lockdown: authenticated clients receive SELECT only on new post/comment tables; anon has no access and service-role performs writes.
- Meta OAuth callback now fails closed if no Page was authorized or account persistence fails.
- Existing Facebook/Instagram DM and Messenger conversations are surfaced through the unified inbox for social-channel tenants without requiring the AI Employee entitlement.
- Existing approval-first Content Studio publishing and Meta insights are linked into the Social Media workspace.

## Provider support boundaries
- OAuth/account health: Facebook, Instagram, LinkedIn and YouTube.
- Post snapshot sync, comment sync and comment replies: Facebook Pages and Instagram Professional accounts only.
- Scheduled publishing remains limited to the exact supported formats in Content Studio: Facebook text/photo post, Instagram image post/reel, LinkedIn post/carousel, YouTube video/reel.
- LinkedIn/YouTube post-level analytics and comment moderation are not implemented by this increment.
- Live provider E2E is not certified by static tests. Meta app review, provider scopes, real connected accounts, rate limits and production webhook/cron delivery must be tested separately.

## Database
- `20261116040854_growth_social_management_v6960`: account health fields, `growth_social_posts`, `growth_social_comments`, RLS and indexes.
- `20261116040940_growth_social_comment_reply_claim_v6960b`: atomic comment reply claim fields and `replying` state.
- `20261116041244_growth_social_comment_outcome_unknown_v6960c`: ambiguous provider outcome hold.
- `20261116041334_growth_social_table_privilege_lockdown_v6960d`: anon/authenticated write revocation and service-role-only writes.
