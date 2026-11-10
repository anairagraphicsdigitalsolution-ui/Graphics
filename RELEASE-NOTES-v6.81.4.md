# Anaira AI Growth Engine v6.81.4

## Website page hero colour fix
- Connected the Website Development (`/websites`) page hero eyebrow, heading, and description colours to the saved Website Settings values.
- Connected overlay colour, overlay opacity, and image position settings to the same hero component.
- Existing Website Page Hero controls in Admin > Website Settings > Page Hero Images now affect the rendered `/websites` hero.
- No existing portfolio project or contact form data is modified.

## Verification
- Added `verify:website-page-hero` to check the page-to-settings connections and Admin controls.
- Run `npm run verify:all` for the complete source verification suite.
