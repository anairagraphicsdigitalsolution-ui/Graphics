# v6.97.0 — Module 7: Complete AI Growth Control Center

## Delivered
- Promoted `/admin/ai-growth` to the primary Complete AI Growth Control Center landing view.
- Added an authenticated, owner/manager-only, workspace-scoped control-center API.
- Consolidated 30-day leads, conversations, human handoffs, connected social accounts, approval queues, scheduled content, follow-up tasks, overdue tasks, failed jobs, open social comments, and recorded AI usage estimates.
- Added an action queue with deep links to the relevant operating module.
- Added social account health, open comment snapshots, failed-job diagnostics, recent workspace audit events, and shortcuts to AI Employee, CRM, Inbox, Content Studio, Campaigns, Analytics, Usage and Integrations.
- Added explicit data-quality signalling when a source fails or the 500-row AI usage sample cap is reached.
- Restricted the Control Center navigation item to workspace owners/managers and platform administrators.
- Preserved separate module routes and the existing AI Command Center / daily briefing experience under Overview.

## Important semantics
- AI cost is an estimate from `growth_usage_logs`; it is not an invoice and no single currency is assumed.
- Pending items are surfaced for human review; this dashboard does not auto-approve content, customer commitments, campaigns or budget changes.
- A configured social account is not evidence of a successful live provider transaction.
- Audit events shown are scoped to the selected workspace.

## Release gates
- Real browser E2E and deployed-provider verification remain required.
- Clean dependency installation and `next build` are required before production certification.
