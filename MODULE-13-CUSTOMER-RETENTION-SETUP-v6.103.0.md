# Module 13 — Customer Retention Setup

1. Deploy the v6.103.0 source and ensure the existing worker cron is active with `CRON_SECRET`.
2. Open `/admin/ai-growth/retention` and choose the correct client workspace.
3. Add customers to CRM and record explicit global contact consent plus explicit email-channel consent evidence. Confirm the email is deliverable and the address is not suppressed.
4. Review the Engaged / At Risk / Dormant segments. These are CRM activity-recency groups, not predictive churn scores.
5. Select a Won customer, choose a touchpoint type (repeat purchase, feedback, review, reactivation, renewal or loyalty), enter a neutral message and schedule it in browser-local time. Save it as a draft.
6. A workspace editor/manager must select **Approve & queue**. Approval is blocked when the customer has no email, no explicit email consent, a global opt-out, a channel suppression, a bounce or a complaint.
7. The worker rechecks customer consent, channel suppression, email deliverability and workspace send/quiet-hours policy before calling the provider. Quiet-hours or disabled-channel policy may defer the job.
8. Follow status in Touchpoint approval & history. Terminal provider errors are recorded as Failed; successful provider acceptance is recorded as Sent.
9. Review Center email requests now also require a unique CRM match and explicit email consent; they queue through the same worker. WhatsApp/SMS review requests remain drafts in this path.

Existing internal 7/30/60/90-day retention task sequences remain available from the customer CRM record. They do not send messages automatically.
