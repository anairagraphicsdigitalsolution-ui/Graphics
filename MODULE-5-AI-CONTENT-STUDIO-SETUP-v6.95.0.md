# Module 5 — AI Content Studio setup (v6.95.0)

## What is included
- Workspace-aware AI generation for social posts, reels, stories, carousels, ad copy, articles, blogs, SEO, product and festival content.
- English, Hindi, Roman Hindi, Punjabi, Urdu and Spanish options in the Studio UI; the API accepts language tags for other supported model languages too.
- Tone and objective controls, hashtags, CTA, keywords, outline, script, alt text and review notes.
- Workspace brand profile and knowledge-base context are attached to every generation; the saved record keeps a brand-guidelines snapshot.
- Tenant-scoped reusable prompt templates.
- Media upload through the existing workspace media bucket.
- Approval-first calendar, selected connected account, queued publishing job and provider event history.
- Meta Facebook/Instagram insights and YouTube Analytics views.

## Provider configuration
- OpenAI: add an API key and optional model override in workspace Integrations, or set `OPENAI_API_KEY` and optional `OPENAI_MODEL` on the server.
- Facebook / Instagram: connect Meta OAuth with Page publishing and Instagram content publishing scopes; an Instagram Professional account must be linked to an eligible Facebook Page.
- LinkedIn: connect the LinkedIn OAuth app with the approved `w_member_social` permission.
- YouTube: connect Google OAuth with `youtube.upload`, `youtube.readonly` and `yt-analytics.readonly`; offline access / refresh token is required for scheduled uploads.
- Scheduler: deploy the existing protected `/api/growth/worker` cron with `CRON_SECRET`. The worker cadence depends on hosting/cron configuration.

## Scheduling restrictions enforced by the API
- Facebook: text/photo post.
- Instagram: image post or Reel (public HTTPS media URL required).
- LinkedIn: text/image/carousel post.
- YouTube: video via Reel/video format and public HTTPS video URL.
- Other content types remain content drafts and cannot be queued to a social provider by this increment.

## Live certification still required
Provider OAuth approval, connected account eligibility, provider-side publishing acceptance, public post visibility, YouTube resumable upload completion, Meta Insights and YouTube Analytics must be tested with real client accounts. The local static suite does not simulate those provider-side systems.
