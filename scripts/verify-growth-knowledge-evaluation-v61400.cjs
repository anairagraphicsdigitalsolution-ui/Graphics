'use strict';
const fs=require('node:fs');
const route=fs.readFileSync('app/api/growth/knowledge/evaluate/route.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20261116060933_growth_knowledge_ocr_and_evaluation_v61400.sql','utf8');
const checks=[
 ['evaluation endpoint is authenticated POST',route.includes('export async function POST')&&route.includes('growthContext(req)')],
 ['owner and manager role required',route.includes("['owner', 'manager']")],
 ['AI employee entitlement enforced',route.includes("'ai_employee'")],
 ['test cases bounded to 20',route.includes('cases.slice(0, 20)')],
 ['expected documents validated within tenant',route.includes(".eq('organization_id', organizationId).in('id', allExpected)")],
 ['retrieval uses tenant-scoped shared engine',route.includes('retrieveKnowledgeChunks(ctx.db, organizationId, item.query, 8)')],
 ['hit rate metric computed',route.includes('hitRateAt8')],
 ['mean reciprocal rank computed',route.includes('meanReciprocalRankAt8')],
 ['recall at 8 computed',route.includes('meanRecallAt8')&&route.includes('recallAt8')],
 ['evaluation audit history persisted',route.includes('growth_knowledge_retrieval_evaluations')&&route.includes('test_cases: results')],
 ['evaluation table has tenant index and RLS',migration.includes('growth_knowledge_retrieval_evaluations_org_created_idx')&&migration.includes('enable row level security')],
 ['evaluation table inaccessible to client roles',migration.includes('revoke all on public.growth_knowledge_retrieval_evaluations from anon,authenticated')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}console.log(`\n${checks.length-failed} PASS / ${failed} FAIL`);if(failed)process.exit(1);
