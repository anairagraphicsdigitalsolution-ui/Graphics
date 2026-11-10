const fs=require('fs');
const software=fs.readFileSync('app/software/page.tsx','utf8');
const admin=fs.readFileSync('app/admin/page.tsx','utf8');
const shell=fs.readFileSync('components/site-shell.tsx','utf8');
const checks=[
 ['Software PageHero receives saved eyebrow colour',software.includes('eyebrowColor={settings.software_hero_eyebrow_color')],
 ['Software PageHero receives saved heading colour',software.includes('titleColor={settings.software_hero_title_color')],
 ['Software PageHero receives saved description colour',software.includes('descriptionColor={settings.software_hero_description_color')],
 ['Software PageHero receives saved overlay controls',software.includes('overlayColor={settings.software_hero_overlay_color')&&software.includes('overlayOpacity={settings.software_hero_overlay_opacity')],
 ['PageHero renders inline text colours',shell.includes('eyebrowColor?{color:eyebrowColor}')&&shell.includes('titleColor?{color:titleColor}')&&shell.includes('descriptionColor?{color:descriptionColor}')],
 ['Studio updates merge defaults and prior saved fields',admin.includes('{...(studioDefaults[page.key]||{}),...(v[key]||{}),...patch}')],
 ['Ads, Creative and SEO settings remain in Studio page list',admin.includes('key:"advertising"')&&admin.includes('key:"seo"')&&admin.includes('key:"creative"')],
 ['Website Settings save persists merged settings object',admin.includes("from('site_settings').upsert({id:'main',value:settings})")]
];
for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} hero colour checks passed`);
