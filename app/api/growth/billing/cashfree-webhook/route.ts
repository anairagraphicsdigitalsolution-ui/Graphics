import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { apiJson } from '@/lib/growth-server';
export const runtime='nodejs';
const API_VERSION='2025-01-01';
function safeEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export async function POST(req:NextRequest){
 const secret=process.env.CASHFREE_SECRET_KEY,appId=process.env.CASHFREE_APP_ID;if(!secret||!appId)return apiJson({error:'Cashfree webhook is not configured.'},503);
 const raw=await req.text(),signature=req.headers.get('x-webhook-signature')||'',timestamp=req.headers.get('x-webhook-timestamp')||'';
 if(!signature||!timestamp||!/^\d{10,}$/.test(timestamp))return apiJson({error:'Missing Cashfree signature headers.'},401);
 const expected=createHmac('sha256',secret).update(timestamp+raw).digest('base64');if(!safeEqual(expected,signature))return apiJson({error:'Invalid Cashfree webhook signature.'},401);
 let event:any;try{event=JSON.parse(raw);}catch{return apiJson({error:'Invalid webhook JSON.'},400);}
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!service)return apiJson({error:'Database service is not configured.'},503);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const orderId=String(event?.data?.order?.order_id||event?.data?.order_id||''),paymentId=String(event?.data?.payment?.cf_payment_id||''),eventType=String(event?.type||event?.event||'PAYMENT_EVENT');
 if(!orderId)return apiJson({error:'Webhook has no order identifier.'},400);
 const eventKey=`${eventType}:${paymentId||orderId}:${timestamp}`;
 const {data:payment,error:lookupError}=await db.from('growth_payment_transactions').select('*').eq('provider_order_id',orderId).maybeSingle();
 if(lookupError)return apiJson({error:'Payment ledger lookup failed.'},503);if(!payment)return apiJson({received:true,ignored:true});
 const env=(process.env.CASHFREE_ENV||'sandbox').toLowerCase(),base=env==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
 // Never activate a subscription from an unsigned/unverified browser redirect or webhook payload alone.
 const verify=await fetch(`${base}/orders/${encodeURIComponent(orderId)}/payments`,{headers:{'Accept':'application/json','x-client-id':appId,'x-client-secret':secret,'x-api-version':API_VERSION},cache:'no-store'});
 const payments=await verify.json().catch(()=>[]);if(!verify.ok||!Array.isArray(payments))return apiJson({error:'Cashfree payment verification is temporarily unavailable.'},503);
 const success=payments.find((p:any)=>String(p.payment_status)==='SUCCESS'&&Number(Math.round(Number(p.payment_amount)*100))===Number(payment.amount_minor)&&String(p.payment_currency||'INR')==='INR');
 if(success){const now=new Date(),end=new Date(now);end.setDate(end.getDate()+(payment.billing_interval==='year'?365:30));
  const {data:plan}=await db.from('growth_plans').select('id').eq('id',payment.plan_id).eq('is_active',true).maybeSingle();if(!plan)return apiJson({error:'The purchased plan is no longer active; manual review required.'},409);
  const {error:subError}=await db.from('growth_subscriptions').upsert({organization_id:payment.organization_id,plan_id:payment.plan_id,status:'active',billing_interval:payment.billing_interval,currency:'INR',amount_minor:payment.amount_minor,period_start:now.toISOString(),period_end:end.toISOString(),payment_provider:'cashfree',provider_customer_id:payment.customer_email,metadata:{last_cashfree_order_id:orderId},updated_at:now.toISOString()},{onConflict:'organization_id'});
  if(subError)return apiJson({error:'Payment verified but subscription activation needs retry.'},503);
  await db.from('growth_payment_transactions').update({status:'paid',provider_payment_id:(success.cf_payment_id||paymentId)?String(success.cf_payment_id||paymentId):null,paid_at:success.payment_time||now.toISOString(),provider_payload:{payment_status:'SUCCESS',payment_group:success.payment_group||null,bank_reference:success.bank_reference||null}}).eq('id',payment.id);
  await db.from('growth_platform_audit_events').insert({organization_id:payment.organization_id,event_type:'billing.cashfree_payment_succeeded',metadata:{order_id:orderId,amount_minor:payment.amount_minor,provider_payment_id:String(success.cf_payment_id||'')}});
 }else{
  const failed=payments.some((p:any)=>['FAILED','USER_DROPPED','CANCELLED'].includes(String(p.payment_status)));
  if(failed)await db.from('growth_payment_transactions').update({status:'failed',provider_payload:{payment_status:'FAILED'}}).eq('id',payment.id).neq('status','paid');
 }
 const {error:dedupeError}=await db.from('growth_payment_webhook_events').insert({event_key:eventKey,event_type:eventType,provider_order_id:orderId,payload:event});
 if(dedupeError?.code==='23505')return apiJson({received:true,duplicate:true});if(dedupeError)return apiJson({error:'Webhook event processed but audit event could not be recorded.'},503);
 return apiJson({received:true,verified:Boolean(success)});
}
