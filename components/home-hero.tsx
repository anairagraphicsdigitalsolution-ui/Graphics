"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Slide = { url: string; alt?: string };
type Props = { settings: any };
export default function HomeHero({settings}:Props) {
  const slides:Slide[] = Array.isArray(settings.hero_slides) && settings.hero_slides.length
    ? settings.hero_slides.filter((x:any)=>x?.url) : (settings.hero_image_url ? [{url:settings.hero_image_url}] : []);
  const [index,setIndex]=useState(0);
  const [paused,setPaused]=useState(false);
  const effect=settings.hero_transition || "fade";
  const interval=Math.max(2500,Number(settings.hero_interval)||6000);
  const [tick,setTick]=useState(0);
  useEffect(()=>{ if(slides.length<2 || paused || settings.hero_autoplay===false) return;
    const id=window.setInterval(()=>{setIndex(v=>(v+1)%slides.length);setTick(v=>v+1)},interval);
    return ()=>window.clearInterval(id);
  },[slides.length,paused,interval,settings.hero_autoplay]);
  const overlay=settings.hero_overlay_color||"#061b13";
  const overlayEnabled=settings.hero_overlay_enabled!==false;
  const opacity=Math.min(0.95,Math.max(0,Number(settings.hero_overlay_opacity??72)/100));
  const heroBackground=settings.hero_background_color||"#f1eadb";
  const titleColor=settings.hero_title_color||"#ffffff";
  const accentColor=settings.hero_accent_color||"#e3b23c";
  const bodyColor=settings.hero_body_color||"#f1eadb";
  const eyebrowColor=settings.hero_eyebrow_color||accentColor;
  const metaColor=settings.hero_meta_color||"#f1eadb";
  const primaryButtonBg=settings.hero_primary_button_bg||"#e3b23c";
  const primaryButtonText=settings.hero_primary_button_text||"#102017";
  const secondaryButtonText=settings.hero_secondary_button_text||"#ffffff";
  const pos=settings.hero_image_position||"center center";
  const fit=settings.hero_image_fit||"cover";
  const title1=settings.hero_title_line1||"We Build";
  const accent1=settings.hero_title_accent1||"Brands.";
  const title2=settings.hero_title_line2||"We Build";
  const accent2=settings.hero_title_accent2||"Technology.";
  return <section className={`hero home-hero hero-effect-${effect}`} style={{backgroundColor:heroBackground}} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
    <div className="hero-slides" aria-hidden="true" style={{backgroundColor:heroBackground}}>
      {slides.map((slide,i)=><div key={`${slide.url}-${i}`} className={`hero-slide ${i===index?"is-active":""}`} style={{backgroundImage:`url("${slide.url}")`,backgroundPosition:pos,backgroundSize:fit,transitionDuration:effect==="fade"?"900ms":"650ms"}}/>)}
      {overlayEnabled&&<><div className="hero-overlay" style={{backgroundColor:overlay,opacity}}/><div className="hero-tint" /></>}
    </div>
    <div className="container hero-content">
      <div className="eyebrow" style={{color:eyebrowColor}}>{settings.hero_location||"ESTABLISHED 2013 · KULLU, HIMACHAL PRADESH"}</div>
      <h1 style={{color:titleColor}}>{title1} <em style={{color:accentColor}}>{accent1}</em><br/>{title2} <em style={{color:accentColor}}>{accent2}</em></h1>
      <p style={{color:bodyColor}}>{settings.hero_description||"One creative and technology partner for graphic design, social media management, advertising, websites and business software."}</p>
      <div className="hero-actions"><Link className="btn" style={{backgroundColor:primaryButtonBg,borderColor:primaryButtonBg,color:primaryButtonText}} href="/portfolio">{settings.primary_cta||"Explore Our Work"} ↗</Link><Link className="btn outline" style={{color:secondaryButtonText,borderColor:secondaryButtonText}} href="/contact">{settings.secondary_cta||"Discuss a Project"}</Link></div>
      <div className="hero-meta" style={{color:metaColor}}><div><strong>{settings.hero_stat_1_value||"2013"}</strong>{settings.hero_stat_1_label||"Established"}</div><div><strong>{settings.hero_stat_2_value||"Creative + Tech"}</strong>{settings.hero_stat_2_label||"One partner"}</div><div><strong>{settings.hero_stat_3_value||"End-to-End"}</strong>{settings.hero_stat_3_label||"Digital solutions"}</div></div>
    </div>
    {slides.length>1&&<><div className="hero-controls"><button type="button" aria-label="Previous slide" onClick={()=>setIndex(v=>(v-1+slides.length)%slides.length)}>‹</button><span>{String(index+1).padStart(2,"0")} / {String(slides.length).padStart(2,"0")}</span><button type="button" aria-label="Next slide" onClick={()=>setIndex(v=>(v+1)%slides.length)}>›</button></div><div className="hero-dots">{slides.map((_,i)=><button key={i} type="button" aria-label={`Go to slide ${i+1}`} className={i===index?"active":""} onClick={()=>setIndex(i)}/>)}</div></>}
  </section>;
}
