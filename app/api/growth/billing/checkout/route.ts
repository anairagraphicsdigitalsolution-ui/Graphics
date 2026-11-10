import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime='nodejs';
const API_VERSION='2025-01-01';
function cashfreeConfig(){const appId=process.env.CASHFREE_APP_ID,secret=process.env.CASHFREE_SECRET_KEY,env=(process.env.CASHFREE_ENV||'sandbox').toLowerCase();if(!appId||!secret)return null;return {appId,secret,base:env==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg'};}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const body=await req.json(),orgId=String(body.organizationId||''),planId=String(body.planId||''),interval=String(body.billingInterval||'month');
  if(!orgId||!planId||!['month','year'].includes(interval))return apiJson({error:'Organization, plan and billing interval are required.'},400);
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner']))return apiJson({error:'Only the workspace owner can purchase or change a subscription.'},403);
  const config=cashfreeConfig();if(!config)return apiJson({error:'Cashfree is not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY to server environment variables.'},503);
  const [{data:plan,error:planError},{data:userResult,error:userError}]=await Promise.all([c.db.from('growth_plans').select('id,name,currency,monthly_price_minor,yearly_price_minor,is_active').eq('id',planId).eq('is_active',true).maybeSingle(),c.db.auth.admin.getUserById(c.userId)]);
  if(planError||!plan)return apiJson({error:'Active plan not found.'},404);
  if(userError||!userResult?.user?.email)return apiJson({error:'A verified account email is required for checkout.'},400);
  const phone=String(body.customerPhone||userResult.user.phone||'').replace(/\D/g,'');if(!/^\d{10,15}$/.test(phone))return apiJson({error:'Enter a valid customer phone number to continue.'},400);
  if(plan.currency!=='INR')return apiJson({error:'Cashfree checkout currently supports INR plans only.'},400);
  const amountMinor=Number(interval==='year'?plan.yearly_price_minor:plan.monthly_price_minor);if(!Number.isSafeInteger(amountMinor)||amountMinor<=0)return apiJson({error:'This plan has no payable price configured.'},400);
  const orderId=`ag_${randomUUID().replaceAll('-','').slice(0,28)}`;
  const site=(process.env.NEXT_PUBLIC_SITE_URL||process.env.ANAIRA_GROWTH_SITE_URL||'').replace(/\/$/,'');if(!site||!/^https:\/\//i.test(site))return apiJson({error:'Set NEXT_PUBLIC_SITE_URL or ANAIRA_GROWTH_SITE_URL to the deployed HTTPS URL.'},503);
  const {error:insertError}=await c.db.from('growth_payment_transactions').insert({organization_id:orgId,plan_id:planId,provider_order_id:orderId,amount_minor:amountMinor,currency:'INR',billing_interval:interval,status:'created',customer_email:userResult.user.email,customer_phone:phone});
  if(insertError)return apiJson({error:'Unable to create payment record. Apply the Cashfree payment migration first.'},503);
  const cashfreeResponse=await fetch(`${config.base}/orders`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','x-client-id':config.appId,'x-client-secret':config.secret,'x-api-version':API_VERSION,'x-idempotency-key':orderId},body:JSON.stringify({order_id:orderId,order_amount:Number((amountMinor/100).toFixed(2)),order_currency:'INR',customer_details:{customer_id:c.userId.replaceAll('-','').slice(0,50),customer_email:userResult.user.email,customer_phone:phone},order_meta:{return_url:`${site}/admin/ai-growth/billing?cashfree_order_id=${orderId}`,notify_url:`${site}/api/growth/billing/cashfree-webhook`},order_note:`Anaira AI Growth ${plan.name} (${interval})`}),cache:'no-store'});
  const result=await cashfreeResponse.json().catch(()=>({}));
  if(!cashfreeResponse.ok||!result.payment_session_id){await c.db.from('growth_payment_transactions').update({status:'failed',provider_payload:{error:result}}).eq('provider_order_id',orderId);return apiJson({error:'Cashfree could not create the payment session.',providerStatus:cashfreeResponse.status},502);}
  await c.db.from('growth_payment_transactions').update({status:'pending',payment_session_id:result.payment_session_id,provider_payload:{cf_order_id:result.cf_order_id||null}}).eq('provider_order_id',orderId);
  return apiJson({provider:'cashfree',environment:process.env.CASHFREE_ENV||'sandbox',orderId,paymentSessionId:result.payment_session_id,amountMinor,currency:'INR',apiVersion:API_VERSION});
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Unable to start Cashfree checkout.'},400);}
}
