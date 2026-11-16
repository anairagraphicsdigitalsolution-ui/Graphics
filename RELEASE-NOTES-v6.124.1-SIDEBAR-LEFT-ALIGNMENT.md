# v6.124.1 — Sidebar Left Alignment Fix

## Issue
The desktop sidebar inherited `align-items:center` from an earlier global navigation rule. As a result, its brand, workspace selector, search field, grouped navigation and footer shrank to intrinsic widths and appeared centered rather than filling the sidebar.

## Fix
- Override the fixed sidebar with `align-items: stretch`.
- Set direct sidebar sections to full available width with `min-width: 0` and border-box sizing.
- Make navigation groups and links full width.
- Force link contents and group captions to left alignment.
- Preserve mobile navigation behavior and existing colors/typography.

## Scope
CSS-only layout correction. No route, data, permission, or database changes.
