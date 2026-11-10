import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole, requireGrowthFeature} from '@/lib/growth-server';
export const runtime='nodejs';
const n=(v:any)=>{const x=Number(v);return Number.isFinite(x)?x:0;};
function actions(row:any,previous:any){
 const spend=n(row.spend),impressions=n(row.impressions),clicks=n(row.clicks),ctr=n(row.ctr),cpc=n(row.cpc);
 const priorSpend=n(previous?.spend),priorClicks=n(previous?.clicks),priorCtr=n(previous?.ctr);
 const out:any[]=[];
 if(impressions>=1000&&ctr>0&&ctr<0.5)out.push({priority:'high',code:'LOW_CTR',title:'Review creative and audience fit',reason:`CTR is ${ctr.toFixed(2)}% across ${impressions.toLocaleString()} impressions.`,suggestion:'Test a new approved creative and a narrower audience. Keep the current ad paused only after human review.'});
 if(clicks>=20&&cpc>0&&priorClicks>0&&cpc>n(previous?.cpc)*1.25)out.push({priority:'medium',code:'CPC_RISING',title:'Investigate rising cost per click',reason:`Current CPC ${cpc.toFixed(2)} vs previous snapshot ${n(previous.cpc).toFixed(2)}.`,suggestion:'Compare placement, audience and creative breakdown before changing bids or budget.'});
 if(spend>=100&&clicks===0)out.push({priority:'high',code:'SPEND_NO_CLICKS',title:'Check delivery quality',reason:`Spend ${spend.toFixed(2)} with no recorded clicks.`,suggestion:'Review destination URL, delivery, tracking and audience. Consider pausing only after checking attribution and reporting delay.'});
 if(priorCtr>0&&ctr>0&&ctr<priorCtr*0.7&&impressions>=500)out.push({priority:'medium',code:'CTR_DECLINE',title:'CTR has declined',reason:`CTR changed from ${priorCtr.toFixed(2)}% to ${ctr.toFixed(2)}%.`,suggestion:'Refresh creative or review frequency and audience saturation.'});
 return out;
}
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const org=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 if(!await requireGrowthFeature(c.db,c.userId,org,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
 const {data,error}=await c.db.from('growth_ads_insights').select('id,ad_account_id,period_start,period_end,metrics,source_status,synced_at').eq('organization_id',org).eq('source_status','synced').order('synced_at',{ascending:false}).limit(20);
 if(error)return apiJson({error:'Ads insights history unavailable.'},500);
 const snapshots=data||[];if(!snapshots.length)return apiJson({recommendations:[],message:'Sync Meta Ads Insights first.'});
 const latest=snapshots[0],rows=Array.isArray(latest.metrics)?latest.metrics:[];
 const previous=snapshots.find((s:any)=>s.ad_account_id===latest.ad_account_id&&s.id!==latest.id);
 const priorRows=Array.isArray(previous?.metrics)?previous.metrics:[];
 const byId=new Map(priorRows.map((r:any)=>[String(r.campaign_id),r]));
 const recommendations=rows.map((r:any)=>({campaign_id:String(r.campaign_id||''),campaign_name:String(r.campaign_name||r.campaign_id||'Campaign'),metrics:{spend:n(r.spend),impressions:n(r.impressions),clicks:n(r.clicks),ctr:n(r.ctr),cpc:n(r.cpc)},items:actions(r,byId.get(String(r.campaign_id)))})).filter((x:any)=>x.items.length).flatMap((x:any)=>x.items.map((a:any)=>({...a,campaign_id:x.campaign_id,campaign_name:x.campaign_name,metrics:x.metrics})));
 return apiJson({snapshot:{id:latest.id,ad_account_id:latest.ad_account_id,period_start:latest.period_start,period_end:latest.period_end,synced_at:latest.synced_at},recommendations,disclaimer:'Heuristic suggestions from provider-reported campaign metrics. No campaign, bid, budget or ad status is changed automatically.'});
}
