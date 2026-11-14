'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Workspace = { organization_id: string; role: string };
type Lead = { id: string; name: string; phone: string };
type Permission = { id: string; lead_id: string; recipient_phone: string; is_permanent: boolean; expires_at: string | null; requested_at: string };
export default function WhatsAppCallingPage() {
  const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
  const [organizationId,setOrganizationId]=useState('');
  const [leads,setLeads]=useState<Lead[]>([]);
  const [leadId,setLeadId]=useState('');
  const [permissions,setPermissions]=useState<Permission[]>([]);
  const [permissionId,setPermissionId]=useState('');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('Loading workspace access…');
  const [callState,setCallState]=useState<'idle'|'connecting'|'ringing'|'connected'>('idle');
  const [sessionId,setSessionId]=useState('');
  const [callId,setCallId]=useState('');
  const peer=useRef<RTCPeerConnection|null>(null);
  const callTimeout=useRef<number|null>(null);
  const localStream=useRef<MediaStream|null>(null);
  const remoteAudio=useRef<HTMLAudioElement|null>(null);
  useEffect(()=>{
    let live=true;
    (async()=>{
      if(!supabase){setStatus('Supabase client is not configured.');return;}
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){setStatus('Please sign in to your Growth workspace.');return;}
      const {data,error}=await supabase.from('growth_members').select('organization_id,role').eq('user_id',user.id);
      if(!live)return;
      if(error){setStatus('Could not load workspace membership.');return;}
      const allowed=(data||[]).filter((x:any)=>['owner','manager'].includes(String(x.role))).map((x:any)=>({organization_id:String(x.organization_id),role:String(x.role)}));
      setWorkspaces(allowed);setOrganizationId(allowed[0]?.organization_id||'');
      setStatus(allowed.length?'Choose a lead with active WhatsApp call permission.':'Workspace owner or manager access is required.');
    })();
    return()=>{live=false;};
  },[]);
  useEffect(()=>{
    let live=true;
    (async()=>{
      if(!supabase||!organizationId){setLeads([]);setPermissions([]);return;}
      const [{data:leadRows,error:leadError},{data:permissionRows,error:permissionError}]=await Promise.all([
        supabase.from('growth_leads').select('id,name,phone').eq('organization_id',organizationId).not('phone','is',null).order('created_at',{ascending:false}).limit(300),
        supabase.from('growth_whatsapp_call_permissions').select('id,lead_id,recipient_phone,is_permanent,expires_at,requested_at').eq('organization_id',organizationId).eq('permission_status','granted').order('requested_at',{ascending:false}).limit(300)
      ]);
      if(!live)return;
      if(leadError||permissionError){setStatus('Could not load leads or call permissions. Apply the latest calling migration and check workspace access.');return;}
      setLeads(leadRows||[]);setPermissions((permissionRows||[]).filter((p:any)=>p.is_permanent||(p.expires_at&&Date.parse(p.expires_at)>Date.now())));
      setLeadId('');setPermissionId('');
      setStatus('Only current customer-granted call permissions are eligible.');
    })();
    return()=>{live=false;};
  },[organizationId]);
  const availablePermissions=permissions.filter(p=>p.lead_id===leadId);
  useEffect(()=>{setPermissionId(availablePermissions[0]?.id||'');},[leadId,organizationId]);
  const cleanup=()=>{
    if(callTimeout.current!==null){window.clearTimeout(callTimeout.current);callTimeout.current=null;}
    peer.current?.close();peer.current=null;
    localStream.current?.getTracks().forEach(t=>t.stop());localStream.current=null;
    if(remoteAudio.current)remoteAudio.current.srcObject=null;
  };
  const startCall=async()=>{
    if(!supabase||!organizationId||!leadId||!permissionId){setStatus('Select a lead and a current granted calling permission first.');return;}
    setBusy(true);setCallState('connecting');setStatus('Requesting microphone and preparing secure WebRTC session…');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      localStream.current=stream;
      const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
      peer.current=pc;
      stream.getTracks().forEach(track=>pc.addTrack(track,stream));
      pc.ontrack=(event)=>{if(remoteAudio.current)remoteAudio.current.srcObject=event.streams[0];};
      pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected'){if(callTimeout.current!==null){window.clearTimeout(callTimeout.current);callTimeout.current=null;}setCallState('connected');setStatus('WhatsApp call connected.');}else if(['failed','disconnected'].includes(pc.connectionState)){setStatus('Media connection interrupted. End the call and retry after checking network/TURN configuration.');}};
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);
      if(pc.iceGatheringState!=='complete')await new Promise<void>((resolve)=>{const timeout=window.setTimeout(resolve,10000);const done=()=>{if(pc.iceGatheringState==='complete'){window.clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',done);resolve();}};pc.addEventListener('icegatheringstatechange',done);});
      const response=await fetch('/api/growth/whatsapp/calling/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,leadId,permissionId,action:'connect',sdp:pc.localDescription?.sdp||''})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'WhatsApp call could not be started.');
      setSessionId(data.sessionId);setCallId(data.callId);setCallState('ringing');setStatus('Calling through WhatsApp…');
      try{await pc.setRemoteDescription({type:'answer',sdp:data.answerSdp});}
      catch(remoteError){
        await fetch('/api/growth/whatsapp/calling/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,leadId,sessionId:data.sessionId,action:'terminate'})}).catch(()=>null);
        throw remoteError;
      }
      callTimeout.current=window.setTimeout(async()=>{
        if(peer.current&&peer.current.connectionState!=='connected'){
          await fetch('/api/growth/whatsapp/calling/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,leadId,sessionId:data.sessionId,action:'terminate'})}).catch(()=>null);
          cleanup();setCallState('idle');setSessionId('');setCallId('');setStatus('No media connection was established within 45 seconds. The call was ended; check Meta calling setup and TURN/network configuration.');
        }
      },45000);
    }catch(error){cleanup();setCallState('idle');setSessionId('');setCallId('');setStatus(error instanceof Error?error.message:'Unable to start WhatsApp call.');}
    finally{setBusy(false);}
  };
  const endCall=async()=>{
    setBusy(true);
    try{
      if(sessionId&&organizationId&&leadId){
        const response=await fetch('/api/growth/whatsapp/calling/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,leadId,sessionId,action:'terminate'})});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Provider could not terminate the call.');
      }
      setStatus('Call ended.');setCallState('idle');setSessionId('');setCallId('');
    }catch(error){setStatus(error instanceof Error?error.message:'Call termination failed.');}
    finally{cleanup();setBusy(false);}
  };
  useEffect(()=>()=>cleanup(),[]);
  const inputStyle={width:'100%',padding:'12px 14px',border:'1px solid #d8d2c2',borderRadius:10,background:'#fffdf7',color:'#183b2c'};
  return <main style={{maxWidth:1050,margin:'0 auto',padding:'32px 20px 100px',color:'#183b2c'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}><span style={{fontSize:28}}>◉</span><div><div style={{fontSize:12,letterSpacing:2,color:'#9b7b37',fontWeight:700}}>ANAIRA AI GROWTH ENGINE</div><h1 style={{fontSize:30,margin:'3px 0'}}>WhatsApp Business Calling</h1></div></div>
    <p style={{color:'#617166',maxWidth:760,lineHeight:1.6}}>Native Meta Calling API with browser WebRTC audio. Calls can only be placed after the customer has explicitly granted a current WhatsApp call permission.</p>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16,marginTop:24}}>
      <label style={{fontWeight:650,fontSize:13}}>Workspace<select style={{...inputStyle,display:'block',marginTop:8}} value={organizationId} onChange={e=>setOrganizationId(e.target.value)}>{workspaces.map(w=><option key={w.organization_id} value={w.organization_id}>{w.organization_id}</option>)}</select></label>
      <label style={{fontWeight:650,fontSize:13}}>Lead<select style={{...inputStyle,display:'block',marginTop:8}} value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Select lead</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name||l.phone} — {l.phone}</option>)}</select></label>
      <label style={{fontWeight:650,fontSize:13}}>Customer call permission<select style={{...inputStyle,display:'block',marginTop:8}} value={permissionId} onChange={e=>setPermissionId(e.target.value)}><option value="">No active permission</option>{availablePermissions.map(p=><option key={p.id} value={p.id}>{p.is_permanent?'Permanent permission':`Expires ${new Date(p.expires_at!).toLocaleString()}`} · ${p.recipient_phone}</option>)}</select></label>
    </section>
    <section style={{marginTop:22,padding:22,border:'1px solid #d9d2c2',borderRadius:16,background:'#f8f5eb'}}>
      <div style={{fontSize:12,fontWeight:700,letterSpacing:1,color:'#8b7137'}}>CALL STATUS</div><div style={{fontSize:22,fontWeight:750,margin:'8px 0'}}>{callState==='idle'?'Ready':callState==='connecting'?'Preparing media…':callState==='ringing'?'Ringing on WhatsApp…':'Connected'}</div>
      <p style={{margin:'0 0 18px',color:'#59695f',lineHeight:1.5}}>{status}</p>
      <audio ref={remoteAudio} autoPlay playsInline/>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button disabled={busy||callState!=='idle'||!leadId||!permissionId} onClick={startCall} style={{border:0,borderRadius:10,padding:'12px 20px',fontWeight:700,color:'#fff',background:'#1f5a3f',opacity:busy?0.6:1,cursor:'pointer'}}>Start WhatsApp Call</button>
        <button disabled={busy||callState==='idle'} onClick={endCall} style={{border:'1px solid #a33',borderRadius:10,padding:'12px 20px',fontWeight:700,color:'#9a2929',background:'#fff'}}>End Call</button>
      </div>
      {callId&&<p style={{fontSize:11,color:'#7a827a',marginTop:14,overflowWrap:'anywhere'}}>Meta Call ID: {callId}</p>}
    </section>
    <section style={{marginTop:20,padding:18,border:'1px solid #eadfbe',borderRadius:14,background:'#fffdf7',fontSize:13,lineHeight:1.6,color:'#625a48'}}>
      <b>Before production use</b><ul style={{margin:'8px 0 0',paddingLeft:20}}><li>Enable WhatsApp Business Calling for the connected number in Meta.</li><li>Request and receive the customer’s call permission first; outbound calling without granted permission is blocked.</li><li>Use HTTPS, allow microphone access, and configure production STUN/TURN connectivity for restrictive networks.</li><li>Meta app review, number eligibility and live call testing are required. This page currently initiates outbound calls; inbound call answering is not enabled.</li></ul>
    </section>
  </main>;
}
