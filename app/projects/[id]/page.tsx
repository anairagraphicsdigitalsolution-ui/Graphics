import Link from 'next/link';
import { notFound } from 'next/navigation';
import { seedProjects } from '@/lib/data';
import { supabase } from '@/lib/supabase';
export const revalidate=0;

export default async function ProjectDetail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  let project:any=seedProjects.find(p=>p.id===id);
  if(supabase){const {data}=await supabase.from('projects').select('*').eq('id',id).maybeSingle();if(data){const base=project||{};project={...base,...data,summary:data.summary||base.summary,description:data.description&&data.description.length>120?data.description:base.description,industry:data.industry||base.industry,role:data.role||base.role,challenge:data.challenge||base.challenge,solution:data.solution||base.solution,technologies:Array.isArray(data.technologies)&&data.technologies.length?data.technologies:base.technologies,key_features:Array.isArray(data.key_features)&&data.key_features.length?data.key_features:base.key_features,outcomes:Array.isArray(data.outcomes)&&data.outcomes.length?data.outcomes:base.outcomes,gallery_images:Array.isArray(data.gallery_images)&&data.gallery_images.length?data.gallery_images:base.gallery_images};}}
  if(!project)notFound();
  const rawLiveUrl=typeof project.live_url==='string'?project.live_url.trim():'';
  const liveUrl=rawLiveUrl
    ? (/^(https?:|mailto:|tel:)/i.test(rawLiveUrl)?rawLiveUrl:rawLiveUrl.startsWith('//')?`https:${rawLiveUrl}`:`https://${rawLiveUrl}`)
    : '';
  const kindLabel=project.kind==='product'?'ANAIRA PRODUCT':project.kind==='client-software'?'CLIENT SOFTWARE':project.kind==='website'?'WEBSITE CASE STUDY':'CREATIVE PROJECT';
  const gallery=Array.isArray(project.gallery_images)?project.gallery_images.filter(Boolean):[];
  const features=Array.isArray(project.key_features)?project.key_features:[];
  const outcomes=Array.isArray(project.outcomes)?project.outcomes:[];
  const technologies=Array.isArray(project.technologies)?project.technologies:[];
  const meta=[project.industry,project.project_year,project.duration].filter(Boolean);
  return <main className="project-detail-page">
    <header className="project-detail-nav"><Link className="project-brand" href="/">ANAIRA<span>.</span></Link><Link className="project-back" href="/portfolio">← All Projects</Link></header>
    <section className="project-detail-hero"><div className="project-detail-container">
      <div className="project-kicker">{kindLabel} <span>·</span> {project.category}</div>
      <h1>{project.title}</h1><p className="project-lead">{project.summary}</p>
      {meta.length>0&&<div className="project-meta">{project.industry&&<span><small>INDUSTRY</small>{project.industry}</span>}{project.project_year&&<span><small>YEAR</small>{project.project_year}</span>}{project.duration&&<span><small>DURATION</small>{project.duration}</span>}</div>}
      <div className="project-hero-actions">{liveUrl&&<a className="project-live-btn" href={liveUrl} target="_blank" rel="noopener noreferrer">Explore Live Project ↗</a>}<Link className="project-contact-btn" href="/contact">Discuss a Similar Project ↗</Link></div>
    </div></section>
    <section className="project-detail-container project-main">
      <div className="project-cover">{project.image_url?<img src={project.image_url} alt={`${project.title} project cover`}/>:<div className="project-cover-placeholder">{project.title}</div>}</div>
      <div className="project-overview-grid"><article><div className="project-section-kicker">THE PROJECT</div><h2>Overview</h2><p>{project.description||project.summary}</p></article><aside className="project-facts"><h3>Project Snapshot</h3>{project.client_name&&<div><small>CLIENT / BRAND</small><strong>{project.client_name}</strong></div>}{project.role&&<div><small>ANAIRA’S ROLE</small><strong>{project.role}</strong></div>}<div><small>PROJECT TYPE</small><strong>{project.category||kindLabel}</strong></div>{liveUrl&&<div><small>LIVE LINK</small><a href={liveUrl} target="_blank" rel="noopener noreferrer">Visit website ↗</a></div>}</aside></div>
      {(project.challenge||project.solution)&&<div className="project-two-column">{project.challenge&&<article><div className="project-section-kicker">01 / THE CHALLENGE</div><h2>The challenge</h2><p>{project.challenge}</p></article>}{project.solution&&<article><div className="project-section-kicker">02 / OUR APPROACH</div><h2>Our solution</h2><p>{project.solution}</p></article>}</div>}
      {features.length>0&&<section className="project-feature-section"><div className="project-section-kicker">WHAT’S INCLUDED</div><h2>Key features & capabilities</h2><div className="project-feature-grid">{features.map((x:string,i:number)=><div className="project-feature" key={i}><span>{String(i+1).padStart(2,'0')}</span><strong>{x}</strong></div>)}</div></section>}
      {gallery.length>0&&<section className="project-gallery-section"><div className="project-section-kicker">A CLOSER LOOK</div><h2>Project gallery</h2><div className="project-gallery-grid">{gallery.map((url:string,i:number)=><figure key={url}><img src={url} alt={`${project.title} gallery image ${i+1}`} loading="lazy"/><figcaption>{project.title} · {String(i+1).padStart(2,'0')}</figcaption></figure>)}</div></section>}
      {outcomes.length>0&&<section className="project-outcomes"><div><div className="project-section-kicker">DELIVERY</div><h2>What was delivered</h2></div><ul>{outcomes.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></section>}
      {technologies.length>0&&<section className="project-tech-section"><div className="project-section-kicker">THE TOOLKIT</div><h2>Technology & services</h2><div className="project-tech-list">{technologies.map((t:string)=><span key={t}>{t}</span>)}</div></section>}
      {project.testimonial&&<blockquote className="project-testimonial"><div className="project-section-kicker">CLIENT WORDS</div><p>“{project.testimonial}”</p>{project.client_name&&<cite>{project.client_name}</cite>}</blockquote>}
    </section>
    <section className="project-bottom-cta"><div className="project-detail-container"><div className="project-section-kicker">HAVE A PROJECT IN MIND?</div><h2>Let’s create something that works.</h2><p>Talk to Anaira about your next website, software or creative project.</p><Link href="/contact">Start a Conversation ↗</Link></div></section>
    <footer className="project-detail-footer"><Link href="/">ANAIRA GRAPHICS & DIGITAL SOLUTION</Link><Link href="/portfolio">Back to portfolio ↑</Link></footer>
  </main>;
}
