# Cashfree Payments — AI Growth Engine v6.79.4

## What is implemented
- Workspace-owner authenticated checkout endpoint: `POST /api/growth/billing/checkout`.
- Plan price is read from the server-side plan catalogue; the browser cannot choose or override the amount.
- Cashfree hosted checkout session creation for INR plans.
- HMAC-SHA256 webhook signature verification using the exact raw request body and Cashfree timestamp header.
- Payment status is independently fetched from Cashfree before activating a tenant subscription. Browser redirects are never treated as proof of payment.
- Payment ledger and webhook event ledger with unique order/event identifiers.
- Tenant subscription activation and platform audit event after verified success.

## Required Vercel environment variables
Set these as **server-only** variables (do not prefix with `NEXT_PUBLIC_`):

```env
CASHFREE_APP_ID=your_cashfree_app_id
CASHFREE_SECRET_KEY=your_cashfree_secret_key
CASHFREE_ENV=sandbox
NEXT_PUBLIC_SITE_URL=https://graphics.anairapos.in
```

For live payments, set `CASHFREE_ENV=production` only after Cashfree activates the merchant account and production credentials are issued. Keep `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` out of browser code and source control.

## Supabase migration
Apply:

`supabase/migrations/20261110000000_growth_cashfree_payments_v6794.sql`

It creates `growth_payment_transactions` and `growth_payment_webhook_events`. Both tables have RLS enabled and are restricted to `service_role`.

## Cashfree Dashboard webhook
Configure the webhook URL:

`https://graphics.anairapos.in/api/growth/billing/cashfree-webhook`

Subscribe to payment success/failure events (at minimum `PAYMENT_SUCCESS` and `PAYMENT_FAILED`, plus the current equivalent event names offered in your Cashfree dashboard). Use the same Cashfree app credentials for the selected environment. Cashfree sends `x-webhook-signature` and `x-webhook-timestamp`; the endpoint validates both against the raw payload.

## Checkout behavior
Workspace owner opens `/admin/ai-growth/billing`, chooses a published INR plan and interval, enters a mobile number and selects **Pay with Cashfree**. Cashfree Checkout handles UPI (including Google Pay when available), cards and net banking according to the merchant account's enabled methods. Subscription status changes to `active` only after the server verifies a successful payment and matching amount/currency.

## Important limits / manual steps
- No Cashfree merchant account, KYC approval, credentials, production webhook delivery or live transaction can be created from source code. Those require the merchant account owner.
- This release implements one-time plan-period collection. It does not yet create Cashfree recurring mandates/UPI AutoPay subscriptions or automatically charge renewals. Renewal reminders and manual renewal checkout remain necessary until the Cashfree Subscriptions API lifecycle is implemented and approved.
- Payment refunds, settlement reconciliation, GST invoices and chargeback handling remain pending.
- Cashfree pricing is not universally free. Signup/setup may have no fee and promotions may apply, but transaction/subscription charges depend on the merchant offer and payment method. Confirm the current signed pricing terms in the Cashfree dashboard.
