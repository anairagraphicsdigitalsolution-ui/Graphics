# v6.86.2 Build Fix

Fixed the TypeScript compilation error in `components/growth-integrations-manager.tsx` by removing the duplicate `cx` property from the `labels` object. The existing `cx` label remains defined once as `Search Engine ID (cx)`.

Verification performed: confirmed the duplicate entry is removed and the source ZIP archive passes its integrity test. A full Next.js build must still be run in the user's Windows environment.
