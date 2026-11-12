import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export async function GET(req:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;if(!/^[a-f0-9]{32}$/.test(slug))return new NextResponse('Not found',{status:404});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!service)return new NextResponse('Tracking unavailable',{status:503});
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const ref=req.headers.get('referer')||'';let host='';try{host=new URL(ref).hostname;}catch{}
 const ua=req.headers.get('user-agent')||'';const family=/mobile|android|iphone/i.test(ua)?'mobile':/bot|crawler|spider/i.test(ua)?'bot':'desktop';
 const {data,error}=await db.rpc('record_growth_promotion_click',{p_slug:slug,p_referrer_host:host,p_user_agent_family:family});
 if(error||!data)return new NextResponse('Link unavailable',{status:404});
 return NextResponse.redirect(data,302);
}
