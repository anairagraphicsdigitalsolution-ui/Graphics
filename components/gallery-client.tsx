 'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
type GalleryItem={id?:string;url:string;title?:string;caption?:string;category?:string;alt?:string;featured?:boolean};
export default function GalleryClient({settings}:{settings:any}){
 const images:GalleryItem[]=Array.isArray(settings.gallery_images)?settings.gallery_images.filter((x:any)=>x&&x.url):[];
 const [category,setCategory]=useState('All');
 const [active,setActive]=useState<number|null>(null);
 const categories=useMemo(()=>['All',...Array.from(new Set(images.map(x=>x.category||'Other')))], [images]);
 const visible=useMemo(()=>{const rows=images.map((x,i)=>({...x,_index:i}));const filtered=category==='All'?rows:rows.filter(x=>(x.category||'Other')===category);return settings.gallery_show_featured_first===false?filtered:filtered.sort((a,b)=>Number(!!b.featured)-Number(!!a.featured));},[images,category,settings.gallery_show_featured_first]);
 const current=active===null?null:images[active];
 function move(delta:number){if(active===null||images.length<2)return;setActive((active+delta+images.length)%images.length);}
 useEffect(()=>{
  if(active===null)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setActive(null);if(event.key==='ArrowLeft')move(-1);if(event.key==='ArrowRight')move(1);};
  document.addEventListener('keydown',onKey);
  document.body.style.overflow='hidden';
  return ()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow='';};
 },[active,images.length]);
 return <main className="gallery-page" style={{'--gallery-bg':settings.gallery_background||'#f4f0e6','--gallery-accent':settings.gallery_accent||'#d7b76d'} as React.CSSProperties}>
  <div className="gallery-topbar">
   <Link className="gallery-back" href="/"><span aria-hidden="true">←</span><span><small>RETURN TO</small><strong>Home</strong></span></Link>
   <div className="gallery-brandmark"><span className="gallery-brand-symbol">A</span><span>ANAIRA <small>CREATIVE ARCHIVE</small></span></div>
   <Link className="gallery-top-link" href="/contact">Start a project <span aria-hidden="true">↗</span></Link>
  </div>
  <section className="gallery-intro"><div className="gallery-intro-overline"><span/> CURATED COLLECTION · EST. 2013 <span/></div><div className="gallery-kicker">{settings.gallery_eyebrow||'THE ANAIRA GALLERY'}</div><h1>{settings.gallery_title||'A visual collection of our work.'}</h1><p>{settings.gallery_intro||'A curated look at the ideas, identities and digital experiences created by Anaira.'}</p><div className="gallery-intro-rule"><span/></div><div className="gallery-count"><strong>{String(images.length).padStart(2,'0')}</strong> <span>SELECTED VISUALS</span><i/></div></section>
  {settings.gallery_enable_filters!==false&&images.length>0&&<nav className="gallery-filters" aria-label="Filter gallery">{categories.map(x=><button key={x} type="button" className={category===x?'active':''} onClick={()=>setCategory(x)}>{x}</button>)}</nav>}
  {images.length===0?<section className="gallery-empty"><div className="gallery-empty-mark">✳</div><h2>Something beautiful is being curated.</h2><p>New work will appear here soon. Visit again to explore the Anaira collection.</p></section>:<section className={`gallery-wall ${settings.gallery_layout==='uniform'?'is-uniform':'is-masonry'}`} style={{'--gallery-cols':Math.max(2,Math.min(4,Number(settings.gallery_columns_desktop)||3)),'--gallery-mobile-cols':Math.max(1,Math.min(2,Number(settings.gallery_columns_mobile)||2))} as React.CSSProperties}>
   {visible.map((item:any,index:number)=><button type="button" className={`gallery-card ${item.featured?'is-featured':''}`} key={item.id||item.url} onClick={()=>setActive(item._index)} aria-label={`View ${item.title||'gallery image'}`}><span className="gallery-image-wrap"><img src={item.url} alt={item.alt||item.title||'Anaira creative work'} loading={index<6?'eager':'lazy'}/><span className="gallery-image-overlay"><span>EXPLORE THE WORK</span><b>↗</b></span><span className="gallery-card-index">{String(index+1).padStart(2,'0')}</span></span>{settings.gallery_show_captions!==false&&<span className="gallery-card-copy"><span>{item.category||'Selected Work'}</span><strong>{item.title||'Untitled'}</strong>{item.caption&&<small>{item.caption}</small>}</span>}</button>)}
  </section>}
  <section className="gallery-bottom"><div className="gallery-bottom-ornament">✳</div><span>DESIGN · DIGITAL · TECHNOLOGY</span><h2>Good work deserves<br/>a great story.</h2><p>Have an idea waiting to take shape? Let’s make it unforgettable.</p><a href="/contact">Discuss your project <b>↗</b></a><small>ANAIRA GRAPHICS &amp; DIGITAL SOLUTION · EST. 2013</small></section>
  {current&&<div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Gallery image viewer" onClick={()=>setActive(null)}><div className="gallery-lightbox-top"><span>ANAIRA <small>VISUAL ARCHIVE</small></span><span>{String((active??0)+1).padStart(2,'0')} <i>/</i> {String(images.length).padStart(2,'0')}</span></div><button type="button" className="gallery-lightbox-close" onClick={()=>setActive(null)} aria-label="Close viewer"><span>×</span><small>ESC</small></button><button type="button" className="gallery-lightbox-prev" onClick={e=>{e.stopPropagation();move(-1)}} aria-label="Previous image">‹</button><figure onClick={e=>e.stopPropagation()}><img src={current.url} alt={current.alt||current.title||'Gallery image'}/><figcaption><span>{current.category}</span><strong>{current.title}</strong>{current.caption&&<small>{current.caption}</small>}</figcaption></figure><button type="button" className="gallery-lightbox-next" onClick={e=>{e.stopPropagation();move(1)}} aria-label="Next image">›</button><div className="gallery-lightbox-hint">USE ← → TO EXPLORE <span>·</span> ESC TO CLOSE</div></div>}
 </main>;
}
