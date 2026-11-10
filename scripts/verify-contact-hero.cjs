const fs=require('fs');
const contact=fs.readFileSync('app/contact/page.tsx','utf8');
const admin=fs.readFileSync('app/admin/page.tsx','utf8');
const shell=fs.readFileSync('components/site-shell.tsx','utf8');
const checks=[
 ['Contact page reads saved website settings',contact.includes("getPortfolioContent")&&contact.includes('settings.contact_hero_image')],
 ['Contact hero can be enabled or disabled',contact.includes('contact_hero_enabled!==false')],
 ['Contact hero uses editable eyebrow, heading and description',contact.includes('contact_hero_eyebrow')&&contact.includes('contact_hero_title')&&contact.includes('contact_hero_description')],
 ['Contact hero applies all saved text colours',contact.includes('eyebrowColor={settings.contact_hero_eyebrow_color}')&&contact.includes('titleColor={settings.contact_hero_title_color}')&&contact.includes('descriptionColor={settings.contact_hero_description_color}')],
 ['Contact hero applies saved overlay settings',contact.includes('overlayColor={settings.contact_hero_overlay_color}')&&contact.includes('contact_hero_overlay_opacity')],
 ['Contact hero applies saved image focal position',contact.includes('imagePosition={settings.contact_hero_image_position')&&shell.includes('backgroundPosition:imagePosition')],
 ['Admin has dedicated Contact Us Hero settings tab',admin.includes("['contacthero','Contact Us Hero']")&&admin.includes("settingsSection==='contacthero'")],
 ['Admin image upload uses existing Supabase portfolio-media helper',admin.includes('contact_hero_image')&&admin.includes('uploadImage(f)')],
 ['Admin preserves existing shared website settings on save',admin.includes("from('site_settings').upsert({id:'main',value:settings})")],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
