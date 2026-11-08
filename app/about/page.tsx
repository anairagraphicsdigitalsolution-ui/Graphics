import Link from "next/link";
import {SiteLayout} from "@/components/site-shell";
import {getPortfolioContent} from "@/lib/content";
import {aboutDefaults as defaults} from "@/lib/about-content";

export default async function AboutPage(){
 const {settings}=await getPortfolioContent();
 const d={...defaults,...(settings?.about_page||{})};
 const values=Array.isArray(d.values)?d.values:defaults.values;
 const milestones=Array.isArray(d.milestones)?d.milestones:defaults.milestones;
 return <SiteLayout><main className="about-premium">
  <section className="about-premium-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(4,31,22,.94),rgba(4,31,22,.76) 48%,rgba(4,31,22,.28)),url("${d.heroImage}")`}}>
   <div className="container about-premium-hero-inner"><span className="about-premium-kicker">{d.eyebrow}</span><h1>{d.title}</h1><p>{d.description}</p><div className="about-hero-bottom"><Link href="/contact">Let’s work together <span>↗</span></Link><small>CREATIVE · DIGITAL · TECHNOLOGY</small></div></div>
   <div className="about-hero-mark">A<span>.</span></div>
  </section>
  <section className="about-premium-story section"><div className="container about-story-grid"><div className="about-story-visual"><img src={d.storyImage} alt="Anaira creative studio and design work"/><span>ANAIRA GRAPHICS & DIGITAL SOLUTION</span></div><div className="about-story-copy"><span className="about-premium-kicker">WHO WE ARE</span><h2>{d.storyTitle}</h2><p>{d.story}</p><p>{d.story2}</p><div className="about-founded"><strong>2013</strong><span>Established in Kullu, Himachal Pradesh<br/>Serving creative and technology needs</span></div></div></div></section>
  <section className="about-mission section"><div className="container about-mission-grid"><article><span>01 / OUR MISSION</span><h2>{d.missionTitle}</h2><p>{d.mission}</p></article><article><span>02 / OUR VISION</span><h2>{d.visionTitle}</h2><p>{d.vision}</p></article></div></section>
  <section className="about-values-premium section"><div className="container"><div className="about-section-heading"><div><span className="about-premium-kicker">WHAT GUIDES OUR WORK</span><h2>Principles behind every project.</h2></div><p>We bring care, clarity and practical thinking to every collaboration — regardless of its size or discipline.</p></div><div className="about-value-grid">{values.map((v:any,i:number)=><article key={i}><span>{String(i+1).padStart(2,"0")}</span><h3>{v.title}</h3><p>{v.desc}</p></article>)}</div></div></section>
  <section className="about-journey section"><div className="container"><div className="about-section-heading"><div><span className="about-premium-kicker">OUR JOURNEY</span><h2>Built over time. Ready for what’s next.</h2></div><p>From creative foundations to connected business technology, our journey reflects the changing needs of the businesses we work with.</p></div><div className="about-timeline">{milestones.map((m:any,i:number)=><article key={i}><span>{m.year}</span><div><h3>{m.title}</h3><p>{m.desc}</p></div></article>)}</div></div></section>
  <section className="about-capabilities"><div className="container about-cap-inner"><span className="about-premium-kicker">ONE CONNECTED PARTNER</span><h2>Creative thinking. Digital reach. Technology that works.</h2><p>Explore the capabilities that help us bring complete solutions together for your business.</p><div className="about-cap-links"><Link href="/creative">Creative Studio ↗</Link><Link href="/social-media">Social Media ↗</Link><Link href="/advertising">Advertising ↗</Link><Link href="/digital-growth">SEO & Growth ↗</Link><Link href="/websites">Websites ↗</Link><Link href="/software">Software ↗</Link></div></div></section>
  <section className="about-final-cta"><div className="container"><div><span className="about-premium-kicker">LET’S START A CONVERSATION</span><h2>Have an idea worth building?</h2><p>Tell us where you want to go. We’ll help you shape the next step.</p></div><Link href="/contact">Discuss your project <span>↗</span></Link></div></section>
 </main></SiteLayout>
}
