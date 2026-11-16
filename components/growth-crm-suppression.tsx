'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
type Channel = 'email' | 'whatsapp' | 'sms' | 'voice';
type Entry = { suppressed?: boolean; reason?: string | null; updated_at?: string; updated_by?: string };
const channels: Channel[] = ['email','whatsapp','sms','voice'];
export default function GrowthCRMSuppression({ organizationId, leadId }: { organizationId: string; leadId: string }) {
  const [items,setItems] = useState<Record<string,Entry>>({}), [reason,setReason] = useState(''), [busy,setBusy] = useState(false), [notice,setNotice] = useState('');
  const token = useCallback(async () => { if (!supabase) return ''; const {data:{session}} = await supabase.auth.getSession(); return session?.access_token || ''; }, []);
  const load = useCallback(async () => { const response = await fetch(`/api/growth/lead-suppression?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}`,{headers:{Authorization:`Bearer ${await token()}`},cache:'no-store'}); const data=await response.json(); if(!response.ok) throw new Error(data.error||'Suppression status unavailable.'); setItems(data.suppressions||{}); },[organizationId,leadId,token]);
  useEffect(()=>{load().catch(e=>setNotice(e instanceof Error?e.message:'Suppression status unavailable.'));},[load]);
  async function update(channel:Channel,suppressed:boolean){setBusy(true);setNotice('');try{const response=await fetch('/api/growth/lead-suppression',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await token()}`},body:JSON.stringify({organizationId,leadId,channel,suppressed,reason})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Suppression update failed.');setNotice(`${channel.toUpperCase()} ${suppressed?'suppression enabled':'suppression lifted'}.`);setReason('');await load();}catch(e){setNotice(e instanceof Error?e.message:'Suppression update failed.');}finally{setBusy(false);}}
  return <div className="growth-note"><b>Per-channel contact suppression</b><p>Suppression overrides consent. Use it for customer requests, invalid destinations, complaints or internal do-not-contact decisions. Only workspace owners and managers can change it.</p>
    <label>Reason for adding suppression<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="e.g. Customer requested no WhatsApp messages"/></label>
    {channels.map(channel=>{const entry=items[channel]||{};return <div className="growth-inline-controls" key={channel} style={{alignItems:'center',justifyContent:'space-between'}}><span><b>{channel.toUpperCase()}</b> · {entry.suppressed?'Suppressed':'Not suppressed'}{entry.suppressed&&entry.reason?<small>{entry.reason}</small>:null}</span>{entry.suppressed?<button type="button" className="btn btn-small" disabled={busy} onClick={()=>update(channel,false)}>Lift suppression</button>:<button type="button" className="btn btn-small" disabled={busy||reason.trim().length<3} onClick={()=>update(channel,true)}>Suppress channel</button>}</div>;})}
    {notice&&<p className="notice" role="status">{notice}</p>}
  </div>;
}
