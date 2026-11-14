# Anaira AI Growth Engine v6.87.4 — Responsive Workspace Navigation & Client Login

## UI changes
- Replaced the Growth Engine's horizontal top module menu with a persistent desktop sidebar.
- Added a mobile/tablet fixed bottom navigation with four primary destinations and a More drawer for all remaining modules.
- Added active-route states, keyboard Escape handling for the mobile drawer, safe-area padding, and a desktop sign-out control.
- Consolidated the dashboard navigation at the top-level workspace shell and removed duplicate legacy module menus from view.
- Added compact mobile layout adjustments for page headers, forms, tables, metrics, and action rows.

## Client access
- Added `/growth-login` for invited client and platform users to sign in with Supabase email/password.
- Added password-reset email flow.
- Kept registration invite-only; clients are not allowed to self-create organizations.
- Dashboard sends unauthenticated users to the dedicated Growth login instead of the website CMS admin login.
- Dashboard only shows the create-client-workspace control to platform administrators.
- Shared navigation recognizes all supported workspace roles (`owner`, `manager`, `editor`, `viewer`, `client`) and limits management-only links to owners/managers.

## Existing multi-tenant foundation confirmed
- Organizations are stored in `growth_organizations`.
- Membership and roles are stored in `growth_members`.
- Tenant data tables use organization-scoped RLS policies in the Growth multi-tenant migration.
- Server APIs verify Supabase bearer sessions and tenant roles through `growthContext` / `requireGrowthRole`.
- Workspace selection is retained across modules using the existing active-workspace selection key.

## Verification
- TypeScript/TSX syntax scan: PASS (161 source files, 0 syntax errors).
- Growth navigation checks: PASS.
- Growth navigation performance checks: PASS (12/12).
- Responsive UI checks: PASS (8/8 existing checks).
- Growth security checks: PASS.
- Team and invitation checks: PASS.
- Feature entitlement checks: PASS.
- Full `npm run verify:all` was attempted; it stopped at the existing Growth Operations check because `growth-intelligence.tsx` does not contain the expected “Website & Product Promotion Links” and “Platform Operations Readiness” sections. This unrelated check was not modified.
- Production Next.js build not run: dependencies are not installed in the uploaded source package.

## Client onboarding
1. Platform administrator creates a client workspace.
2. Invite the client from Growth → Team & Permissions and assign the intended role.
3. Client accepts the invitation / sets up their Supabase account.
4. Client signs in at `/growth-login` and sees only workspaces they belong to, subject to RLS and role permissions.
