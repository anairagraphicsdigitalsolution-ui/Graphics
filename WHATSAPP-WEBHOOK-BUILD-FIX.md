# v6.48.1 – WhatsApp webhook TypeScript build fix

Fixed the conversation insert/update typing issue in `app/api/growth/whatsapp/webhook/route.ts`.

Previously, the route assigned the insert result (`{ id }`) to a variable inferred from a query selecting `{ id, messages }`, which caused the Next.js type-check failure. The route now stores the conversation identifier in a separate `conversationId: string | null`, checks insert/update errors, and uses that identifier when creating a CRM lead.

This resolves the specific TypeScript mismatch shown in the v6.48.0 build log. A full Next.js production build was not run in this packaging environment because dependencies (`node_modules`) are not installed here. Run `npm install` and `npm run build` locally to verify the complete project.
