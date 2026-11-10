import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';
const roles=['manager','editor','viewer','client'];
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Owner or manager permission required.'},403);
 await c.db.from('growth_team_invitations').update({status:'expired',updated_at:new Date().toISOString()}).eq('organization_id',orgId).eq('status','pending').lt('expires_at',new Date().toISOString());
 const [{data:members,error},{data:invites}]=await Promise.all([
  c.db.from('growth_members').select('user_id,role,created_at').eq('organization_id',orgId).order('created_at'),
  c.db.from('growth_team_invitations').select('id,invited_email,invited_role,status,expires_at,created_at').eq('organization_id',orgId).order('created_at',{ascending:false})
 ]);
 if(error)return apiJson({error:'Unable to load team members.'},500);
 const ids=(members||[]).map((m:any)=>m.user_id);
 const profiles=ids.length?await c.db.auth.admin.listUsers({page:1,perPage:1000}):{data:{users:[]},error:null};
 const users=new Map((profiles.data?.users||[]).map((u:any)=>[u.id,{email:u.email,last_sign_in_at:u.last_sign_in_at}]));
 return apiJson({members:(members||[]).map((m:any)=>({...m,...(users.get(m.user_id)||{})})),invitations:invites||[]});
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),email=String(b.email||'').trim().toLowerCase(),role=String(b.role||'viewer');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!roles.includes(role))return apiJson({error:'A valid email and non-owner role are required.'},400);
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Owner or manager permission required.'},403);
  const {data:actor}=await c.db.from('growth_members').select('role').eq('organization_id',orgId).eq('user_id',c.userId).maybeSingle();
  if(actor?.role!=='owner'&&role==='manager')return apiJson({error:'Only the organization owner can invite managers.'},403);
  const {data:existing}=await c.db.from('growth_team_invitations').select('id').eq('organization_id',orgId).eq('invited_email',email).eq('status','pending').gt('expires_at',new Date().toISOString()).maybeSingle();
  if(existing)return apiJson({error:'A pending invitation already exists for this email.'},409);
  const {data:org}=await c.db.from('growth_organizations').select('name').eq('id',orgId).maybeSingle();if(!org)return apiJson({error:'Workspace not found.'},404);
  const site=(process.env.NEXT_PUBLIC_SITE_URL||process.env.ANAIRA_GROWTH_SITE_URL||'').replace(/\/$/,'');
  if(!site)return apiJson({error:'Set NEXT_PUBLIC_SITE_URL to enable invitation emails.'},503);
  const {data:row,error:rowError}=await c.db.from('growth_team_invitations').insert({organization_id:orgId,invited_email:email,invited_role:role,invited_by:c.userId}).select('id,invited_email,invited_role,status,expires_at').single();
  if(rowError||!row)return apiJson({error:'Unable to create invitation record.'},500);
  const {data:invited,error:inviteError}=await c.db.auth.admin.inviteUserByEmail(email,{redirectTo:`${site}/admin/ai-growth/team?invite=${row.id}`,data:{growth_organization_id:orgId,growth_invited_role:role}});
  if(inviteError||!invited.user){await c.db.from('growth_team_invitations').update({status:'revoked'}).eq('id',row.id);return apiJson({error:inviteError?.message||'Invitation email could not be sent.'},502);}
  const {error:updateError}=await c.db.from('growth_team_invitations').update({invited_user_id:invited.user.id}).eq('id',row.id);
  if(updateError)return apiJson({error:'Invitation email sent but activation record needs administrator review.'},500);
  await c.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:c.userId,event_type:'team.invitation_sent',target_user_id:invited.user.id,target_email:email,metadata:{role}});
  return apiJson({invitation:row},201);
 }catch{return apiJson({error:'Invalid invitation request.'},400);}
}
export async function PATCH(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{const b=await req.json(),orgId=String(b.organizationId||''),id=String(b.invitationId||''),memberUserId=String(b.userId||''),role=String(b.role||'');
  if(!roles.includes(role)||!await requireGrowthRole(c.db,c.userId,orgId,['owner']))return apiJson({error:'Owner permission and a valid role are required.'},403);
  if(memberUserId){const {data:target}=await c.db.from('growth_members').select('role').eq('organization_id',orgId).eq('user_id',memberUserId).maybeSingle();if(!target||target.role==='owner')return apiJson({error:'Member not found or owner role is immutable.'},400);const {error}=await c.db.from('growth_members').update({role}).eq('organization_id',orgId).eq('user_id',memberUserId);if(error)return apiJson({error:'Unable to update member role.'},500);await c.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:c.userId,event_type:'team.member_role_changed',target_user_id:memberUserId,metadata:{role}});return apiJson({ok:true});}
  if(!id)return apiJson({error:'Invitation or member ID required.'},400);
  const {data,error}=await c.db.from('growth_team_invitations').update({invited_role:role,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId).eq('status','pending').select('id').maybeSingle();
  if(error||!data)return apiJson({error:'Pending invitation not found.'},404);return apiJson({ok:true});
 }catch{return apiJson({error:'Invalid request.'},400);}
}
export async function DELETE(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{const b=await req.json(),orgId=String(b.organizationId||''),id=String(b.id||''),userId=String(b.userId||'');
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner']))return apiJson({error:'Only the owner can remove members or revoke invitations.'},403);
  if(id){const {data,error}=await c.db.from('growth_team_invitations').update({status:'revoked',updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId).eq('status','pending').select('invited_email').maybeSingle();if(error||!data)return apiJson({error:'Unable to revoke invitation.'},500);await c.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:c.userId,event_type:'team.invitation_revoked',target_email:data.invited_email});return apiJson({ok:true});}
  if(!userId||userId===c.userId)return apiJson({error:'Select another member. Owners cannot remove themselves.'},400);
  const {data:target}=await c.db.from('growth_members').select('role').eq('organization_id',orgId).eq('user_id',userId).maybeSingle();
  if(!target||target.role==='owner')return apiJson({error:'Member not found or owner removal is prohibited.'},400);
  const {error}=await c.db.from('growth_members').delete().eq('organization_id',orgId).eq('user_id',userId);if(error)return apiJson({error:'Unable to remove member.'},500);await c.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:c.userId,event_type:'team.member_removed',target_user_id:userId});return apiJson({ok:true});
 }catch{return apiJson({error:'Invalid request.'},400);}
}
