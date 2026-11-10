const fs=require('fs'),path=require('path');
const routes={
 'ads':'ads','ads-campaigns':'ads','ads-insights':'ads','ads-optimization':'ads','adsets':'ads','ad-creatives':'ads',
 'social-insights':'social_channels','youtube-analytics':'social_channels','youtube-status':'social_channels',
 'inbox':'ai_employee','email':'ai_employee','knowledge':'ai_employee','content':'social_channels'
};
let passed=0;
for(const [route,feature] of Object.entries(routes)){
 const p=path.join(process.cwd(),'app/api/growth',route,'route.ts');
 const s=fs.readFileSync(p,'utf8');
 const ok=s.includes('requireGrowthFeature')&&s.includes("'"+feature+"'");
 console.log(`${ok?'PASS':'FAIL'} ${route} route enforces ${feature} entitlement`);
 if(!ok)process.exitCode=1; if(ok)passed++;
}
console.log(`${passed}/${Object.keys(routes).length} expanded route entitlement checks passed`);
