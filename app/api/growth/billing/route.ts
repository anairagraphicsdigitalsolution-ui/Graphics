import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
const allowedMetrics = ['leads','ai_messages','whatsapp_messages','email_messages','social_posts','media_bytes','workflow_runs'];
async function platformAdmin(db:any,userId:string){const {data,error}=await db.from('admin_users').select('user_id').eq('user_id',userId).maybeSingle();return !error&&Boolean(data?.user_id);}
function cleanLimits(input:any){const out:Record<string,number>={};for(const key of allowedMetrics){if(input?.[key]===undefined)continue;const value=Number(input[key]);if(!Number.isSafeInteger(value)||value < -1)throw new Error(`Invalid quota for ${key}; use -1 for unlimited or a non-negative integer.`);out[key]=value;}return out;}
function validDate(value:any){const d=new Date(value);if(!Number.isFinite(d.getTime()))throw new Error('Invalid subscription period date.');return d.toISOString();}
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const platformView=req.nextUrl.searchParams.get('platform')==='1';
 if(platformView){if(!await platformAdmin(c.db,c.userId))return apiJson({error:'Platform administrator access required.'},403);const [{data:plans,error:planError},{data:subscriptions,error:subError},{data:organizations,error:orgError},{data:payments,error:paymentError},{data:invoices,error:invoiceError}]=await Promise.all([c.db.from('growth_plans').select('*').order('sort_order'),c.db.from('growth_subscriptions').select('*,plan:growth_plans(id,slug,name)').order('created_at',{ascending:false}),c.db.from('growth_organizations').select('id,name,slug,status,plan').order('name'),c.db.from('growth_manual_payments').select('*,organization:growth_organizations(name),subscription:growth_subscriptions(id,plan_id)').order('created_at',{ascending:false}).limit(500),c.db.from('growth_invoices').select('*,organization:growth_organizations(name)').order('issued_at',{ascending:false}).limit(100)]);if(planError||subError||orgError)return apiJson({error:'Platform billing data unavailable.'},503);const confirmed=(payments||[]).filter((p:any)=>p.status==='confirmed');const balances=(subscriptions||[]).map((sub:any)=>{const paid=confirmed.filter((p:any)=>p.subscription_id===sub.id).reduce((n:number,p:any)=>n+Number(p.amount_minor||0),0);const credit=Number(sub.credit_limit_minor||0);return {organization_id:sub.organization_id,subscription_id:sub.id,credit_limit_minor:credit,paid_minor:paid,balance_minor:Math.max(0,credit-paid),overpaid_minor:Math.max(0,paid-credit)};});return apiJson({plans:plans||[],subscriptions:subscriptions||[],organizations:organizations||[],payments:paymentError?[]:payments||[],invoices:invoiceError?[]:invoices||[],balances,billingHistoryAvailable:!paymentError&&!invoiceError});}
 const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
 const [{data:subscription,error:subError},{data:usage,error:usageError},{data:plans,error:planError}]=await Promise.all([
  c.db.from('growth_subscriptions').select('id,organization_id,plan_id,status,billing_interval,currency,amount_minor,credit_limit_minor,period_start,period_end,trial_ends_at,cancel_at_period_end,created_at,plan:growth_plans(id,slug,name,description,limits,features)').eq('organization_id',orgId).maybeSingle(),
  c.db.from('growth_usage_counters').select('metric,period_start,used,updated_at').eq('organization_id',orgId).order('period_start',{ascending:false}),
  c.db.from('growth_plans').select('id,slug,name,description,currency,monthly_price_minor,yearly_price_minor,limits,features').eq('is_active',true).order('sort_order'),
 ]);
 if(subError||usageError||planError)return apiJson({error:'Billing data is unavailable. Apply the Growth billing migration.'},503);
 const {data:paymentRows,error:paymentError}=await c.db.from('growth_manual_payments').select('subscription_id,amount_minor,status,paid_at,payment_method,payment_reference').eq('organization_id',orgId).order('paid_at',{ascending:false}).limit(500);if(paymentError)return apiJson({error:'Payment history is unavailable. Apply the manual billing migration.'},503);const paid=(paymentRows||[]).filter((p:any)=>p.status==='confirmed'&&p.subscription_id===(subscription as any)?.id).reduce((n:number,p:any)=>n+Number(p.amount_minor||0),0);const credit=Number((subscription as any)?.credit_limit_minor||0);
 return apiJson({subscription:subscription||null,usage:usage||[],availablePlans:plans||[],credit:{limit_minor:credit,paid_minor:paid,balance_minor:Math.max(0,credit-paid),overpaid_minor:Math.max(0,paid-credit),payments:paymentRows||[]}});
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;if(!await platformAdmin(c.db,c.userId))return apiJson({error:'Platform administrator access required.'},403);
 try{const b=await req.json();
  if(b.action==='create_plan'){
   const slug=String(b.slug||'').trim().toLowerCase(),name=String(b.name||'').trim().slice(0,100),description=String(b.description||'').slice(0,1000),currency=String(b.currency||'INR');
   if(!/^[a-z0-9][a-z0-9-]{1,49}$/.test(slug)||!name||!['INR','USD'].includes(currency))return apiJson({error:'Valid plan slug, name and currency are required.'},400);
   const monthly=Number(b.monthlyPriceMinor??0),yearly=Number(b.yearlyPriceMinor??0);if(!Number.isSafeInteger(monthly)||monthly<0||!Number.isSafeInteger(yearly)||yearly<0)return apiJson({error:'Prices must be non-negative integer minor units (paise/cents).'},400);
   const {data,error}=await c.db.from('growth_plans').insert({slug,name,description,currency,monthly_price_minor:monthly,yearly_price_minor:yearly,limits:cleanLimits(b.limits||{}),features:b.features&&typeof b.features==='object'?b.features:{},sort_order:Number.isInteger(b.sortOrder)?b.sortOrder:100}).select('*').single();
   if(error)return apiJson({error:error.code==='23505'?'Plan slug already exists.':'Unable to create plan.'},409);
   await c.db.from('growth_platform_audit_events').insert({actor_user_id:c.userId,event_type:'billing.plan_created',metadata:{plan_id:data.id,slug}});return apiJson({plan:data},201);
  }
  if(b.action==='record_manual_payment'){
   const orgId=String(b.organizationId||''),method=String(b.paymentMethod||''),currency=String(b.currency||'INR');
   const amount=Number(b.amountMinor),tax=Number(b.taxMinor||0),payerName=String(b.payerName||'').trim().slice(0,160),payerPhone=String(b.payerPhone||'').trim().slice(0,30),reference=String(b.paymentReference||'').trim().slice(0,120),notes=String(b.notes||'').trim().slice(0,1000);
   if(!orgId||!['cash','upi','bank_transfer'].includes(method)||!['INR','USD'].includes(currency)||!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(tax)||tax<0||tax>amount)return apiJson({error:'Organization, payment method and valid amount/tax are required.'},400);
   if(method==='upi'&&!reference)return apiJson({error:'UPI UTR / transaction reference is required for manual UPI collection.'},400);
   const [{data:org},{data:subscription}]=await Promise.all([c.db.from('growth_organizations').select('id,name,status').eq('id',orgId).maybeSingle(),c.db.from('growth_subscriptions').select('id,plan_id,billing_interval,currency,amount_minor,period_start,period_end,plan:growth_plans(name)').eq('organization_id',orgId).maybeSingle()]);
   if(!org)return apiJson({error:'Workspace not found.'},404);
   if(!subscription)return apiJson({error:'Assign a plan/subscription to this workspace before recording payment.'},409);
   if(subscription.currency!==currency)return apiJson({error:'Payment currency must match the assigned subscription currency.'},400);
   const total=amount,subtotal=amount-tax,now=new Date().toISOString(),invoiceNumber=`AG-${new Date().toISOString().slice(0,7).replace('-','')}-${randomUUID().slice(0,8).toUpperCase()}`;
   const {data:payment,error:paymentError}=await c.db.from('growth_manual_payments').insert({organization_id:orgId,subscription_id:subscription.id,amount_minor:total,currency,payment_method:method,payment_reference:reference||null,payer_name:payerName||null,payer_phone:payerPhone||null,notes:notes||null,status:'confirmed',paid_at:b.paidAt?validDate(b.paidAt):now,recorded_by:c.userId}).select('*').single();
   if(paymentError)return apiJson({error:'Payment could not be saved. Apply the manual billing migration first.'},503);
   const {data:invoice,error:invoiceError}=await c.db.from('growth_invoices').insert({invoice_number:invoiceNumber,organization_id:orgId,payment_id:payment.id,subscription_id:subscription.id,currency,subtotal_minor:subtotal,tax_minor:tax,total_minor:total,status:'paid',line_items:[{description:`${(subscription.plan as any)?.name||'Growth Engine'} subscription`,amount_minor:subtotal}],payer_name:payerName||org.name,payer_phone:payerPhone||null,payment_method:method,issued_at:now}).select('*').single();
   if(invoiceError){await c.db.from('growth_manual_payments').delete().eq('id',payment.id);return apiJson({error:'Payment was not finalized because invoice creation failed. No payment was retained.'},500);}
   const {error:subUpdateError}=await c.db.from('growth_subscriptions').update({status:'active',updated_at:now}).eq('id',subscription.id);
   if(subUpdateError){await c.db.from('growth_invoices').delete().eq('id',invoice.id);await c.db.from('growth_manual_payments').delete().eq('id',payment.id);return apiJson({error:'Payment and invoice were rolled back because subscription activation failed.'},500);}
   await c.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:c.userId,event_type:'billing.manual_payment_recorded',metadata:{payment_id:payment.id,invoice_id:invoice.id,invoice_number:invoiceNumber,method,amount_minor:total}});
   return apiJson({payment,invoice,subscriptionActivated:true},201);
  }
  if(b.action==='assign_subscription'){
   const orgId=String(b.organizationId||''),planId=String(b.planId||''),status=String(b.status||'trialing'),interval=String(b.billingInterval||'month');
   if(!orgId||!planId||!['trialing','active','past_due','paused','cancelled','expired'].includes(status)||!['month','year'].includes(interval))return apiJson({error:'Organization, plan, status and billing interval are required.'},400);
   const [{data:org},{data:plan}]=await Promise.all([c.db.from('growth_organizations').select('id,name').eq('id',orgId).maybeSingle(),c.db.from('growth_plans').select('*').eq('id',planId).eq('is_active',true).maybeSingle()]);if(!org||!plan)return apiJson({error:'Organization or active plan not found.'},404);
   const start=validDate(b.periodStart||new Date().toISOString()),end=validDate(b.periodEnd||new Date(Date.now()+(interval==='year'?365:30)*86400000).toISOString());if(Date.parse(end)<=Date.parse(start))return apiJson({error:'Subscription period end must be after period start.'},400);
   const amount=Number(b.amountMinor??(interval==='year'?plan.yearly_price_minor:plan.monthly_price_minor));if(!Number.isSafeInteger(amount)||amount<0)return apiJson({error:'Invalid subscription amount.'},400);
   const creditLimit=Number(b.creditLimitMinor??0);if(!Number.isSafeInteger(creditLimit)||creditLimit<0)return apiJson({error:'Credit limit must be a non-negative amount.'},400);const payload={organization_id:orgId,plan_id:planId,status,billing_interval:interval,currency:plan.currency,amount_minor:amount,credit_limit_minor:creditLimit,period_start:start,period_end:end,trial_ends_at:b.trialEndsAt?validDate(b.trialEndsAt):null,cancel_at_period_end:false,updated_at:new Date().toISOString()};
   const {data,error}=await c.db.from('growth_subscriptions').upsert(payload,{onConflict:'organization_id'}).select('*,plan:growth_plans(name,slug)').single();if(error)return apiJson({error:'Unable to assign subscription.'},500);
   await c.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:c.userId,event_type:'billing.subscription_assigned',metadata:{plan_id:planId,status,amount_minor:amount,credit_limit_minor:creditLimit}});return apiJson({subscription:data},201);
  }
  return apiJson({error:'Unsupported billing action.'},400);
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Invalid billing request.'},400);}
}
export async function PATCH(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;if(!await platformAdmin(c.db,c.userId))return apiJson({error:'Platform administrator access required.'},403);
 try{const b=await req.json();
  if(b.action==='plan'){const id=String(b.planId||'');if(!id)return apiJson({error:'Plan ID required.'},400);const patch:any={updated_at:new Date().toISOString()};if(typeof b.isActive==='boolean')patch.is_active=b.isActive;if(b.name)patch.name=String(b.name).slice(0,100);if(b.description!==undefined)patch.description=String(b.description).slice(0,1000);if(b.limits)patch.limits=cleanLimits(b.limits);if(b.features&&typeof b.features==='object')patch.features=b.features;if(b.monthlyPriceMinor!==undefined){const v=Number(b.monthlyPriceMinor);if(!Number.isSafeInteger(v)||v<0)return apiJson({error:'Invalid monthly price.'},400);patch.monthly_price_minor=v;}const {data,error}=await c.db.from('growth_plans').update(patch).eq('id',id).select('*').maybeSingle();if(error||!data)return apiJson({error:'Unable to update plan.'},500);await c.db.from('growth_platform_audit_events').insert({actor_user_id:c.userId,event_type:'billing.plan_updated',metadata:{plan_id:id,patch}});return apiJson({plan:data});}
  if(b.action==='subscription'){const id=String(b.subscriptionId||''),status=String(b.status||'');if(!id||!['trialing','active','past_due','paused','cancelled','expired'].includes(status))return apiJson({error:'Subscription ID and valid status are required.'},400);const patch:any={status,updated_at:new Date().toISOString()};if(status==='cancelled')patch.cancelled_at=new Date().toISOString();if(b.periodEnd)patch.period_end=validDate(b.periodEnd);const {data,error}=await c.db.from('growth_subscriptions').update(patch).eq('id',id).select('id,organization_id,status,period_end').maybeSingle();if(error||!data)return apiJson({error:'Unable to update subscription.'},500);await c.db.from('growth_platform_audit_events').insert({organization_id:data.organization_id,actor_user_id:c.userId,event_type:'billing.subscription_status_changed',metadata:{status}});return apiJson({subscription:data});}
  return apiJson({error:'Unsupported billing action.'},400);
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Invalid billing update.'},400);}
}
