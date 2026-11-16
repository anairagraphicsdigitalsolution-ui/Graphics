const fs=require('node:fs');
const api=fs.readFileSync('app/api/growth/command-actions/route.ts','utf8');
const ui=fs.readFileSync('components/growth-command-action-execution.tsx','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['learning summary is returned by Command Action API',api.includes('recommendationLearning')],
 ['feedback is grouped by action type',api.includes('learningGroups')&&api.includes('action.action_type')],
 ['positive neutral and negative counts are aggregated',api.includes("group[feedback.feedback_type]")&&api.includes("'positive'")&&api.includes("'neutral'")&&api.includes("'negative'")],
 ['positive feedback rate is calculated from observed sample',api.includes('positive_rate:')&&api.includes('g.positive / g.sample_size')],
 ['average rating excludes invalid and absent ratings',api.includes('Number.isInteger(feedback.rating)')&&api.includes('group.rating_total += feedback.rating')],
 ['minimum five distinct actions threshold is enforced',api.includes('g.distinct_action_ids.size >= 5')&&api.includes('distinct_actions: g.distinct_action_ids.size')],
 ['small independent action samples are marked insufficient',api.includes("'insufficient_sample'")&&api.includes('at least 5 distinct actions')],
 ['negative feedback majority recommends human review',api.includes('g.negative > g.positive')],
 ['learning window exposes hard limits and partial-history state',api.includes('learningWindow:')&&api.includes('bounded: true')&&api.includes('action_limit: 100')&&api.includes('feedback_limit: 250')&&api.includes('history_limited:')],
 ['API explicitly prevents automatic model or KPI claims',api.includes('No model training, automatic recommendation ranking changes')&&api.includes('revenue/KPI causality')],
 ['UI renders evidence counts and feedback rates',ui.includes('Positive rate:')&&ui.includes('feedback records')&&ui.includes('distinct_actions')],
 ['UI warns when bounded history reaches its cap',ui.includes('history_limited')&&ui.includes('LIMIT REACHED')],
 ['UI communicates evidence level and human review guidance',ui.includes('group.evidence_level')&&ui.includes('group.recommendation')],
 ['UI states no automatic model training',ui.includes('No automatic model training')],
 ['learning insights remain workspace API scoped',api.includes(".eq('organization_id', orgId)")&&api.includes("requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')")],
 ['release version is compatible and verifier registered',['6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version)&&pkg.scripts['verify:all'].includes('verify:growth-command-center-learning-v62100')]
];let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`${checks.length-fail}/${checks.length} Function 8 learning checks passed`);process.exitCode=fail?1:0;
