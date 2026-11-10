const fs=require('fs');
const page=fs.readFileSync('app/websites/page.tsx','utf8');
const admin=fs.readFileSync('app/admin/page.tsx','utf8');
const checks=[
 ['Website hero eyebrow colour is connected',/eyebrowColor=\{settings\.website_hero_eyebrow_color\}/.test(page)],
 ['Website hero heading colour is connected',/titleColor=\{settings\.website_hero_title_color\}/.test(page)],
 ['Website hero description colour is connected',/descriptionColor=\{settings\.website_hero_description_color\}/.test(page)],
 ['Website hero overlay settings are connected',/overlayColor=\{settings\.website_hero_overlay_color\}/.test(page)&&/overlayOpacity=\{settings\.website_hero_overlay_opacity\}/.test(page)],
 ['Website hero image position is connected',/imagePosition=\{settings\.website_hero_image_position/.test(page)],
 ['Admin exposes Website Page Hero controls',/Website Page Hero/.test(admin)],
 ['Admin exposes text colour controls',/Main heading/.test(admin)&&/Description/.test(admin)&&/Eyebrow text/.test(admin)],
 ['Admin exposes overlay controls',/Hero Image Overlay/.test(admin)]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(checks.some(x=>!x[1])) process.exit(1);
console.log(`\n${checks.length}/${checks.length} website page hero checks passed`);
