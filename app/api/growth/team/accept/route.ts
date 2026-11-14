import {NextRequest} from 'next/server';
import {apiJson,growthContext} from '@/lib/growth-server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),id=String(b.invitationId||'');
  if(!id)return apiJson({error:'Invitation ID required.'},400);
  const {data,error}=await c.db.rpc('growth_team_accept_invitation',{p_invitation_id:id,p_user_id:c.userId});
  if(error){
   const message=error.message||'';
   if(/invitation_invalid_or_expired/.test(message))return apiJson({error:'Invitation is invalid, expired or already used.'},404);
   if(/invitation_identity_mismatch/.test(message))return apiJson({error:'This invitation belongs to a different account.'},403);
   if(/workspace_inactive/.test(message))return apiJson({error:'This workspace is currently inactive. Ask its owner to reactivate it before accepting the invitation.'},403);
   return apiJson({error:'Unable to accept invitation. Please retry or contact the workspace owner.'},500);
  }
  return apiJson(data||{ok:true});
 }catch{return apiJson({error:'Unable to accept invitation.'},400);}
}
