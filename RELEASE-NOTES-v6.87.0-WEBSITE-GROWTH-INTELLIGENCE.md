# Anaira AI Growth Engine v6.87.0 — Website Growth Intelligence v1

## Delivered in this package
- New Website SEO dashboard at `/admin/ai-growth/website-intelligence`.
- Owner/manager-triggered homepage SEO and health scan for DNS-verified websites.
- Checks for title, meta description, H1 count, canonical, robots indexability, HTTPS, viewport and sitemap.
- Captures HTTP status, response time, internal/external link counts and key page metadata.
- Stores tenant-scoped audit reports and history in `growth_website_audits`.
- Blocks localhost/private IP targets and respects a root robots.txt rule disallowing the crawler.
- Added database migration and static verification script.
- Added Website SEO navigation entry.

## Required activation
1. Apply `supabase/migrations/20261113180052_growth_website_intelligence_v1.sql`.
2. Deploy the updated source.
3. Open Growth Engine → Website SEO, select a DNS-verified website and run a scan.

## Not included / still requires separate integration work
- Google Search Console OAuth/property verification and search analytics sync.
- GA4 OAuth/property selection and analytics sync.
- Multi-page crawler, broken-link status crawling, scheduled uptime/SSL monitoring and alert delivery.
- Real conversion pixel/event SDK and attribution ingestion.
- Automated SEO changes/publishing. Reports are diagnostic; no website content is changed.

No Google/GA4/Search Console data is fabricated. External services require the customer's own credentials and property access.
