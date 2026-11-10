import {NextRequest} from 'next/server';
import {apiJson,growthContext} from '@/lib/growth-server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{const b=await req.json(),id=String(b.invitationId||'');if(!id)return apiJson({error:'Invitation ID required.'},400);
  const {data:user}=await c.db.auth.admin.getUserById(c.userId);if(!user.user?.email)return apiJson({error:'Authenticated email unavailable.'},400);
  const {data:invite,error}=await c.db.from('growth_team_invitations').select('*').eq('id',id).eq('status','pending').maybeSingle();
  if(error||!invite||new Date(invite.expires_at)<new Date())return apiJson({error:'Invitation is invalid, expired or already used.'},404);
  if(invite.invited_user_id!==c.userId||invite.invited_email.toLowerCase()!==user.user.email.toLowerCase())return apiJson({error:'This invitation belongs to a different account.'},403);
  const {error:memberError}=await c.db.from('growth_members').upsert({organization_id:invite.organization_id,user_id:c.userId,role:invite.invited_role},{onConflict:'organization_id,user_id'});
  if(memberError)return apiJson({error:'Unable to activate workspace membership.'},500);
  await c.db.from('growth_team_invitations').update({status:'accepted',accepted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);
  await c.db.from('growth_platform_audit_events').insert({organization_id:invite.organization_id,actor_user_id:c.userId,event_type:'team.invitation_accepted',target_user_id:c.userId,target_email:user.user.email,metadata:{role:invite.invited_role}});
  return apiJson({ok:true,organizationId:invite.organization_id});
 }catch{return apiJson({error:'Unable to accept invitation.'},400);}
}
