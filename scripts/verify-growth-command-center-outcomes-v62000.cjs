const fs=require('node:fs');
const api=fs.readFileSync('app/api/growth/command-actions/route.ts','utf8');
const ui=fs.readFileSync('components/growth-command-action-execution.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261117034628_growth_command_action_feedback_v62000.sql','utf8');
const checks=[
 ['outcome API remains workspace-scoped',api.includes(".eq('organization_id', orgId)")],
 ['linked CRM task status is loaded from source of truth',api.includes("from('growth_tasks').select('id,status,completed_at,updated_at')")],
 ['only tasks linked to executed actions are tracked',api.includes("action.status !== 'executed'")&&api.includes("action.result?.task_id")],
 ['task lookup is tenant scoped',api.includes(".eq('id', taskId).eq('organization_id', orgId)")],
 ['feedback types are allow-listed',api.includes("['positive','negative','neutral']")],
 ['rating is constrained to integer 1..5',api.includes('rating < 1 || rating > 5')],
 ['feedback notes are length bounded',api.includes("slice(0,1200)")],
 ['feedback rows include organization/action/task/actor',migration.includes('organization_id uuid not null')&&migration.includes('action_id uuid not null')&&migration.includes('task_id uuid not null')&&migration.includes('created_by uuid not null')],
 ['feedback table has constrained values',migration.includes("('positive','negative','neutral')")&&migration.includes('rating between 1 and 5')],
 ['feedback table is protected by RLS and service role grants',migration.includes('enable row level security')&&migration.includes('revoke all')&&migration.includes('to service_role')],
 ['audit event is written for feedback',api.includes('growth.command_action.feedback_recorded')],
 ['task outcome status is exposed in action history',api.includes('task_outcome:')&&api.includes('outcomes, governancePerformance')&&api.includes('outcomeAttribution')],
 ['UI displays actual linked task status',ui.includes('Task outcome:')&&ui.includes('item.task_outcome?.status')],
 ['UI records positive, neutral and negative feedback',ui.includes("submitFeedback(item.id,'positive')")&&ui.includes("submitFeedback(item.id,'neutral')")&&ui.includes("submitFeedback(item.id,'negative')")],
 ['UI displays feedback history',ui.includes('item.feedback?.slice(0,3)')],
 ['UI explicitly avoids unsupported KPI causality claims',ui.includes('revenue/KPI impact is not attributed automatically')],
 ['CRM entitlement is enforced for outcome reads',api.includes("requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')")],
 ['release is registered in verify:all',fs.readFileSync('package.json','utf8').includes('verify:growth-command-center-outcomes-v62000')]
];let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`${checks.length-fail}/${checks.length} Function 7 outcome checks passed`);process.exitCode=fail?1:0;
