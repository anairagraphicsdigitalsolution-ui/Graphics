'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';

const workspaceItems=[
 ['overview','Overview','/admin/ai-growth/overview','⌂'],['intelligence','Growth Intelligence','/admin/ai-growth/intelligence','✦'],['website-intelligence','Website SEO','/admin/ai-growth/website-intelligence','◎'],['crm','CRM & Leads','/admin/ai-growth/crm','♙'],
 ['marketing','Content Studio','/admin/ai-growth/marketing','▧'],['tasks','Tasks','/admin/ai-growth/tasks','✓'],
 ['campaigns','Campaigns & Ads','/admin/ai-growth/campaigns','↗'],['employee','AI Employee','/admin/ai-growth/employee','✧'],
 ['automation','Automation','/admin/ai-growth/automation','⚙'],['schedules','Autonomous Schedules','/admin/ai-growth/automation/schedules','◷'],['channels','Channels','/admin/ai-growth/channels','⌁'],['calling','WhatsApp Calling','/admin/ai-growth/calling','☎'],
 ['analytics','Analytics','/admin/ai-growth/analytics','▥'],['integrations','Integrations','/admin/ai-growth/integrations','⌘'],['team','Team & Permissions','/admin/ai-growth/team','♧'],
 ['billing','Plan & Usage','/admin/ai-growth/billing','₹']
] as const;
const platformItems=[['platform','Super Admin','/admin/ai-growth/platform','▦'],['platform-billing','Plans & Billing','/admin/ai-growth/platform/billing','₹']] as const;
const mobilePrimary=['overview','intelligence','crm','marketing'];

export default function GrowthPrimaryNav(){
 const pathname=usePathname()||'',router=useRouter();
 const [ready,setReady]=useState(false),[isPlatformAdmin,setIsPlatformAdmin]=useState(false),[memberRole,setMemberRole]=useState(''),[moreOpen,setMoreOpen]=useState(false),[email,setEmail]=useState('');
 useEffect(()=>{
  let active=true;
  async function resolveAccess(){
   if(!supabase){if(active)setReady(true);return;}
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){if(active){setReady(true);setMemberRole('');setIsPlatformAdmin(false);}return;}
   const [{data:admin},{data:members}]=await Promise.all([
    supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle(),
    supabase.from('growth_members').select('role').eq('user_id',user.id)
   ]);
   const roles=(members||[]).map((row:any)=>String(row.role||''));
   const bestRole=['owner','manager','editor','viewer','client'].find(role=>roles.includes(role))||'';
   if(active){setIsPlatformAdmin(Boolean(admin?.user_id));setMemberRole(bestRole);setEmail(user.email||'');setReady(true);}
  }
  resolveAccess();
  if(!supabase)return()=>{active=false;};
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setReady(false);resolveAccess();});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(!moreOpen)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMoreOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[moreOpen]);
 if(!ready)return <aside className="growth-module-nav growth-primary-nav" aria-label="AI Growth navigation" aria-busy="true"/>;
 const isWorkspaceMember=Boolean(memberRole),isWorkspaceManager=['owner','manager'].includes(memberRole);
 const visibleWorkspaceItems=(isWorkspaceManager||isPlatformAdmin)?workspaceItems:workspaceItems.filter(([id])=>!['schedules','integrations','team','billing'].includes(id));
 // Platform owners can always navigate the full workspace; tenant members see only their granted module set.
 const items=[...(isWorkspaceMember||isPlatformAdmin?visibleWorkspaceItems:[]),...(isPlatformAdmin?platformItems:[])];
 const isActive=(href:string)=>pathname===href||pathname.startsWith(href+'/')||(href==='/admin/ai-growth/overview'&&pathname==='/admin/ai-growth');
 const signOut=async()=>{await supabase?.auth.signOut();router.push('/growth-login');router.refresh();};
 const mobileItems=items.filter(([id])=>mobilePrimary.includes(id));
 return <>
  <aside className="growth-module-nav growth-primary-nav" aria-label="AI Growth Engine sidebar">
   <Link className="growth-nav-brand" href="/admin/ai-growth/overview"><span className="growth-nav-mark">A</span><span><b>ANAIRA</b><small>AI GROWTH ENGINE</small></span></Link>
   <div className="growth-nav-caption">WORKSPACE</div>
   <nav className="growth-nav-links">{items.map(([id,label,href,icon])=><Link key={id} href={href} prefetch className={isActive(href)?'active':''}><span className="growth-nav-icon">{icon}</span><span>{label}</span></Link>)}</nav>
   <div className="growth-nav-footer"><div className="growth-nav-user"><span className="growth-nav-avatar">{(email||'U').slice(0,1).toUpperCase()}</span><span><b>{email||'Signed-in user'}</b><small>{isPlatformAdmin?'Platform Admin':memberRole||'No workspace role'}</small></span></div><button type="button" onClick={signOut}>↪ Sign out</button></div>
  </aside>
  <nav className="growth-mobile-nav" aria-label="AI Growth mobile navigation">
   {mobileItems.map(([id,label,href,icon])=><Link key={id} href={href} className={isActive(href)?'active':''}><span>{icon}</span><small>{label==='Growth Intelligence'?'Growth':label==='Content Studio'?'Content':label}</small></Link>)}
   <button type="button" className={moreOpen?'active':''} onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreOpen}><span>☰</span><small>More</small></button>
  </nav>
  {moreOpen&&<><button className="growth-mobile-scrim" aria-label="Close menu" onClick={()=>setMoreOpen(false)}/><section className="growth-mobile-more" aria-label="More Growth modules"><div className="growth-mobile-more-head"><b>All Growth Modules</b><button type="button" onClick={()=>setMoreOpen(false)} aria-label="Close">×</button></div>{items.map(([id,label,href,icon])=><Link key={id} href={href} className={isActive(href)?'active':''} onClick={()=>setMoreOpen(false)}><span>{icon}</span>{label}</Link>)}<button type="button" className="growth-mobile-signout" onClick={signOut}>↪ Sign out</button></section></>}
 </>;
}
