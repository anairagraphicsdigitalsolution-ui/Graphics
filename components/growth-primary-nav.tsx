'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {
  Activity,BarChart3,Building2,CalendarClock,ChartNoAxesCombined,ChevronDown,
  Command,Contact,FileText,Globe2,Headphones,LayoutDashboard,LogOut,
  Megaphone,MessageCircle,MoreHorizontal,Phone,Plug,Search,Settings2,ShieldCheck,
  Sparkles,Star,Users,Wallet,Workflow, X, Zap, type LucideIcon
} from 'lucide-react';
import {supabase} from '@/lib/supabase';

type NavItem={id:string;label:string;href:string;icon:LucideIcon};
type NavGroup={label:string;items:NavItem[]};
const workspaceGroups:NavGroup[]=[
 {label:'COMMAND',items:[
  {id:'control-center',label:'AI Command Center',href:'/admin/ai-growth',icon:Command},
  {id:'overview',label:'Business Overview',href:'/admin/ai-growth/overview',icon:LayoutDashboard},
 ]},
 {label:'INTELLIGENCE',items:[
  {id:'intelligence',label:'Growth Intelligence',href:'/admin/ai-growth/intelligence',icon:Sparkles},
  {id:'website-intelligence',label:'Website Intelligence',href:'/admin/ai-growth/website-intelligence',icon:Globe2},
 ]},
 {label:'SALES & CUSTOMER',items:[
  {id:'crm',label:'CRM & Leads',href:'/admin/ai-growth/crm',icon:Contact},
  {id:'tasks',label:'Tasks & Follow-ups',href:'/admin/ai-growth/tasks',icon:CalendarClock},
  {id:'communications',label:'Communication Center',href:'/admin/ai-growth/communications',icon:MessageCircle},
  {id:'employee',label:'AI Employee',href:'/admin/ai-growth/employee',icon:Headphones},
  {id:'calling',label:'WhatsApp Calling',href:'/admin/ai-growth/calling',icon:Phone},
 ]},
 {label:'MARKETING & CHANNELS',items:[
  {id:'marketing',label:'Content Studio',href:'/admin/ai-growth/marketing',icon:FileText},
  {id:'social',label:'Social Media',href:'/admin/ai-growth/social',icon:Activity},
  {id:'campaigns',label:'Campaigns & Ads',href:'/admin/ai-growth/campaigns',icon:Megaphone},
  {id:'ads-autopilot',label:'Ads Autopilot',href:'/admin/ai-growth/ads-autopilot',icon:Zap},
  {id:'google-ads',label:'Google Ads',href:'/admin/ai-growth/google-ads',icon:ChartNoAxesCombined},
  {id:'reviews',label:'AI Reviews',href:'/admin/ai-growth/reviews',icon:Star},
  {id:'channels',label:'Connected Channels',href:'/admin/ai-growth/channels',icon:Plug},
 ]},
 {label:'AUTOMATION',items:[
  {id:'automation',label:'Automation Workflows',href:'/admin/ai-growth/automation',icon:Workflow},
  {id:'schedules',label:'Autonomous Schedules',href:'/admin/ai-growth/automation/schedules',icon:CalendarClock},
 ]},
 {label:'ANALYTICS',items:[
  {id:'analytics',label:'Analytics & Reports',href:'/admin/ai-growth/analytics',icon:BarChart3},
 ]},
 {label:'WORKSPACE',items:[
  {id:'integrations',label:'Integrations & API',href:'/admin/ai-growth/integrations',icon:Settings2},
  {id:'team',label:'Team & Permissions',href:'/admin/ai-growth/team',icon:Users},
  {id:'billing',label:'Plan & Usage',href:'/admin/ai-growth/billing',icon:Wallet},
 ]},
];
const platformItems:NavItem[]=[
 {id:'platform',label:'Platform Control',href:'/admin/ai-growth/platform',icon:Building2},
 {id:'platform-billing',label:'Plans & Billing',href:'/admin/ai-growth/platform/billing',icon:Wallet},
];
const pageNames:[string,string,string][]=[
 ['/admin/ai-growth/automation/schedules','AUTOMATION','Autonomous Schedules'],
 ['/admin/ai-growth/platform/billing','PLATFORM','Plans & Billing'],
 ['/admin/ai-growth/website-intelligence','INTELLIGENCE','Website Intelligence'],
 ['/admin/ai-growth/communications','SALES & CUSTOMER','Communication Center'],
 ['/admin/ai-growth/ads-autopilot','MARKETING','Ads Autopilot'],
 ['/admin/ai-growth/google-ads','MARKETING','Google Ads'],
 ['/admin/ai-growth/analytics','ANALYTICS','Analytics & Reports'],
 ['/admin/ai-growth/integrations','WORKSPACE','Integrations & API'],
 ['/admin/ai-growth/overview','COMMAND','Business Overview'],
 ['/admin/ai-growth/intelligence','INTELLIGENCE','Growth Intelligence'],
 ['/admin/ai-growth/campaigns','MARKETING','Campaigns & Ads'],
 ['/admin/ai-growth/marketing','MARKETING','Content Studio'],
 ['/admin/ai-growth/social','MARKETING','Social Media'],
 ['/admin/ai-growth/reviews','MARKETING','AI Reviews'],
 ['/admin/ai-growth/tasks','SALES & CUSTOMER','Tasks & Follow-ups'],
 ['/admin/ai-growth/crm/reports','SALES & CUSTOMER','CRM Reports'],
 ['/admin/ai-growth/crm','SALES & CUSTOMER','CRM & Leads'],
 ['/admin/ai-growth/employee','SALES & CUSTOMER','AI Employee'],
 ['/admin/ai-growth/calling','SALES & CUSTOMER','WhatsApp Calling'],
 ['/admin/ai-growth/channels','MARKETING','Connected Channels'],
 ['/admin/ai-growth/automation','AUTOMATION','Automation Workflows'],
 ['/admin/ai-growth/team','WORKSPACE','Team & Permissions'],
 ['/admin/ai-growth/billing','WORKSPACE','Plan & Usage'],
 ['/admin/ai-growth/platform','PLATFORM','Platform Control'],
 ['/admin/ai-growth','COMMAND','AI Command Center'],
];
const mobilePrimary=['overview','intelligence','crm','marketing'];

export default function GrowthPrimaryNav(){
 const pathname=usePathname()||'',router=useRouter();
 const [ready,setReady]=useState(false),[isPlatformAdmin,setIsPlatformAdmin]=useState(false),[memberRole,setMemberRole]=useState(''),[moreOpen,setMoreOpen]=useState(false),[email,setEmail]=useState('');
 const [workspaces,setWorkspaces]=useState<Array<{id:string;name:string;status:string;role:string}>>([]),[activeWorkspace,setActiveWorkspace]=useState(''),[filter,setFilter]=useState('');
 useEffect(()=>{
  let active=true;
  async function resolveAccess(){
   if(!supabase){if(active)setReady(true);return;}
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){if(active){setReady(true);setMemberRole('');setIsPlatformAdmin(false);setWorkspaces([]);setActiveWorkspace('');}return;}
   const [{data:admin},{data:members}]=await Promise.all([
    supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle(),
    supabase.from('growth_members').select('organization_id,role').eq('user_id',user.id)
   ]);
   const platformAdmin=Boolean(admin?.user_id);
   const memberRows=(members||[]) as Array<{organization_id:string;role:string}>;
   const orgIds=[...new Set(memberRows.map(row=>row.organization_id).filter(Boolean))];
   let orgQuery=supabase.from('growth_organizations').select('id,name,status').order('name');
   if(!platformAdmin){
    if(!orgIds.length){if(active){setIsPlatformAdmin(false);setMemberRole('');setWorkspaces([]);setActiveWorkspace('');setEmail(user.email||'');setReady(true);}return;}
    orgQuery=orgQuery.in('id',orgIds) as any;
   }
   const {data:orgRows}=await orgQuery;
   const roleByOrg=new Map(memberRows.map(row=>[row.organization_id,String(row.role||'')]));
   const available=(orgRows||[]).filter((org:any)=>org.status==='active').map((org:any)=>({id:org.id,name:org.name,status:org.status,role:platformAdmin?'platform_admin':(roleByOrg.get(org.id)||'')})).filter((org:any)=>platformAdmin||Boolean(org.role));
   const saved=typeof window!=='undefined'?window.localStorage.getItem('anaira-growth-active-org')||'':'';
   const chosen=available.some((org:any)=>org.id===saved)?saved:(available[0]?.id||'');
   const selected=available.find((org:any)=>org.id===chosen);
   if(active){setIsPlatformAdmin(platformAdmin);setWorkspaces(available);setActiveWorkspace(chosen);setMemberRole(selected?.role||'');setEmail(user.email||'');setReady(true);}
  }
  void resolveAccess();
  if(!supabase)return()=>{active=false;};
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setReady(false);void resolveAccess();});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 const switchWorkspace=(next:string)=>{
  if(!workspaces.some(workspace=>workspace.id===next))return;
  window.localStorage.setItem('anaira-growth-active-org',next);
  setActiveWorkspace(next);
  window.location.assign(pathname||'/admin/ai-growth/overview');
 };
 useEffect(()=>{if(!moreOpen)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMoreOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[moreOpen]);
 const isWorkspaceMember=Boolean(activeWorkspace&&memberRole);
 const isWorkspaceManager=['owner','manager','platform_admin'].includes(memberRole);
 const visibleGroups=useMemo(()=>{
  if(!isWorkspaceMember&&!isPlatformAdmin)return [];
  const base=(isWorkspaceManager||isPlatformAdmin)?workspaceGroups:workspaceGroups.map(group=>({...group,items:group.items.filter(item=>!['control-center','schedules','integrations','team','billing'].includes(item.id))}));
  const q=filter.trim().toLowerCase();
  return base.map(group=>({...group,items:group.items.filter(item=>!q||item.label.toLowerCase().includes(q)||group.label.toLowerCase().includes(q))})).filter(group=>group.items.length>0);
 },[filter,isWorkspaceManager,isPlatformAdmin,isWorkspaceMember]);
 const visibleWorkspaceItems=visibleGroups.flatMap(group=>group.items);
 // Workspace billing ['billing','Plan & Usage'] remains workspace-only; platformItems stay isolated.
 const items=[...(isWorkspaceMember||isPlatformAdmin?visibleWorkspaceItems:[]),...(isPlatformAdmin?platformItems:[])];
 const groups=[...visibleGroups,...(isPlatformAdmin?[{label:'PLATFORM ADMIN',items:platformItems.filter(item=>!filter||item.label.toLowerCase().includes(filter.toLowerCase()))}].filter(group=>group.items.length):[])];
 const isActive=(href:string)=>href==='/admin/ai-growth'?pathname===href:pathname===href||pathname.startsWith(href+'/');
 const activePage=pageNames.find(([href])=>href===pathname)||pageNames.find(([href])=>pathname.startsWith(href+'/'))||pageNames[pageNames.length-1];
 const activeWorkspaceName=workspaces.find(workspace=>workspace.id===activeWorkspace)?.name||'Select workspace';
 const signOut=async()=>{await supabase?.auth.signOut();router.push('/growth-login');router.refresh();};
 const mobileItems=items.filter(item=>mobilePrimary.includes(item.id));
 if(!ready)return <><aside className="growth-module-nav growth-primary-nav" aria-label="AI Growth navigation" aria-busy="true"/><div className="growth-workspace-topbar skeleton"/></>;
 return <>
  <aside className="growth-module-nav growth-primary-nav" aria-label="AI Growth Engine sidebar">
   <Link className="growth-nav-brand" href="/admin/ai-growth/overview" aria-label="Anaira AI Growth Engine home"><span className="growth-nav-mark">A</span><span className="growth-nav-brand-copy"><b>ANAIRA</b><small>AI GROWTH ENGINE</small></span><span className="growth-nav-brand-version">PRO</span></Link>
   <div className="growth-nav-workspace-switcher"><label htmlFor="growth-active-workspace">ACTIVE WORKSPACE</label>{workspaces.length>0?<div className="growth-nav-select-wrap"><Building2 size={15}/><select id="growth-active-workspace" value={activeWorkspace} onChange={e=>switchWorkspace(e.target.value)}>{workspaces.map(workspace=><option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select><ChevronDown size={14}/></div>:<div className="growth-nav-no-workspace">No active workspace</div>}</div>
   <label className="growth-nav-search"><Search size={15}/><input aria-label="Search navigation" placeholder="Find a page..." value={filter} onChange={event=>setFilter(event.target.value)}/><kbd>⌘ K</kbd></label>
   <nav className="growth-nav-links" aria-label="Workspace modules">
    {groups.map(group=><section className="growth-nav-group" key={group.label}><div className="growth-nav-caption">{group.label}</div>{group.items.map(item=>{const Icon=item.icon;return <Link key={item.id} href={item.href} prefetch className={isActive(item.href)?'active':''} aria-current={isActive(item.href)?'page':undefined}><Icon className="growth-nav-icon" size={17} strokeWidth={1.8}/><span>{item.label}</span>{isActive(item.href)&&<i className="growth-nav-active-indicator"/>}</Link>;})}</section>)}
    {!items.length&&<p className="growth-nav-no-results">No matching pages found.</p>}
   </nav>
   <div className="growth-nav-footer"><div className="growth-nav-user"><span className="growth-nav-avatar">{(email||'U').slice(0,1).toUpperCase()}</span><span className="growth-nav-user-copy"><b>{email||'Signed-in user'}</b><small>{isPlatformAdmin?'Platform Admin':memberRole||'No workspace role'}</small></span><span className="growth-nav-online" title="Signed in"/></div><button type="button" onClick={signOut}><LogOut size={15}/> Sign out</button></div>
  </aside>
  <header className="growth-workspace-topbar"><div className="growth-topbar-breadcrumb"><span>ANAIRA</span><i>/</i><span>{activePage[1]}</span><i>/</i><b>{activePage[2]}</b></div><div className="growth-topbar-context"><span className="growth-topbar-workspace"><Building2 size={15}/>{activeWorkspaceName}</span><span className="growth-topbar-role"><ShieldCheck size={14}/>{isPlatformAdmin?'Platform Admin':memberRole||'Workspace member'}</span></div></header>
  <nav className="growth-mobile-nav" aria-label="AI Growth mobile navigation">
   {mobileItems.map(item=>{const Icon=item.icon;return <Link key={item.id} href={item.href} className={isActive(item.href)?'active':''}><Icon size={19}/><small>{item.id==='intelligence'?'Growth':item.id==='marketing'?'Content':item.label}</small></Link>;})}
   <button type="button" className={moreOpen?'active':''} onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreOpen}><MoreHorizontal size={20}/><small>More</small></button>
  </nav>
  {moreOpen&&<><button className="growth-mobile-scrim" aria-label="Close menu" onClick={()=>setMoreOpen(false)}/><section className="growth-mobile-more" aria-label="More Growth modules"><div className="growth-mobile-more-head"><div><b>All Growth Modules</b><small>{activeWorkspaceName}</small></div><button type="button" onClick={()=>setMoreOpen(false)} aria-label="Close"><X size={18}/></button></div>{groups.map(group=><div className="growth-mobile-more-group" key={group.label}><small>{group.label}</small>{group.items.map(item=>{const Icon=item.icon;return <Link key={item.id} href={item.href} className={isActive(item.href)?'active':''} onClick={()=>setMoreOpen(false)}><Icon size={16}/>{item.label}</Link>;})}</div>)}<button type="button" className="growth-mobile-signout" onClick={signOut}><LogOut size={15}/> Sign out</button></section></>}
 </>;
}
