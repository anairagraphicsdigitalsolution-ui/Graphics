/* Anaira Growth first-party tracker v1.0.0. No analytics events are sent until visitor consent is enabled. */
(() => {
  if (window.__anairaGrowthLoaded) return;
  window.__anairaGrowthLoaded = true;
  const script = document.currentScript;
  const websiteId = script?.getAttribute('data-website-id') || '';
  const publicKey = script?.getAttribute('data-public-key') || '';
  const apiBase = (script?.getAttribute('data-api-base') || 'https://YOUR-ANAIRA-DOMAIN').replace(/\/$/, '');
  if (!websiteId || !publicKey || apiBase.includes('YOUR-ANAIRA-DOMAIN')) return;
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    sessionGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    sessionSet(k, v) { try { sessionStorage.setItem(k, v); } catch {} }
  };
  const id = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const visitorKey = `anaira-growth-visitor-${websiteId}`;
  const sessionKey = `anaira-growth-session-${websiteId}`;
  const visitorId = storage.get(visitorKey) || id();
  const sessionId = storage.sessionGet(sessionKey) || id();
  storage.set(visitorKey, visitorId); storage.sessionSet(sessionKey, sessionId);
  const params = new URLSearchParams(location.search);
  const attribution = {};
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','gbraid','wbraid'].forEach(k => {
    const current = params.get(k);
    const saved = storage.get(`anaira-growth-${websiteId}-${k}`);
    if (current) storage.set(`anaira-growth-${websiteId}-${k}`, current);
    attribution[k] = current || saved || '';
  });
  const send = (eventName, eventData = {}) => {
    if (storage.get(`anaira-growth-consent-${websiteId}`) !== 'granted') return Promise.resolve(false);
    const payload = { publicKey, websiteId, eventId: id(), visitorId, sessionId, eventName, pageUrl: location.href.slice(0,1000), referrer: document.referrer.slice(0,1000), attribution, eventData };
    return fetch(`${apiBase}/api/growth/website-events`, { method:'POST', mode:'cors', headers:{'Content-Type':'text/plain;charset=UTF-8'}, body:JSON.stringify(payload), keepalive:true }).then(r=>r.ok).catch(()=>false);
  };
  window.anairaGrowth = window.anairaGrowth || {};
  window.anairaGrowth.setConsent = (granted) => {
    storage.set(`anaira-growth-consent-${websiteId}`, granted ? 'granted' : 'denied');
    if (granted) send('page_view');
  };
  window.anairaGrowth.setAdUserDataConsent = (granted) => storage.set(`anaira-growth-ad-consent-${websiteId}`, granted ? 'granted' : 'denied');
  window.anairaGrowth.track = (name, data) => {
    if (['conversion','chat_open'].includes(name)) return send(name, data || {});
    return Promise.resolve(false);
  };
  if (storage.get(`anaira-growth-consent-${websiteId}`) === 'granted') send('page_view');
  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args) => { originalPushState(...args); send('page_view'); };
  window.addEventListener('popstate', () => send('page_view'));
  document.addEventListener('focusin', event => {
    const form = event.target?.closest?.('form[data-anaira-form]');
    if (form && !form.dataset.anairaStarted) { form.dataset.anairaStarted='1'; send('form_start',{form_key:form.getAttribute('data-anaira-form')||'default'}); }
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches('form[data-anaira-capture]')) return;
    event.preventDefault();
    const get = (...names) => { for (const name of names) { const el=form.querySelector(`[name="${name}"]`); if(el?.value) return String(el.value).trim(); } return ''; };
    const consentEl=form.querySelector('[name="consent"]');
    const payload={publicKey,websiteId,submissionId:id(),name:get('name','full_name'),email:get('email'),phone:get('phone','mobile'),requirement:get('requirement','message','message_text'),formKey:form.getAttribute('data-anaira-form')||'default',visitorId,pageUrl:location.href.slice(0,1000),consent:!!consentEl?.checked,adUserDataConsent:storage.get(`anaira-growth-ad-consent-${websiteId}`)==='granted',attribution};
    const submit=form.querySelector('[type="submit"]'); if(submit) submit.disabled=true;
    fetch(`${apiBase}/api/growth/website-form`,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)}).then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Enquiry could not be submitted.');form.dispatchEvent(new CustomEvent('anaira:submitted',{detail:data}));send('form_submit',{form_key:payload.formKey});if(data.success)send('conversion',{form_key:payload.formKey});form.reset();}).catch(error=>form.dispatchEvent(new CustomEvent('anaira:error',{detail:{message:error.message}}))).finally(()=>{if(submit)submit.disabled=false;});
  });
})();
