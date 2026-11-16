const fs=require('node:fs');
const api=fs.readFileSync('app/api/growth/command-actions/route.ts','utf8');
const ui=fs.readFileSync('components/growth-command-action-execution.tsx','utf8');
const sql=fs.readFileSync('supabase/migrations/20261116093000_growth_command_action_governance_v62200.sql','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['review decision uses a database transaction RPC',api.includes("rpc('review_growth_command_action'")],
 ['self-review is rejected in the API',api.includes('action.created_by === ctx.userId')],
 ['self-review is independently rejected in SQL',sql.includes('v_action.created_by = p_actor_id')],
 ['rejection requires a non-empty reason',api.includes("operation === 'reject' && !reviewNote")&&sql.includes("p_decision = 'reject' and (v_note is null")],
 ['approval rationale is persisted',sql.includes('approval_note = case when p_decision')],
 ['rejection reason is persisted',sql.includes('rejection_reason = case when p_decision')],
 ['reviewer identity and timestamp are persisted',sql.includes('reviewed_by = p_actor_id')&&sql.includes('reviewed_at = now()')],
 ['review decision and audit event share one transaction',sql.includes('insert into public.growth_platform_audit_events')&&sql.includes('update public.growth_command_actions')],
 ['review RPC locks the proposal row',sql.includes('for update')],
 ['review RPC is not callable by anon or authenticated roles',sql.includes('revoke all on function public.review_growth_command_action')&&sql.includes('to service_role')],
 ['GET exposes review metadata',api.includes('reviewed_by,reviewed_at,approval_note,rejection_reason')],
 ['UI captures review note and requires reason before reject',ui.includes('Review note / rejection reason')&&ui.includes('!reviewNotes[item.id]?.trim()')],
 ['UI prevents proposer from using review controls',ui.includes('item.created_by===currentUserId')],
 ['UI displays approval and rejection rationale',ui.includes('item.approval_note')&&ui.includes('item.rejection_reason')],
 ['migration constrains rationale lengths',sql.includes('char_length(approval_note) <= 1200')&&sql.includes('char_length(rejection_reason) between 1 and 1200')],
 ['workspace role and CRM entitlement checks remain enforced',api.includes("requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner','manager'])")&&api.includes("requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')")],
 ['release version and full verifier registration are current',['6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version),'6.119.0'&&pkg.scripts['verify:all'].includes('verify:growth-command-center-governance-v62200')]
];let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`${checks.length-fail}/${checks.length} Function 9 governance checks passed`);process.exitCode=fail?1:0;
