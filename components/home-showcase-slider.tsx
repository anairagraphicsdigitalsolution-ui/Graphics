"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
type Slide={url:string,title?:string,subtitle?:string,alt?:string,href?:string,buttonText?:string};
export default function HomeShowcaseSlider({settings}:{settings:any}){
 const slides:Slide[]=Array.isArray(settings.home_showcase_slides)?settings.home_showcase_slides.filter((s:Slide)=>s?.url):[];
 const [active,setActive]=useState(0);
 const [direction,setDirection]=useState<"next"|"prev">("next");
 const transition=String(settings.home_showcase_transition||"fade");
 const changeTo=(next:number,dir:"next"|"prev"="next")=>{setDirection(dir);setActive(next);};
 useEffect(()=>{if(slides.length<2||settings.home_showcase_autoplay===false)return;const timer=window.setInterval(()=>{setDirection("next");setActive(v=>(v+1)%slides.length);},Math.max(2500,Number(settings.home_showcase_interval||5000)));return()=>window.clearInterval(timer)},[slides.length,settings.home_showcase_autoplay,settings.home_showcase_interval]);
 if(!slides.length)return null;
 const slide=slides[active]||slides[0];
 return <section className="home-showcase-slider" aria-label="Featured work and creative showcase">
  <div className="home-showcase-heading container"><span>ANAIRA SHOWCASE</span><h2>{settings.home_showcase_heading||"Ideas brought to life."}</h2><p>{settings.home_showcase_intro||"A closer look at the creative, digital and technology work we bring together."}</p></div>
  <div className={`home-showcase-frame transition-${transition} direction-${direction}`} style={{"--showcase-transition-ms":`${Math.max(300,Math.min(2000,Number(settings.home_showcase_transition_speed||900)))}ms`} as any}>
   {slides.map((s,i)=><div key={`${s.url}-${i}`} className={`home-showcase-slide ${i===active?"is-active":""}`} aria-hidden={i!==active}>
    <img src={s.url} alt={s.alt||s.title||`Anaira showcase ${i+1}`} />
    <div className="home-showcase-shade" style={{opacity:Number(settings.home_showcase_overlay??42)/100,background:`linear-gradient(90deg,${settings.home_showcase_overlay_color||"#061b13"} 0%,transparent 78%)`}}/>
    {(s.title||s.subtitle||s.href)&&<div className="home-showcase-caption"><span>{String(i+1).padStart(2,"0")} / {String(slides.length).padStart(2,"0")}</span>{s.title&&<h3>{s.title}</h3>}{s.subtitle&&<p>{s.subtitle}</p>}{s.href&&<Link href={s.href}>{s.buttonText||"Explore"} ↗</Link>}</div>}
   </div>)}
   {slides.length>1&&<><button className="home-showcase-arrow prev" type="button" onClick={()=>changeTo((active-1+slides.length)%slides.length,"prev")} aria-label="Previous slide">‹</button><button className="home-showcase-arrow next" type="button" onClick={()=>changeTo((active+1)%slides.length,"next")} aria-label="Next slide">›</button><div className="home-showcase-dots">{slides.map((s,i)=><button key={i} type="button" aria-label={`Go to slide ${i+1}`} aria-current={active===i} className={active===i?"active":""} onClick={()=>changeTo(i,i<active?"prev":"next")}/>)}</div></>}
  </div>
 </section>
}
