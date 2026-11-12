'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {supabase} from '@/lib/supabase';

const workspaceItems=[
 ['overview','Overview','/admin/ai-growth/overview'],['intelligence','Growth Intelligence','/admin/ai-growth/intelligence'],['website-intelligence','Website SEO','/admin/ai-growth/website-intelligence'],['crm','CRM & Leads','/admin/ai-growth/crm'],
 ['marketing','Content Studio','/admin/ai-growth/marketing'],['tasks','Tasks','/admin/ai-growth/tasks'],
 ['campaigns','Campaigns & Ads','/admin/ai-growth/campaigns'],['employee','AI Employee','/admin/ai-growth/employee'],
 ['automation','Automation','/admin/ai-growth/automation'],['schedules','Autonomous Schedules','/admin/ai-growth/automation/schedules'],['channels','Channels','/admin/ai-growth/channels'],
 ['analytics','Analytics','/admin/ai-growth/analytics'],['integrations','Integrations','/admin/ai-growth/integrations'],['team','Team','/admin/ai-growth/team'],
 ['billing','Plan & Usage','/admin/ai-growth/billing']
] as const;
const platformItems=[
 ['platform','Super Admin','/admin/ai-growth/platform'],
 ['platform-billing','Plans & Billing','/admin/ai-growth/platform/billing']
] as const;

export default function GrowthPrimaryNav(){
 const pathname=usePathname()||'';
 const [ready,setReady]=useState(false),[isPlatformAdmin,setIsPlatformAdmin]=useState(false),[isWorkspaceMember,setIsWorkspaceMember]=useState(false),[isWorkspaceManager,setIsWorkspaceManager]=useState(false);
 useEffect(()=>{
  let active=true;
  async function resolveAccess(){
   if(!supabase){if(active)setReady(true);return;}
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){if(active)setReady(true);return;}
   const [{data:admin},{data:members}]=await Promise.all([
    supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle(),
    supabase.from('growth_members').select('role').eq('user_id',user.id).in('role',['owner','manager','member']).limit(1)
   ]);
   if(active){setIsPlatformAdmin(Boolean(admin?.user_id));setIsWorkspaceMember(Boolean(members?.length));setIsWorkspaceManager(Boolean(members?.some(x=>['owner','manager'].includes(x.role))));setReady(true);}
  }
  resolveAccess();
  if(!supabase){return()=>{active=false;};}
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setReady(false);resolveAccess();});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 if(!ready)return <nav className="growth-module-nav growth-primary-nav" aria-label="Anaira Growth Engine main navigation" aria-busy="true"/>;
 const visibleWorkspaceItems=isWorkspaceManager?workspaceItems:workspaceItems.filter(([id])=>id!=='schedules'&&id!=='integrations');
 const items=[...(isWorkspaceMember?visibleWorkspaceItems:[]),...(isPlatformAdmin?platformItems:[])];
 return <nav className="growth-module-nav growth-primary-nav" aria-label="Anaira Growth Engine main navigation">{items.map(([id,label,href])=><Link key={id} href={href} prefetch className={pathname===href||pathname.startsWith(href+'/')?'active':''}>{label}</Link>)}</nav>;
}
