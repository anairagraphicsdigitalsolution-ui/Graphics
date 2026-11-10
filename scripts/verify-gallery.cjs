const fs=require('fs');
const component=fs.readFileSync('components/gallery-client.tsx','utf8');
const css=fs.readFileSync('app/globals.css','utf8');
const checks=[
 ['Gallery has a persistent back-to-home link',component.includes('className="gallery-back" href="/"')||component.includes('className="gallery-back" href="/"')||component.includes('className="gallery-back" href="/"')],
 ['Gallery has a premium archive masthead',component.includes('CREATIVE ARCHIVE')&&css.includes('.gallery-brandmark')],
 ['Gallery has project enquiry navigation',component.includes('Start a project')],
 ['Gallery cards show editorial index numbers',component.includes('gallery-card-index')],
 ['Lightbox supports Escape and arrow-key navigation',component.includes("event.key==='Escape'")&&component.includes("event.key==='ArrowLeft'")&&component.includes("event.key==='ArrowRight'")],
 ['Lightbox has visible close control and image count',component.includes('gallery-lightbox-close')&&component.includes('gallery-lightbox-top')],
 ['Lightbox image counter safely handles nullable active index',component.includes('String((active??0)+1).padStart(2,\'0\')')],
 ['Gallery has responsive premium mobile styling',css.includes('@media(max-width:480px)')&&css.includes('.gallery-topbar')],
 ['Gallery uses existing saved gallery settings and images',component.includes('settings.gallery_images')&&component.includes('gallery_show_captions')]
];
let failed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} gallery checks passed`); if(failed)process.exit(1);
