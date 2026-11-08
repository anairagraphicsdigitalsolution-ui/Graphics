# Anaira Graphics & Digital Solution — Portfolio Website

A Next.js 15 portfolio website with Supabase-powered editable content and an admin CMS, designed for deployment on Vercel.

## Included
- Luxury editorial visual system: deep forest green, antique gold, oversized serif typography, framed hero, refined motion and premium responsive cards
- Homepage, services, about, portfolio filters and contact enquiry form
- Separate portfolio types: Anaira products, client software, websites, creative work
- Admin login using Supabase Auth
- Admin project CRUD: add/edit/delete, category, type, descriptions, live URL, technologies, featured order and image URL
- Direct image uploads from Admin to Supabase Storage (10 MB limit; PNG/JPG/WebP/GIF/SVG)
- SQL setup automatically creates the public `portfolio-media` bucket and admin-only upload/update/delete policies; no service-role key is exposed in the browser
- Editable company details, homepage copy, CTA labels and social links
- Supabase SQL schema, seed portfolio projects and RLS policies

## Local setup
1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`. This creates the database tables, seed portfolio content, RLS policies and the `portfolio-media` Storage bucket automatically.
3. In Supabase Authentication, create an admin user with email/password.
4. In SQL Editor, grant that user admin access (replace with the user's Auth UID):

```sql
insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');
```

5. Copy `.env.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

6. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and `http://localhost:3000/admin`.

## Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel, import that repository.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Project Settings → Environment Variables (Production, Preview and Development as needed).
4. Deploy. Vercel will run `npm run build` automatically.
5. Add your custom domain in Vercel → Settings → Domains and update DNS as instructed by Vercel.
6. Set `NEXT_PUBLIC_SITE_URL` to the final public URL and redeploy.

## Admin usage
Visit `/admin`, sign in using the Supabase Auth admin user, and use:
- **Projects & Portfolio** to create, edit, delete, upload images and reorder projects.
- **Website Settings & Text** to update company details, headings, about text, contact information, social URLs, logo and hero background image.
- Image upload fields send files directly to your Supabase Storage bucket and save the resulting public URL into the relevant project/site setting.

## Visual direction
The public site uses a bespoke luxury editorial direction: forest-green canvas, muted gold detailing, Playfair Display headline typography, fine framing, dark portfolio cards and a contrasting warm-stone services/contact treatment. The content remains editable from the CMS.

## Important before public launch
- Replace placeholder phone/email/contact details in Admin.
- Add genuine project screenshots and approved live URLs. Existing portfolio entries are starter records based on the project names supplied; some descriptions are deliberately generic until confirmed.
- Add final logos and hero imagery in Admin / project records.
- Add a privacy policy and spam protection (e.g. CAPTCHA/rate limiting) before running paid traffic.
- Use only client-approved screenshots, logos and case-study details.

## Notes
- Do not put Supabase `service_role` keys in `NEXT_PUBLIC_` variables or browser code.
- Admin write access is restricted by the `admin_users` table and RLS policies in the included SQL.
- If Supabase is not configured, the public site falls back to the starter portfolio data, while CMS sign-in remains unavailable.


## Expanded services (v2.1)
The Services section now includes editable offerings for:
- Graphic Design & Brand Identity
- Social Media Marketing & Account Handling (Facebook / Instagram)
- Paid Advertising & Campaign Management (Meta, Google, YouTube)
- Content Creation, Reels, Copywriting and Ad Creatives
- SEO, Local SEO and Google Business Profile optimization
- Website & E-commerce Development
- Software, POS, CRM and ERP Development
- Digital Consulting, Website Maintenance and Support

### Apply the update to an existing Supabase database
Run `supabase/migrations/20261108000100_add_social_media_marketing_services.sql` in the Supabase SQL Editor. It updates only the `services` and `services_intro` keys in the `main` site settings record and preserves the other settings.

### Edit services
Sign in at `/admin`, open **Website Settings & Text**, edit the `Services` JSON list, and save. The service cards on the homepage read from this saved setting.

### Media uploads
Project images, logo and hero background uploads use the `portfolio-media` Supabase Storage bucket. Run `supabase/schema.sql` once on a fresh Supabase project to create the bucket, tables and policies. Never put a Supabase service-role key in browser or public Vercel variables.

## Department-wise project management (v2.2)
The Admin CMS now has separate department filters and a department-specific **Add Project** action for:
- Graphics & Printing
- Website Development
- Software Development
- Social Media Management
- Digital Advertising
- SEO & Digital Growth
- Content & Reels
- Branding & Identity

Each department can create, edit and delete its own portfolio entries. Project fields include title, category, department, portfolio type, summary, full description, live URL, technologies, featured status, display order and direct Supabase Storage image upload. The public portfolio filters by the same departments.

### Existing Supabase database upgrade
Run `supabase/migrations/20261108000200_add_project_departments.sql` in the Supabase SQL Editor before deploying this version. On a fresh database, run `supabase/schema.sql` instead; it includes the `department` column and seeds the existing portfolio items.

### Editable services
The service catalogue remains in Website Settings & Text as editable JSON. Update service titles/descriptions there; portfolio projects are managed separately under their department tabs.


## Anaira Supabase connection (configured)
- Project: `Anaira Graphics & Digital Solution`
- Project ref: `nrsdqrqkffhbicfskilb`
- Region: `ap-northeast-1`
- Local environment file: `.env.local` (uses the publishable key; never add a secret/service-role key to browser env)
- `.env.local` is ignored by Git. For Vercel, add the same URL and publishable key as Environment Variables.

The connected Supabase project was found and is active. At package preparation time, its `public` schema had no application tables and Storage had no buckets. Run `supabase/schema.sql` once in that project's SQL Editor to create portfolio tables, seed records, RLS policies and the `portfolio-media` bucket. Create the first Auth user and add its UUID to `public.admin_users` as described above.

## v3.1 additions
- Separate Privacy Policy and Terms & Conditions pages.
- Premium About and enquiry-focused Contact pages.
- Business address: Near Petrol Pump, Akhara Bazar, Kullu 175101, Himachal Pradesh, India.
- Phone/WhatsApp: +91 97365 80084.
- Click-to-call and WhatsApp enquiry actions.
- Facebook and Instagram footer icons; URLs are managed in Admin > Website Settings (facebook, instagram, linkedin fields).
- Contact form stores enquiries in Supabase `public.inquiries`; department is included in the message field.
- Legal pages are general templates and should be reviewed for your actual practices before publication.

## Website enquiry email notifications
Website enquiries are saved to the Supabase `inquiries` table when Supabase is configured. To also email every enquiry to `anairagraphicsdigitalsolution@gmail.com`, configure Resend on the deployment:

- `RESEND_API_KEY`: a Resend API key.
- `RESEND_FROM_EMAIL`: a sender address on a domain verified in Resend (for example `Anaira Website <website@yourdomain.com>`).

Add both as Vercel Environment Variables and redeploy. The destination is already set to `anairagraphicsdigitalsolution@gmail.com`. Without these mail settings, the form can still save to Supabase, but email delivery is not enabled.


## Homepage Hero Studio (v3.6)
In Admin CMS → Website Settings & Text → Homepage Hero Studio:
- Upload multiple hero images directly to the `portfolio-media` Supabase Storage bucket.
- Remove a slide or reorder slides with the arrow controls.
- Configure overlay colour and strength, heading/highlight/body text colours.
- Configure image fit and focal position, transition (fade, slide, zoom/fade, horizontal scroll), autoplay and interval.
- Use previous/next arrows and slide indicators on the public homepage.
- Save Website Settings to publish changes. Supabase schema and Storage bucket must be initialized first.
