import {SiteLayout,PageHero} from '@/components/site-shell';
import {getPortfolioContent} from '@/lib/content';
export const revalidate=0;
const fallbackPlans=[
{plan:'Desktop 1 Year',tier:'Gold',mrp:7699,selling:4837,sale_day:4353},
{plan:'Desktop 1 Year',tier:'Vertical Pro',mrp:16999,selling:10619,sale_day:9557},
{plan:'Desktop 1 Year',tier:'Platinum',mrp:18999,selling:11799,sale_day:10619},
{plan:'Desktop 3 Year',tier:'Gold',mrp:17099,selling:10737,sale_day:8589},
{plan:'Desktop 3 Year',tier:'Vertical Pro',mrp:36999,selling:23363,sale_day:18690},
{plan:'Desktop 3 Year',tier:'Platinum',mrp:42999,selling:25959,sale_day:20767},
{plan:'Combo 1 Year',tier:'Gold',mrp:9099,selling:5663,sale_day:5097},
{plan:'Combo 1 Year',tier:'Vertical Pro',mrp:18999,selling:11799,sale_day:10619},
{plan:'Combo 1 Year',tier:'Platinum',mrp:23999,selling:14159,sale_day:12743},
{plan:'Combo 3 Year',tier:'Gold',mrp:18699,selling:11681,sale_day:9345},
{plan:'Combo 3 Year',tier:'Vertical Pro',mrp:42999,selling:25959,sale_day:20767},
{plan:'Combo 3 Year',tier:'Platinum',mrp:52999,selling:30679,sale_day:24543}
];
const money=(n:number)=>'₹'+Number(n||0).toLocaleString('en-IN');
export default async function VyaparPage(){
 const {settings}=await getPortfolioContent();
 const plans=Array.isArray(settings.vyapar_partner_plans)&&settings.vyapar_partner_plans.length?settings.vyapar_partner_plans:fallbackPlans;
 const certificate=settings.vyapar_partner_certificate_url||'/partners/vyapar-authorised-partner-certificate.jpg';
 const phone=settings.vyapar_partner_contact_phone||'+919736580084';
 const wa=phone.replace(/\D/g,'');
 const media=Array.isArray(settings.vyapar_partner_media)?settings.vyapar_partner_media.filter((item:any)=>item?.image_url):[];
 return <SiteLayout><main className="vyapar-page">
 <PageHero
  eyebrow={settings.vyapar_hero_eyebrow||"AUTHORISED PARTNER · KULLU"}
  title={settings.vyapar_hero_title||"Business billing, made beautifully simple."}
  description={settings.vyapar_hero_description||"Discover Vyapar billing and business management software with local guidance from Anaira Graphics & Digital Solution."}
  image={settings.vyapar_hero_image||undefined}
  eyebrowColor={settings.vyapar_hero_eyebrow_color||"#e7c879"}
  titleColor={settings.vyapar_hero_title_color||"#ffffff"}
  descriptionColor={settings.vyapar_hero_description_color||"#f0eee5"}
  overlayColor={settings.vyapar_hero_overlay_color||"#062b1e"}
  overlayOpacity={typeof settings.vyapar_hero_overlay_opacity==="number"?settings.vyapar_hero_overlay_opacity:78}
  imagePosition={settings.vyapar_hero_image_position||"center center"}
 />
 <section className="section vyapar-intro"><div className="container vyapar-intro-grid"><div><div className="vyapar-kicker">ANAIRA × VYAPAR</div><h2>{settings.vyapar_partner_title||'Authorised Vyapar Partner in Kullu'}</h2><p>{settings.vyapar_partner_intro||'Anaira Graphics & Digital Solution is an authorised Vyapar partner. We help local businesses explore billing and business management solutions.'}</p><div className="vyapar-proof"><span>✓ Partner certificate</span><span>✓ Kullu, Himachal Pradesh</span><span>✓ Plan guidance & enquiry</span></div><div className="vyapar-actions"><a className="btn" href="https://vyaparapp.in/?referrer_code=730DPKK" target="_blank" rel="sponsored noopener noreferrer">Buy Vyapar Online ↗</a><a className="vyapar-call" href={`https://wa.me/${wa}?text=${encodeURIComponent('Hello Anaira, I would like to enquire about Vyapar plans.')}`} target="_blank" rel="noreferrer">Enquire on WhatsApp ↗</a><a className="vyapar-call" href={`tel:${phone}`}>Call Anaira: {phone}</a></div></div><div className="vyapar-brand-card"><img className="vyapar-official-logo" src="/partners/vyapar-logo.png" alt="Vyapar logo"/><div><span>Billing & Business Management Software</span></div><small>Partner support by Anaira Graphics & Digital Solution</small></div></div></section>
 {media.length>0&&<section className="section vyapar-media"><div className="container"><div className="vyapar-section-head"><div><div className="eyebrow">LATEST FROM VYAPAR</div><h2>Product updates & promotions.</h2></div><p>Promotional material and product information shared by the Vyapar team.</p></div><div className="vyapar-media-grid">{media.map((item:any,i:number)=><article className="vyapar-media-card" key={item.id||i}><div className="vyapar-media-image"><img src={item.image_url} alt={item.title||"Vyapar promotional image"}/></div><div className="vyapar-media-copy"><div className="eyebrow">VYAPAR · ANAIRA</div><h3>{item.title||"Vyapar update"}</h3><p>{item.description||""}</p><a href="https://vyaparapp.in/?referrer_code=730DPKK" target="_blank" rel="sponsored noopener noreferrer">Explore Vyapar ↗</a></div></article>)}</div></div></section>}
 <section className="section vyapar-plans"><div className="container"><div className="vyapar-section-head"><div><div className="eyebrow">PLAN & PRICE REFERENCE</div><h2>Vyapar plan options.</h2></div><p>Pricing transcribed from the plan sheet supplied to Anaira. Confirm current availability, taxes and final payable amount with us before purchase.</p></div><div className="vyapar-table-wrap"><table className="vyapar-table"><thead><tr><th>Plan Name</th><th>Tier</th><th>MRP</th><th>Selling Price</th><th>Sale Day</th></tr></thead><tbody>{plans.map((p:any,i:number)=><tr key={`${p.plan}-${p.tier}-${i}`}><td>{p.plan}</td><td><span className={`vyapar-tier ${String(p.tier).toLowerCase().replaceAll(' ','-')}`}>{p.tier}</span></td><td>{money(p.mrp)}</td><td>{money(p.selling)}</td><td className="vyapar-sale">{money(p.sale_day)}</td></tr>)}</tbody></table></div><p className="vyapar-disclaimer">Prices are shown as provided in the supplied reference sheet. They may change and are not a live checkout quote. Please contact Anaira to confirm the applicable offer, taxes, licence terms and activation process.</p></div></section>
 <section className="section vyapar-certificate"><div className="container"><div className="vyapar-section-head"><div><div className="eyebrow">PARTNER CREDENTIAL</div><h2>Partner certificate.</h2></div><p>Certificate supplied by Anaira. The document states authorised partner status in Kullu, valid from 2026.</p></div><div className="vyapar-certificate-frame"><img src={certificate} alt="Vyapar certificate of partner issued to Anaira Graphics and Digital Solution, Kullu"/></div><div className="vyapar-certificate-caption">Anaira Graphics and Digital Solution · Kullu · Valid from 2026</div></div></section>
 <section className="section vyapar-final"><div className="container"><div><div className="eyebrow">NEED HELP CHOOSING A PLAN?</div><h2>Talk to your local Vyapar partner.</h2><p>Contact Anaira for plan details and assistance with your enquiry.</p></div><div className="vyapar-actions"><a className="btn" href="https://vyaparapp.in/?referrer_code=730DPKK" target="_blank" rel="sponsored noopener noreferrer">Buy Vyapar Online ↗</a><a className="vyapar-call" href={`https://wa.me/${wa}?text=${encodeURIComponent('Hello Anaira, please help me choose a Vyapar plan.')}`} target="_blank" rel="noreferrer">WhatsApp Enquiry ↗</a><a className="vyapar-call" href={`tel:${phone}`}>Call {phone}</a></div></div></section>
 </main></SiteLayout>
}
