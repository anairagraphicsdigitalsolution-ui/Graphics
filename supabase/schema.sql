-- Anaira Graphics & Digital Solution portfolio CMS
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function public.is_anaira_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admin_users where user_id = auth.uid()); $$;

grant execute on function public.is_anaira_admin() to anon, authenticated;

create table if not exists public.site_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.projects (
  id text primary key,
  title text not null,
  category text not null default '',
  department text not null default 'graphics',
  kind text not null check (kind in ('product','client-software','website','creative')),
  summary text not null default '',
  description text not null default '',
  image_url text not null default '',
  live_url text not null default '',
  technologies text[] not null default '{}',
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.projects enable row level security;
alter table public.inquiries enable row level security;

-- Public visitors can read published portfolio content.
drop policy if exists "Public can read settings" on public.site_settings;
create policy "Public can read settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins manage settings" on public.site_settings;
create policy "Admins manage settings" on public.site_settings for all to authenticated using (public.is_anaira_admin()) with check (public.is_anaira_admin());
drop policy if exists "Public can read projects" on public.projects;
create policy "Public can read projects" on public.projects for select to anon, authenticated using (true);
drop policy if exists "Admins manage projects" on public.projects;
create policy "Admins manage projects" on public.projects for all to authenticated using (public.is_anaira_admin()) with check (public.is_anaira_admin());
drop policy if exists "Admins read admin users" on public.admin_users;
create policy "Admins read admin users" on public.admin_users for select to authenticated using (public.is_anaira_admin());
drop policy if exists "Public submit inquiries" on public.inquiries;
create policy "Public submit inquiries" on public.inquiries for insert to anon, authenticated with check (length(name) between 1 and 120 and length(contact) between 1 and 180 and length(message) between 1 and 5000);
drop policy if exists "Admins read inquiries" on public.inquiries;
create policy "Admins read inquiries" on public.inquiries for select to authenticated using (public.is_anaira_admin());

insert into public.site_settings(id,value) values ('main', '{
 "company_name":"Anaira Graphics & Digital Solution",
 "tagline":"We Build Brands. We Build Technology.",
 "subheading":"Creative Design · Digital Solutions · Enterprise Software",
 "established":"2013",
 "phone":"", "whatsapp":"", "email":"", "address":"Kullu, Himachal Pradesh, India",
 "logo_url":"", "hero_image_url":"",
 "about_title":"Ideas into identity. Technology into growth.",
 "about_text":"Anaira Graphics & Digital Solution is a creative and technology company established in 2013. We help businesses build their identity, strengthen their digital presence and streamline operations through design, websites and custom software.",
 "footer_text":"Creative Design · Digital Solutions · Enterprise Software",
 "instagram":"https://www.instagram.com/anairagraphics", "facebook":"", "linkedin":"",
 "primary_cta":"Explore Our Work", "secondary_cta":"Contact Us"
}') on conflict(id) do nothing;

insert into public.projects(id,title,category,department,kind,summary,description,technologies,featured,sort_order) values
('anaira-pos','Anaira POS','Retail & Hospitality','software','product','Billing, inventory and business operations in one platform.','Anaira-owned point of sale and business management platform.',array['Next.js','Supabase','PostgreSQL'],true,1),
('anaira-crm','Anaira CRM','Customer Management','software','product','Customer relationships, leads, follow-ups and business workflows.','Anaira-owned CRM platform.',array['Next.js','Supabase'],true,2),
('anaira-healthcare','Anaira Healthcare Management System','Healthcare ERP','software','product','Clinic and hospital operations management.','Multi-clinic healthcare management platform.',array['Next.js','Supabase','PostgreSQL'],true,3),
('anaira-school-erp','Anaira School ERP','Education ERP','software','product','Connected school administration, staff, student and parent workflows.','School management ERP product.',array['Next.js','Supabase'],true,4),
('anaira-hotel-pms','Anaira Hotel PMS','Hospitality','software','product','Hotel property operations and guest management.','Anaira-owned hotel property management system.',array['Next.js','Supabase'],true,5),
('anaira-booking','Anaira Booking Engine','Hospitality','software','product','Hotel search, availability, rates and booking workflows.','Direct hotel booking engine.',array['Next.js','Supabase'],false,6),
('anaira-marketplace','Anaira Marketplace','Marketplace','software','product','A connected marketplace for hospitality and food businesses.','Anaira-owned marketplace platform.',array['Next.js','Supabase'],false,7),
('mee','MEE – Multi-Store Billing & Inventory','Retail ERP','software','client-software','Multi-store billing, inventory, customer ledger and storefront management.','Client software project for managing multiple retail stores.',array['Next.js','Supabase','PostgreSQL'],true,8),
('sofson-repair','Sofson Repair & Product Management','Repair Management','software','client-software','Repair workflows and product management.','Client software project for repair and product operations.',array['Software Development'],true,9),
('sofson-ledger','Sofson Local Ledger','Accounting','software','client-software','Local-first desktop ledger and accounting software.','Windows desktop ledger application with local database workflows.',array['SQLite','Python','PyInstaller'],true,10),
('royal-alliance','Royal Alliance – Annual Member Draw Management','Membership & Draw Management','software','client-software','Member collections, agent commissions and monthly draw management.','Client software project for annual member draw operations.',array['Next.js','Supabase'],false,11),
('hotplot','HOTPLOT','Hospitality / Investor Platform','software','client-software','Hospitality-focused software and investor platform.','Software project. Detailed case study can be completed from approved project information.',array['Web Application'],true,12),
('mk-trip-expert','MK Trip Expert','Travel & Tourism','websites','website','Travel website and digital experience.','Website project for MK Trip Expert.',array['Website Development'],true,13),
('mudhouse','Mudhouse','Hotel & Hospitality','websites','website','Hotel website and booking experience.','Website project for Mudhouse.',array['Website Development'],true,14),
('hotel-kullu-valley','Hotel Kullu Valley','Hotel Website','websites','website','Hotel website and hospitality digital presence.','Website project for Hotel Kullu Valley.',array['Website Development'],true,15),
('chai-chaat-chapati','Chai Chaat Chapati','Restaurant Website','websites','website','Restaurant website and digital presence.','Website project for Chai Chaat Chapati.',array['Website Development'],true,16),
('the-mountain-heart','The Mountain Heart','Restaurant & Guest House','websites','website','100% vegetarian dhaba and guest house website.','Website project for The Mountain Heart.',array['Website Development'],false,17),
('travel-with-madhavas','Travel With Madhavas','Travel & Events','websites','website','Travel and festival project website.','Website project for Travel With Madhavas.',array['Website Development'],false,18),
('kath-kuni','Kath Kuni','Hospitality & Branding','websites','website','Hospitality website and brand experience.','Website project for Kath Kuni.',array['Website Development','Branding'],true,19),
('prasoon-agro','Prasoon Agro','Agriculture & Business','websites','website','Agriculture and business website.','Website project for Prasoon Agro.',array['Website Development'],true,20),
('graphics-portfolio','Graphic Design & Print Portfolio','Branding & Print','graphics','creative','Brand identities, banners, menus, event creatives and print-ready artwork.','Selected graphic design work by Anaira Graphics & Digital Solution.',array['Graphic Design','Print Design'],true,21)
on conflict(id) do nothing;

-- Create a public Storage bucket for portfolio images.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('portfolio-media','portfolio-media',true,10485760,array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
on conflict(id) do nothing;
drop policy if exists "Public can view portfolio media" on storage.objects;
create policy "Public can view portfolio media" on storage.objects for select using (bucket_id='portfolio-media');
drop policy if exists "Anaira admins upload portfolio media" on storage.objects;
create policy "Anaira admins upload portfolio media" on storage.objects for insert to authenticated with check (bucket_id='portfolio-media' and public.is_anaira_admin());
drop policy if exists "Anaira admins update portfolio media" on storage.objects;
create policy "Anaira admins update portfolio media" on storage.objects for update to authenticated using (bucket_id='portfolio-media' and public.is_anaira_admin()) with check (bucket_id='portfolio-media' and public.is_anaira_admin());
drop policy if exists "Anaira admins delete portfolio media" on storage.objects;
create policy "Anaira admins delete portfolio media" on storage.objects for delete to authenticated using (bucket_id='portfolio-media' and public.is_anaira_admin());
