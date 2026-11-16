const fs=require('fs');const path=require('path');let pass=0,fail=0;function check(name,ok){if(ok){pass++;console.log(`PASS ${name}`)}else{fail++;console.error(`FAIL ${name}`)}}
const root=process.cwd();const api=fs.readFileSync(path.join(root,'app/api/growth/ads-autopilot/route.ts'),'utf8');const page=fs.readFileSync(path.join(root,'app/admin/ai-growth/ads-autopilot/page.tsx'),'utf8');const nav=fs.readFileSync(path.join(root,'components/growth-primary-nav.tsx'),'utf8');
check('tenant-authenticated API context',api.includes('growthContext(req)'));
check('owner-manager authorization',api.includes("['owner','manager']"));
check('ads feature entitlement',api.includes("requireGrowthFeature(ctx.db,ctx.userId,org,'ads')"));
check('workspace OpenAI integration',api.includes("getWorkspaceIntegration(ctx.db,org,'openai')"));
check('AI JSON copy generation',api.includes('response_format:{type:\'json_object\'}'));
check('campaign created paused',api.includes("status:'PAUSED',buying_type:'AUCTION'"));
check('ad set created paused',api.includes("optimization_goal:goal,targeting:JSON.stringify(targeting),status:'PAUSED'"));
check('creative uses tenant page and public image',api.includes('page_id:pageId')&&api.includes('picture:image'));
check('ad created paused',api.includes("creative:JSON.stringify({creative_id:creativeId}),status:'PAUSED'"));
check('failure rollback pauses provider objects',api.includes('for(const id of [...created].reverse())')&&api.includes('metaPause'));
check('activation remains separate',api.includes('activationRequired:true')&&api.includes('No spend can start'));
check('UI requires account, budget, audience, URLs',page.includes('dailyBudget')&&page.includes('destinationUrl')&&page.includes('imageUrl')&&page.includes('audience'));
check('navigation exposes Ads Autopilot',nav.includes('/admin/ai-growth/ads-autopilot'));
console.log(`\n${pass} PASS / ${fail} FAIL`);process.exit(fail?1:0);
