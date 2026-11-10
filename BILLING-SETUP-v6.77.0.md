# Growth Plans & Usage Setup — v6.77.0

## Configure plans
1. Sign in as an Anaira platform administrator.
2. Open `/admin/ai-growth/platform/billing`.
3. Create a plan with a unique slug, name, currency, monthly/yearly prices and usage limits.
4. Enter prices in rupees/dollars; the app stores paise/cents.
5. Use `-1` for unlimited. Available usage metrics:
   - `leads`
   - `ai_messages`
   - `whatsapp_messages`
   - `email_messages`
   - `social_posts`
   - `media_bytes`
   - `workflow_runs`
6. Assign a plan and subscription status to the selected organization.

## Workspace view
Workspace owners/managers can open `/admin/ai-growth/billing` to view the current subscription and usage counters.

## Enforcement behavior
- Website AI chat, website lead capture, AI content generation, media uploads, direct WhatsApp sends, WhatsApp AI inbound/outbound, queued WhatsApp/email jobs, social publishing and workflow-run starts call the atomic quota RPC.
- When an active subscription has a metric limit, exceeding it blocks the operation.
- Paused/past-due/cancelled/expired subscriptions block metered operations.
- Existing organizations without a subscription remain unmetered for compatibility until the platform admin assigns a plan.
- Missing metric keys and `-1` are unlimited.

## Payment gateway limitation
This release does not collect money. Subscription assignment is currently platform-admin controlled. Razorpay/Stripe checkout, signed payment webhooks, invoice generation, refunds and payment reconciliation need a selected provider and credentials before they can be implemented and tested.
