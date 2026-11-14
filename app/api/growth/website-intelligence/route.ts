import { NextRequest } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';

export const runtime = 'nodejs';
export const maxDuration = 45;

const USER_AGENT = 'AnairaGrowthBot/1.0 (+website audit; respects robots.txt)';
const MAX_HTML_BYTES = 2_000_000;
const MAX_ROBOTS_BYTES = 100_000;
const MAX_SITEMAP_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;

function privateIp(ip: string) {
  if (isIP(ip) === 4) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || p[0] >= 224;
  }
  const x = ip.toLowerCase();
  return x === '::1' || x === '::' || x.startsWith('fc') ||
    x.startsWith('fd') || x.startsWith('fe80:') || x.startsWith('::ffff:');
}

async function publicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error('Only HTTP and HTTPS websites can be scanned.');
  }
  if (u.username || u.password) throw new Error('URLs containing credentials are not allowed.');
  if (u.port) throw new Error('Custom website ports are not allowed for security reasons.');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('Private or local hosts cannot be scanned.');
  }
  if (isIP(host)) {
    if (privateIp(host)) throw new Error('Private or local hosts cannot be scanned.');
    return u;
  }
  const records = await lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some(x => privateIp(x.address))) {
    throw new Error('Website resolves to a private or restricted IP address.');
  }
  return u;
}

async function fetchPublic(
  raw: string,
  options: { headers?: Record<string, string>; timeoutMs: number; maxRedirects?: number }
) {
  let current = await publicUrl(raw);
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    // Re-resolve and validate every redirect target before making a request.
    current = await publicUrl(current.toString());
    const response = await fetch(current.toString(), {
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: options.headers,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Website returned a redirect without a destination.');
      if (redirects === maxRedirects) throw new Error('Website exceeded the redirect limit.');
      await response.body?.cancel();
      current = new URL(location, current);
      continue;
    }
    return { response, url: current };
  }
  throw new Error('Website exceeded the redirect limit.');
}

async function readTextLimited(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error('Website response is larger than the allowed scan limit.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Website response is larger than the allowed scan limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function stripText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagText(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}\\s*>`, 'gi'))]
    .map(match => stripText(match[2]).slice(0, 300));
}

function metaContent(html: string, name: string) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]);
  for (const tag of tags) {
    const tagName = tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
    if (tagName?.toLowerCase() !== name.toLowerCase()) continue;
    return tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || '';
  }
  return '';
}

function linkHref(html: string, rel: string) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
  for (const link of links) {
    const relationship = link.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    if (relationship.toLowerCase().split(/\s+/).includes(rel.toLowerCase())) {
      return link.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    }
  }
  return '';
}

function crawlerDisallowed(robots: string) {
  const botNames = new Set(['*', 'anairagrowthbot']);
  let agents: string[] = [];
  let hasRules = false;
  let blocked = false;
  const flush = () => {
    if (agents.some(agent => botNames.has(agent)) && blocked) return true;
    agents = [];
    hasRules = false;
    blocked = false;
    return false;
  };
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) {
      if (hasRules && flush()) return true;
      continue;
    }
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (hasRules && flush()) return true;
      agents.push(value.toLowerCase());
    } else if (key === 'disallow') {
      hasRules = true;
      if (value === '/') blocked = true;
    } else if (key !== 'allow') {
      hasRules = true;
    }
  }
  return flush();
}

function isMissingAuditTable(error: { code?: string; message?: string }) {
  return error.code === '42P01' || /growth_website_audits.*does not exist|relation .*growth_website_audits.*not exist/i.test(error.message || '');
}

export async function POST(req: NextRequest) {
  const context = await growthContext(req);
  if ('response' in context) return context.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || '');
    const websiteId = String(body.websiteId || '');
    const action = String(body.action || 'scan');

    if (!organizationId || !websiteId ||
      !await requireGrowthRole(context.db, context.userId, organizationId, ['owner', 'manager'])) {
      return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    }

    const { data: site, error: siteError } = await context.db
      .from('growth_websites')
      .select('id,name,website_url,domain,verification_status')
      .eq('id', websiteId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (siteError || !site) return apiJson({ error: 'Website not found or unavailable.' }, 404);
    if (site.verification_status !== 'verified') {
      return apiJson({ error: 'Verify domain ownership before running website scans.' }, 409);
    }

    const started = Date.now();
    const homepage = await fetchPublic(site.website_url, {
      timeoutMs: 18_000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
    const response = homepage.response;
    const base = homepage.url;
    if (!response.ok) return apiJson({ error: `Website returned HTTP ${response.status}.` }, 502);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) {
      return apiJson({ error: 'The website homepage did not return HTML.' }, 415);
    }

    // Robots rules are evaluated against the final homepage host after validated redirects.
    try {
      const robots = await fetchPublic(new URL('/robots.txt', base).toString(), {
        timeoutMs: 5_000,
        headers: { 'User-Agent': USER_AGENT },
      });
      if (robots.response.ok) {
        const robotsText = await readTextLimited(robots.response, MAX_ROBOTS_BYTES);
        if (crawlerDisallowed(robotsText)) {
          return apiJson({ error: 'This website disallows automated crawling in robots.txt. No scan was performed.' }, 403);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('larger than the allowed scan limit')) {
        return apiJson({ error: error.message }, 413);
      }
      // Missing or temporarily unavailable robots.txt does not block a basic homepage check.
    }

    const html = await readTextLimited(response, MAX_HTML_BYTES);
    const title = tagText(html, 'title')[0] || '';
    const description = metaContent(html, 'description');
    const h1 = tagText(html, 'h1');
    const canonicalRaw = linkHref(html, 'canonical');
    let canonical = '';
    if (canonicalRaw) {
      try { canonical = new URL(canonicalRaw, base).toString(); } catch { canonical = canonicalRaw; }
    }
    const robots = metaContent(html, 'robots') || 'default';
    const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>/gi)]
      .map(match => match[1]).slice(0, 500);
    const internal = new Set<string>();
    const external = new Set<string>();

    for (const href of links) {
      try {
        const url = new URL(href, base);
        if (!['http:', 'https:'].includes(url.protocol)) continue;
        url.hash = '';
        (url.hostname.toLowerCase() === base.hostname.toLowerCase() ? internal : external).add(url.toString());
      } catch {
        // Ignore malformed links.
      }
    }

    let sitemapFound = false;
    let sitemapDetail = 'Sitemap not found at /sitemap.xml';
    try {
      const sitemap = await fetchPublic(new URL('/sitemap.xml', base).toString(), {
        timeoutMs: 7_000,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml,text/xml,*/*' },
      });
      if (sitemap.response.ok) {
        const sitemapType = (sitemap.response.headers.get('content-type') || '').toLowerCase();
        const sitemapText = await readTextLimited(sitemap.response, MAX_SITEMAP_BYTES);
        sitemapFound = sitemapType.includes('xml') || /<(urlset|sitemapindex)\b/i.test(sitemapText);
        sitemapDetail = sitemapFound ? 'Sitemap found' : 'Response did not contain XML sitemap content';
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('larger than the allowed scan limit')) {
        sitemapDetail = 'Sitemap exceeds the scan size limit';
      }
    }

    const checks = [
      { key: 'title', label: 'Page title', pass: !!title, detail: title || 'Missing title tag' },
      { key: 'description', label: 'Meta description', pass: !!description, detail: description || 'Missing meta description' },
      { key: 'h1', label: 'H1 heading', pass: h1.length === 1, detail: `Found ${h1.length} H1 headings` },
      { key: 'canonical', label: 'Canonical URL', pass: !!canonical, detail: canonical || 'Canonical link not found' },
      { key: 'robots', label: 'Indexability', pass: !/(noindex|none)/i.test(robots), detail: robots },
      { key: 'https', label: 'HTTPS', pass: base.protocol === 'https:', detail: base.protocol },
      { key: 'viewport', label: 'Mobile viewport', pass: !!metaContent(html, 'viewport'), detail: metaContent(html, 'viewport') ? 'Viewport configured' : 'Viewport meta tag missing' },
      { key: 'sitemap', label: 'Sitemap', pass: sitemapFound, detail: sitemapDetail },
    ];
    const score = Math.round(checks.filter(check => check.pass).length / checks.length * 100);
    const scannedAt = new Date().toISOString();
    const report = {
      websiteId,
      domain: base.hostname,
      scannedAt,
      httpStatus: response.status,
      elapsedMs: Date.now() - started,
      title,
      description,
      h1,
      canonical,
      robots,
      internalLinks: internal.size,
      externalLinks: external.size,
      checks,
      score,
      summary: `${checks.filter(check => check.pass).length} of ${checks.length} homepage checks passed.`,
    };

    const { data: audit, error: saveError } = await context.db
      .from('growth_website_audits')
      .insert({
        organization_id: organizationId,
        website_id: websiteId,
        audit_type: action === 'health' ? 'health' : 'seo',
        score,
        report,
        created_by: context.userId,
      })
      .select('id,score,created_at')
      .single();

    if (saveError) {
      console.error('[growth:website-intelligence] audit save failed', {
        code: saveError.code,
        message: saveError.message,
        organizationId,
        websiteId,
      });
      if (isMissingAuditTable(saveError)) {
        return apiJson({ error: 'Website audit storage is not installed. Apply migration 20261113180052_growth_website_intelligence_v1.sql.' }, 503);
      }
      return apiJson({ error: 'The scan completed, but the audit report could not be saved. Check the database connection and growth website audit permissions.' }, 503);
    }

    return apiJson({ success: true, audit, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Website scan failed.';
    const status = message.includes('larger than the allowed scan limit') ? 413 : 400;
    return apiJson({ error: message }, status);
  }
}

export async function GET(req: NextRequest) {
  const context = await growthContext(req);
  if ('response' in context) return context.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  const websiteId = req.nextUrl.searchParams.get('websiteId') || '';
  if (!await requireGrowthRole(context.db, context.userId, organizationId, ['owner', 'manager', 'editor', 'viewer', 'client'])) {
    return apiJson({ error: 'Workspace permission denied.' }, 403);
  }

  let query = context.db
    .from('growth_website_audits')
    .select('id,website_id,audit_type,score,report,created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (websiteId) query = query.eq('website_id', websiteId);
  const { data, error } = await query;

  if (error) {
    console.error('[growth:website-intelligence] audit history failed', {
      code: error.code,
      message: error.message,
      organizationId,
      websiteId,
    });
    if (isMissingAuditTable(error)) {
      return apiJson({ error: 'Website audit storage is not installed. Apply migration 20261113180052_growth_website_intelligence_v1.sql.' }, 503);
    }
    return apiJson({ error: 'Website audit history could not be loaded. Check the database connection and growth website audit permissions.' }, 503);
  }
  return apiJson({ audits: data || [] });
}
