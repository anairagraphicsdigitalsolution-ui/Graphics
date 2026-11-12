# v6.86.1 Build Fix

## Fixes
- Annotated Meta campaign optimization provider parameters as `Record<string, string}` to prevent TypeScript from inferring a union with optional `undefined` properties.
- Confirmed `nodemailer` and `@types/nodemailer` are declared in package.json for the SMTP integration connection test.

## Required install step
The build log shows that the current `node_modules` does not contain `nodemailer`, even though it is a declared dependency. From the project root run:

```powershell
npm install
```

If the package still cannot be resolved, run:

```powershell
npm install nodemailer
npm install -D @types/nodemailer
```

Then run:

```powershell
npm run build
```

Do not delete or change `GROWTH_TOKEN_ENCRYPTION_KEY`.

## Verification boundary
The TypeScript inference fix is applied in source. A full Next.js build was not run in this environment because the project dependencies and the user's `.env.local` / Supabase credentials are not available here. Verify the build in the same Windows project directory after installing dependencies.
