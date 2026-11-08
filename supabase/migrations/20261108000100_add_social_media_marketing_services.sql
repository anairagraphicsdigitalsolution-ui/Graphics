-- Anaira portfolio: expanded creative, social media and digital marketing services.
-- Safe to run on an existing project; preserves all other site_settings keys.
update public.site_settings
set value = jsonb_set(
  coalesce(value, '{}'::jsonb),
  '{services}',
  '[
    {"number":"01 / CREATIVE","title":"Graphic Design & Brand Identity","description":"Logo design, brand guidelines, social media creatives, restaurant menus, banners, hoardings, packaging and print-ready artwork."},
    {"number":"02 / SOCIAL","title":"Social Media Marketing & Account Handling","description":"Facebook and Instagram page setup, profile optimization, monthly content calendars, post and story publishing, reels planning, community management, inbox coordination and monthly performance reporting."},
    {"number":"03 / ADVERTISING","title":"Paid Advertising & Campaign Management","description":"Meta Ads for Facebook and Instagram, Google Search and Display Ads, YouTube campaigns, lead generation, audience targeting, retargeting, conversion tracking and campaign optimization."},
    {"number":"04 / CONTENT","title":"Content Creation & Reels","description":"Campaign concepts, promotional creatives, copywriting, captions, hashtag strategy, short-form video editing, reels, product showcases and ad creatives."},
    {"number":"05 / GROWTH","title":"SEO & Digital Growth","description":"On-page SEO, technical SEO, local SEO, keyword research, Google Business Profile optimization, website performance and analytics reporting."},
    {"number":"06 / WEB","title":"Website & E-commerce Development","description":"Business websites, WordPress and Elementor, Next.js applications, e-commerce stores, hotel and restaurant websites, booking systems and landing pages."},
    {"number":"07 / SOFTWARE","title":"Software, POS & ERP Development","description":"Anaira products and custom client solutions including POS, CRM, healthcare, school, hotel, inventory, accounting and business automation systems."},
    {"number":"08 / SUPPORT","title":"Digital Consulting & Maintenance","description":"Website care plans, hosting coordination, backups, updates, security checks, analytics setup and ongoing digital support."}
  ]'::jsonb,
  true
),
updated_at = now()
where id = 'main';

-- Also ensure the new expanded service copy is reflected in the main homepage intro.
update public.site_settings
set value = jsonb_set(
  value,
  '{services_intro}',
  '"From brand identity and social media growth to paid advertising, websites and enterprise software, Anaira brings your complete digital presence under one roof."'::jsonb,
  true
),
updated_at = now()
where id = 'main';
