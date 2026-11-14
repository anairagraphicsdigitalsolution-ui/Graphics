'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Website = {
  id: string;
  name: string;
  domain: string | null;
  website_url: string;
  verification_status: string;
};
type Audit = {
  id: string;
  website_id: string;
  audit_type: string;
  score: number;
  report: any;
  created_at: string;
};

export default function GrowthWebsiteIntelligence() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [org, setOrg] = useState('');
  const [sites, setSites] = useState<Website[]>([]);
  const [site, setSite] = useState('');
  const [report, setReport] = useState<any>(null);
  const [history, setHistory] = useState<Audit[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'success' | 'error' | 'info'>('info');

  async function token() {
    if (!supabase) return '';
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }

  async function loadHistory(organizationId: string, websiteId: string) {
    if (!organizationId || !websiteId) {
      setHistory([]);
      setReport(null);
      return;
    }
    setLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/growth/website-intelligence?organizationId=${encodeURIComponent(organizationId)}&websiteId=${encodeURIComponent(websiteId)}`,
        { headers: { Authorization: `Bearer ${await token()}` }, cache: 'no-store' }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Website audit history could not be loaded.');
      const audits: Audit[] = body.audits || [];
      setHistory(audits);
      setReport(audits[0]?.report || null);
    } catch (error) {
      setHistory([]);
      setReport(null);
      setNotice(error instanceof Error ? error.message : 'Website audit history could not be loaded.');
      setNoticeKind('error');
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data: memberships } = await supabase
        .from('growth_members').select('organization_id').eq('user_id', user.id);
      const ids = (memberships || []).map(item => item.organization_id);
      if (!ids.length || !active) return;
      const { data: organizations } = await supabase
        .from('growth_organizations').select('id,name').in('id', ids).order('name');
      if (!active) return;
      setOrgs(organizations || []);
      const saved = localStorage.getItem('anaira-growth-active-org') || '';
      setOrg(ids.includes(saved) ? saved : ids[0]);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!org || !supabase) {
      setSites([]);
      setSite('');
      setHistory([]);
      setReport(null);
      return;
    }
    localStorage.setItem('anaira-growth-active-org', org);
    (async () => {
      const { data, error } = await supabase
        .from('growth_websites')
        .select('id,name,domain,website_url,verification_status')
        .eq('organization_id', org)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error) {
        setNotice('Websites could not be loaded. Check your workspace access.');
        setNoticeKind('error');
        return;
      }
      const available = (data || []) as Website[];
      setSites(available);
      setSite(current => available.some(item => item.id === current) ? current : (available[0]?.id || ''));
    })();
    return () => { active = false; };
  }, [org]);

  useEffect(() => {
    if (org && site) loadHistory(org, site);
    else {
      setHistory([]);
      setReport(null);
    }
  }, [org, site]);

  async function scan(action = 'scan') {
    if (!site || !org || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/growth/website-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ organizationId: org, websiteId: site, action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Website scan failed.');
      setReport(body.report);
      setNotice(body.report.summary || 'Website audit completed and saved.');
      setNoticeKind('success');
      await loadHistory(org, site);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Scan failed.');
      setNoticeKind('error');
    } finally {
      setBusy(false);
    }
  }

  const selectedSite = sites.find(item => item.id === site);
  return (
    <main className="growth-admin">
      <header className="growth-head">
        <div>
          <div className="eyebrow">WEBSITE PERFORMANCE</div>
          <h1>Website Growth Intelligence</h1>
          <p>SEO health, page metadata, indexability and website checks in one place.</p>
        </div>
      </header>

      <section className="growth-panel">
        <div className="growth-panel-head">
          <h2>Choose website</h2>
          <select aria-label="Workspace" value={org} onChange={event => setOrg(event.target.value)}>
            {orgs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <select
          aria-label="Website"
          value={site}
          onChange={event => {
            setSite(event.target.value);
            setNotice('');
          }}
        >
          {sites.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.domain || item.website_url}
            </option>
          ))}
        </select>
        <div className="growth-inline-controls">
          <button
            className="btn"
            disabled={busy || !site || selectedSite?.verification_status !== 'verified'}
            onClick={() => scan()}
          >
            {busy ? 'Scanning…' : 'Run SEO & health scan'}
          </button>
          <span>
            {selectedSite?.verification_status === 'verified' ? 'Verified website' : 'Verify website ownership first'}
          </span>
        </div>
        {notice && (
          <p role="status" className={`notice ${noticeKind === 'error' ? 'notice-error' : noticeKind === 'success' ? 'notice-success' : ''}`}>
            {notice}
          </p>
        )}
      </section>

      {report && (
        <section className="growth-panel">
          <div className="growth-panel-head">
            <div>
              <h2>Website audit</h2>
              <p>{report.domain} · {new Date(report.scannedAt).toLocaleString()}</p>
            </div>
            <strong style={{ fontSize: 32 }}>{report.score}/100</strong>
          </div>
          <div className="growth-stats">
            <div><strong>{report.internalLinks}</strong><span>Internal links</span></div>
            <div><strong>{report.externalLinks}</strong><span>External links</span></div>
            <div><strong>{report.httpStatus}</strong><span>HTTP status</span></div>
            <div><strong>{report.elapsedMs} ms</strong><span>Response time</span></div>
          </div>
          <h3>SEO checks</h3>
          {(report.checks || []).map((item: any) => (
            <article className="growth-row" key={item.key}>
              <div><b>{item.label}</b><small>{item.detail}</small></div>
              <strong style={{ color: item.pass ? '#237044' : '#a33e32' }}>
                {item.pass ? 'Passed' : 'Needs attention'}
              </strong>
            </article>
          ))}
          <h3>Page details</h3>
          <p><b>Title:</b> {report.title || 'Missing'}</p>
          <p><b>Description:</b> {report.description || 'Missing'}</p>
          <p><b>H1:</b> {report.h1?.join(' · ') || 'Missing'}</p>
          <p><b>Canonical:</b> {report.canonical || 'Not found'}</p>
        </section>
      )}

      <section className="growth-panel">
        <div className="growth-panel-head">
          <h2>Previous scans</h2>
          {loadingHistory && <span>Loading history…</span>}
        </div>
        {history.map(item => (
          <button
            type="button"
            className="growth-row"
            key={item.id}
            onClick={() => setReport(item.report)}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 0 }}
          >
            <b>{item.audit_type === 'seo' ? 'SEO & health scan' : 'Website scan'} · {item.score}/100</b>
            <small>{new Date(item.created_at).toLocaleString()}</small>
          </button>
        ))}
        {!history.length && !loadingHistory && (
          <p>No saved scans for this website yet. Run your first website audit.</p>
        )}
      </section>
    </main>
  );
}
