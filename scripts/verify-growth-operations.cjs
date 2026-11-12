const fs=require('fs');const path=require('path');
const checks=[
 ['promotion API', 'app/api/growth/promotion/route.ts', ['requireGrowthRole','https:','growth_promotion_links']],
 ['public redirect', 'app/r/[slug]/route.ts', ['record_growth_promotion_click','NextResponse.redirect','SUPABASE_SERVICE_ROLE_KEY']],
 ['readiness API', 'app/api/growth/readiness/route.ts', ['whatsapp_calling','certification','growth_automation_rules']],
 ['Phase 29 migration', 'supabase/migrations/20261111150000_growth_promotion_links_phase29.sql', ['growth_promotion_links','growth_promotion_clicks','record_growth_promotion_click','service_role']],
 ['Growth Intelligence UI', 'components/growth-intelligence.tsx', ['Website & Product Promotion Links','Platform Operations Readiness','createPromotion']],
 ['Meta activation persistence rollback', 'app/api/growth/ad-activation/route.ts', ['persistenceErrors','rollbackStatus','persistence_errors','Ads controls are not included']],
];let failed=0;for(const [name,file,needles] of checks){const full=path.join(process.cwd(),file);const content=fs.existsSync(full)?fs.readFileSync(full,'utf8'):'';const missing=needles.filter(x=>!content.includes(x));if(missing.length){failed++;console.error('FAIL',name,'missing:',missing.join(', '));}else console.log('PASS',name);}if(failed)process.exit(1);console.log(`Growth operations verification: ${checks.length}/${checks.length} passed`);
