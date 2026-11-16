'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import GrowthInbox from '@/components/growth-inbox';
import GrowthWhatsAppConnection from '@/components/growth-whatsapp-connection';
import GrowthWhatsAppTemplates from '@/components/growth-whatsapp-templates';
import { GrowthEmailTemplateManager, GrowthEmailDeliveryEvents } from '@/components/growth-email-center-tools';

type Lead = { id: string; name: string; phone: string; channel_consents: any; channel_suppressions: any; consent_to_contact: boolean; contact_opted_out_at: string | null };
type Sms = { id: string; to_phone: string; body: string; status: string; provider_status: string | null; error_message: string | null; created_at: string };
export default function GrowthCommunicationCenter() {
 const [organizationId,setOrganizationId]=useState(''),[leads,setLeads]=useState<Lead[]>([]),[messages,setMessages]=useState<Sms[]>([]),[leadId,setLeadId]=useState(''),[message,setMessage]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 async function token(){const {data:{session}}=await supabase!.auth.getSession();return session?.access_token||'';}
 async function load(org:string){if(!supabase||!org)return;const t=await token();const [leadRows,smsResponse]=await Promise.all([supabase.from('growth_leads').select('id,name,phone,channel_consents,channel_suppressions,consent_to_contact,contact_opted_out_at').eq('organization_id',org).not('phone','is',null).order('created_at',{ascending:false}).limit(300),fetch(`/api/growth/sms?organizationId=${encodeURIComponent(org)}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'})]);setLeads((leadRows.data||[]) as Lead[]);const data=await smsResponse.json().catch(()=>({}));if(smsResponse.ok)setMessages(data.messages||[]);else setNotice(data.error||'Unable to load SMS history.');}
 useEffect(()=>{let active=true;const org=window.localStorage.getItem('anaira-growth-active-org')||'';if(active){setOrganizationId(org);setLoading(false);if(org)load(org);}return()=>{active=false;};},[]);
 async function send(e:React.FormEvent){e.preventDefault();if(!organizationId||!leadId||!message.trim())return;setBusy(true);setNotice('');const t=await token();const requestId=globalThis.crypto?.randomUUID?.()||`sms-${Date.now()}-${Math.random().toString(36).slice(2)}`;const response=await fetch('/api/growth/sms',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({organizationId,leadId,message:message.trim(),clientRequestId:requestId})});const data=await response.json().catch(()=>({}));setBusy(false);if(!response.ok){setNotice(data.error||'Unable to queue SMS.');return;}setNotice(data.duplicate?'This SMS request was already queued.':'SMS queued. Provider delivery status will update from Twilio callbacks.');setMessage('');await load(organizationId);}
 const eligible=leads.filter(l=>l.phone&&l.consent_to_contact&&!l.contact_opted_out_at&&l.channel_consents?.sms?.granted===true&&l.channel_suppressions?.sms?.suppressed!==true);
 if(loading)return <main className="growth-page"><p>Loading Communication Center…</p></main>;
 if(!organizationId)return <main className="growth-page"><section className="growth-note"><h2>Communication Center</h2><p>Select an active workspace from the AI Growth sidebar to open its communication channels.</p></section></main>;
 return <main className="growth-page" style={{maxWidth:1440,margin:'0 auto',padding:'24px 18px'}}>
  <header className="growth-page-header"><div><p className="growth-eyebrow">ANAIRA AI GROWTH ENGINE · MODULE 10</p><h1>WhatsApp & Email Center</h1><p>One workspace for customer conversations, email, WhatsApp and SMS dispatch. Provider delivery is reported separately from provider acceptance.</p></div><a className="btn btn-secondary" href="/admin/ai-growth/integrations">Manage integrations</a></header>
  {notice&&<p className="notice" role="status">{notice}</p>}
  <section className="growth-note" style={{marginTop:20}}><h2>SMS Composer</h2><p>SMS sends are queued through the worker. Only contacts with recorded SMS-specific consent and no active suppression are eligible.</p><form className="growth-content-form" onSubmit={send}><label>CRM contact<select required value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Choose an SMS-consented contact</option>{eligible.map(l=><option key={l.id} value={l.id}>{l.name} · {l.phone}</option>)}</select></label><label>Message<textarea required rows={3} maxLength={1600} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write your SMS message…"/><small>{message.length}/1600 characters</small></label><button className="btn" disabled={busy||!leadId||!message.trim()}>{busy?'Queueing…':'Queue SMS'}</button></form>{!eligible.length&&<p className="growth-empty">No contacts currently have explicit SMS consent. Record consent in CRM before sending.</p>}</section>
  <section className="growth-note" style={{marginTop:20}}><h2>Recent SMS Delivery</h2>{messages.length?messages.map(m=><article className="growth-row" key={m.id}><div><b>{m.to_phone} · {m.status}</b><small>{new Date(m.created_at).toLocaleString()} · Provider: {m.provider_status||'pending'}</small><p>{m.body}</p>{m.error_message&&<small>{m.error_message}</small>}</div></article>):<p className="growth-empty">No SMS messages recorded for this workspace yet.</p>}</section>
  <GrowthWhatsAppConnection organizationId={organizationId}/>
  <GrowthWhatsAppTemplates organizationId={organizationId}/>
  <GrowthEmailTemplateManager organizationId={organizationId}/>
  <GrowthEmailDeliveryEvents organizationId={organizationId}/>
  <GrowthInbox organizationId={organizationId}/>
  <section className="growth-note"><h2>Email Delivery & Compliance</h2><p>Inbound Resend webhooks, bounce/complaint suppression, delivery events and one-click unsubscribe are handled by the existing email lifecycle. Configure Resend and its webhook in Integrations before using live email.</p><a href="/admin/ai-growth/integrations">Open integration settings →</a></section>
 </main>;
}
