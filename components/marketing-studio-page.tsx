import Link from "next/link";
import {SiteLayout,PageHero} from "@/components/site-shell";
import {getPortfolioContent} from "@/lib/content";
import {studioDefaults as defaults} from "@/lib/studio-content";

export async function MarketingStudioPage({page}:{page:"social"|"advertising"|"seo"|"creative"}){
 const {settings}=await getPortfolioContent();
 const key=`studio_${page}`;
 const data={...defaults[page],...(settings?.[key]||{})};
 const services=Array.isArray(data.services)?data.services:defaults[page].services;
 const overlayHex=String(data.heroOverlayColor||"#041f16").replace("#","");
 const overlayRgb=overlayHex.length===6?`${parseInt(overlayHex.slice(0,2),16)},${parseInt(overlayHex.slice(2,4),16)},${parseInt(overlayHex.slice(4,6),16)}`:"4,31,22";
 const overlayStrength=Math.max(0,Math.min(100,Number(data.heroOverlayOpacity??82)))/100;
 return <SiteLayout><main className="studio-page">
  <section className="studio-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(${overlayRgb},${overlayStrength}) 0%,rgba(${overlayRgb},${overlayStrength*.82}) 48%,rgba(${overlayRgb},${overlayStrength*.22}) 100%),url("${data.heroImage||defaults[page].heroImage}")`}}>
   <div className="container studio-hero-inner"><span className="studio-eyebrow" style={{color:data.heroEyebrowColor||undefined}}>{data.eyebrow}</span><h1 style={{color:data.heroTitleColor||undefined}}>{data.title}</h1><p style={{color:data.heroDescriptionColor||undefined}}>{data.description}</p><div className="studio-hero-actions"><Link href="/contact">Discuss a project <span>↗</span></Link><span className="studio-est">ANAIRA · KULLU · INDIA</span></div></div>
   <div className="studio-hero-index">01 <i/> 0{services.length}</div>
  </section>
  <section className="studio-intro section"><div className="container studio-intro-grid"><div><span className="studio-kicker">THE ANAIRA APPROACH</span><h2>{data.introTitle}</h2></div><div><p>{data.intro}</p><div className="studio-proof"><span><b>01</b> Strategy-led</span><span><b>02</b> Detail-focused</span><span><b>03</b> Measurable delivery</span></div></div></div></section>
  <section className="studio-services section"><div className="container"><div className="studio-heading"><div><span className="studio-kicker">OUR CAPABILITIES</span><h2>Every detail, considered.</h2></div><p>Focused expertise, clear deliverables and a considered process — shaped around your brand and business objectives.</p></div><div className="studio-service-grid">{services.map((item:any,i:number)=><article className="studio-card" key={`${item.title}-${i}`}><div className="studio-card-image"><img src={item.image||defaults[page].heroImage} alt={item.title}/><span>{String(i+1).padStart(2,"0")}</span></div><div className="studio-card-body"><div className="studio-card-tag">{item.tag||"ANAIRA STUDIO"}</div><h3>{item.title}</h3><p>{item.desc}</p><ul>{(item.items||[]).map((line:string,j:number)=><li key={j}>{line}</li>)}</ul><Link href={`/contact?service=${encodeURIComponent(item.title||"")}`}>Enquire about this service <span>↗</span></Link></div></article>)}</div></div></section>
  <section className="studio-process section"><div className="container"><div className="studio-heading"><div><span className="studio-kicker">A CLEAR PROCESS</span><h2>From first conversation to better outcomes.</h2></div><p>Good work comes from a disciplined process, transparent communication and thoughtful iteration.</p></div><div className="studio-process-grid">{(data.process||defaults[page].process).map((step:string,i:number)=><div key={i}><span>0{i+1}</span><h3>{step}</h3></div>)}</div></div></section>
  <section className="studio-cta"><div className="container"><span className="studio-kicker">LET’S BUILD WHAT’S NEXT</span><h2>Bring your next idea into focus.</h2><p>Tell us what you want to achieve. We’ll help shape the right approach, scope and creative direction.</p><Link href="/contact">Start a conversation <span>↗</span></Link></div></section>
 </main></SiteLayout>
}
