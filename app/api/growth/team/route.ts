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
 const currentRole=(members||[]).find((m:any)=>m.user_id===c.userId)?.role||null;
 const ids=(members||[]).map((m:any)=>m.user_id);
 const profiles=ids.length?await c.db.auth.admin.listUsers({page:1,perPage:1000}):{data:{users:[]},error:null};
 const users=new Map((profiles.data?.users||[]).map((u:any)=>[u.id,{email:u.email,last_sign_in_at:u.last_sign_in_at}]));
 return apiJson({currentRole,members:(members||[]).map((m:any)=>({...m,...(users.get(m.user_id)||{})})),invitations:invites||[]});
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
  // Do not issue an invitation to an account that is already a workspace member.
  // Supabase Admin API does not expose a direct email-to-user lookup, so resolve
  // the account from the paginated user directory before creating the invite.
  let invitedAccountId:string|null=null;
  for(let page=1;page<=10;page++){
   const {data:userPage,error:userError}=await c.db.auth.admin.listUsers({page,perPage:1000});
   if(userError)return apiJson({error:'Unable to validate the invited account. Please retry.'},503);
   const match=(userPage?.users||[]).find((u:any)=>String(u.email||'').toLowerCase()===email);
   if(match){invitedAccountId=match.id;break;}
   if((userPage?.users||[]).length<1000)break;
  }
  if(invitedAccountId){
   const {data:membership,error:membershipError}=await c.db.from('growth_members').select('user_id').eq('organization_id',orgId).eq('user_id',invitedAccountId).maybeSingle();
   if(membershipError)return apiJson({error:'Unable to validate existing workspace membership.'},503);
   if(membership)return apiJson({error:'This account is already a member of the workspace.'},409);
  }
  const {data:org}=await c.db.from('growth_organizations').select('name,status').eq('id',orgId).maybeSingle();if(!org)return apiJson({error:'Workspace not found.'},404);
  if(org.status!=='active')return apiJson({error:'Invitations are disabled while this workspace is inactive.'},403);
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
  if(b.action==='transfer_owner'){
   if(!await requireGrowthRole(c.db,c.userId,orgId,['owner']))return apiJson({error:'Only the current owner can transfer ownership.'},403);
   const targetId=String(b.userId||'');if(!targetId)return apiJson({error:'Select the new owner.'},400);
   const {data,error}=await c.db.rpc('growth_team_transfer_owner',{p_actor_user_id:c.userId,p_organization_id:orgId,p_target_user_id:targetId});
   if(error)return apiJson({error:/owner_required/.test(error.message)?'Only the current owner can transfer ownership.':'Unable to transfer workspace ownership.'},403);
   return apiJson(data||{ok:true});
  }
  if(!roles.includes(role)||!await requireGrowthRole(c.db,c.userId,orgId,['owner']))return apiJson({error:'Owner permission and a valid role are required.'},403);
  if(memberUserId){const {data,error}=await c.db.rpc('growth_team_set_member_role',{p_actor_user_id:c.userId,p_organization_id:orgId,p_target_user_id:memberUserId,p_role:role});if(error)return apiJson({error:/owner_required/.test(error.message)?'Only the owner can change member roles.':'Unable to update member role.'},403);return apiJson(data||{ok:true});}
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
  const {data,error}=await c.db.rpc('growth_team_remove_member',{p_actor_user_id:c.userId,p_organization_id:orgId,p_target_user_id:userId});
  if(error)return apiJson({error:/cannot_remove_self/.test(error.message)?'You cannot remove your own account.':/owner_required/.test(error.message)?'Only the owner can remove members.':'Member not found or owner removal is prohibited.'},403);
  return apiJson(data||{ok:true});
 }catch{return apiJson({error:'Invalid request.'},400);}
}
