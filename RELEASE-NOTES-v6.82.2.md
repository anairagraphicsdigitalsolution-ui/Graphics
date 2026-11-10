# Anaira AI Growth Engine v6.82.2

## AI chat diagnostics
- Trims server-side OPENAI_API_KEY and OPENAI_MODEL environment values.
- Website chat now returns a bounded, actionable OpenAI provider error (HTTP status and provider message) instead of masking every provider failure as a generic temporary error.
- Server logs include provider status, code, model and message; never log the API key.
- Default model remains `gpt-4.1-mini`.

## Important deployment checks
- Set `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-4.1-mini` in the Vercel project environment for the Production environment.
- Redeploy after changing environment variables.
- Ensure OpenAI API billing/credits and project key permissions are active. ChatGPT subscription is separate from API billing.
- Website assistant endpoint: `POST /api/growth/chat`; it also requires active Supabase organization, service role key, and available `ai_messages` quota.
- `/admin/ai-growth/employee` currently opens the channels/inbox panel; the floating website assistant is the `AISalesChat` widget mounted in the root layout.
