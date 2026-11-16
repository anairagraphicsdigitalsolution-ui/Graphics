export type GrowthChannel = 'email'|'whatsapp'|'sms'|'voice';
export type CommunicationPolicy = { quiet_hours?: { enabled?: boolean; start?: string; end?: string; timezone?: string; days?: number[] }; channel_enabled?: Partial<Record<GrowthChannel, boolean>> };
const validTime=(v:unknown)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
function partsAt(date:Date,timeZone:string){const parts=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(date);const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];return {minute:Number(get('hour'))*60+Number(get('minute')),day:days.indexOf(get('weekday'))};}
export function evaluateGrowthSendPolicy(policy:CommunicationPolicy|null|undefined,channel:GrowthChannel,now=new Date()){
 const p=policy||{};if(p.channel_enabled?.[channel]===false)return {allowed:false,reason:`${channel} communication is disabled by workspace policy.`};
 const q=p.quiet_hours;if(!q?.enabled)return {allowed:true,reason:null};
 const timezone=typeof q.timezone==='string'&&q.timezone.trim()?q.timezone:'Asia/Kolkata';
 if(!validTime(q.start)||!validTime(q.end))return {allowed:false,reason:'Quiet hours are enabled but start/end times are invalid.'};
 let local;try{local=partsAt(now,timezone);}catch{return {allowed:false,reason:'Quiet-hours timezone is invalid.'};}
 const days=Array.isArray(q.days)?q.days.filter((d:any)=>Number.isInteger(d)&&d>=0&&d<=6):[0,1,2,3,4,5,6];if(!days.includes(local.day))return {allowed:true,reason:null};
 const [sh,sm]=q.start!.split(':').map(Number),[eh,em]=q.end!.split(':').map(Number),start=sh*60+sm,end=eh*60+em;
 const quiet=start===end?true:start<end?local.minute>=start&&local.minute<end:local.minute>=start||local.minute<end;
 return quiet?{allowed:false,reason:`Workspace quiet hours are active (${q.start}–${q.end} ${timezone}).`}:{allowed:true,reason:null};
}
export function evaluateLeadChannelSuppression(lead:any,channel:GrowthChannel){
 if(lead?.contact_opted_out_at||lead?.consent_to_contact!==true)return {allowed:false,reason:'Global opt-out or missing contact consent.'};
 if(lead?.channel_consents?.[channel]?.granted!==true)return {allowed:false,reason:`Explicit ${channel} channel consent is missing.`};
 if(lead?.channel_suppressions?.[channel]?.suppressed===true)return {allowed:false,reason:`${channel} channel is suppressed for this contact.`};
 if(channel==='email'&&(lead?.email_bounced_at||lead?.email_complained_at))return {allowed:false,reason:'Email address is bounced or complained.'};
 return {allowed:true,reason:null};
}
