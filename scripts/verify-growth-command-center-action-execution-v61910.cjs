const fs=require('node:fs');
const api=fs.readFileSync('app/api/growth/command-actions/route.ts','utf8');
const ui=fs.readFileSync('components/growth-command-action-execution.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261116082000_growth_command_action_atomic_execution_v61910.sql','utf8');
const rejectionMigration=fs.readFileSync('supabase/migrations/20261116082100_growth_command_action_rejection_audit_v61911.sql','utf8');
const governanceMigration=fs.readFileSync('supabase/migrations/20261117034519_growth_command_action_governance_v62200.sql','utf8');
const externalMigration=fs.readFileSync('supabase/migrations/20261117043000_growth_command_center_external_actions_v62900.sql','utf8');
const checks=[
 ['execution ledger is workspace-scoped',api.includes(".eq('organization_id', orgId)")&&migration.includes('where id = p_action_id and organization_id = p_organization_id')],
 ['internal task action remains supported alongside external communications',migration.includes("'other', 'open'")&&api.includes("actionType === 'create_task'")&&externalMigration.includes("'create_task','send_email','send_whatsapp'")],
 ['proposal begins pending approval',api.includes("status: 'pending_approval'")],
 ['proposal requires owner or manager',api.includes("['owner','manager']")],
 ['approval and rejection require pending state',api.includes("action.status !== 'pending_approval'")],
 ['rejection actor/time are stored separately from approval',rejectionMigration.includes('add column if not exists rejected_by')&&rejectionMigration.includes('add column if not exists rejected_at')&&governanceMigration.includes('rejected_by = case')&&governanceMigration.includes('rejected_at = case')],
 ['execution requires approved state',migration.includes("v_action.status <> 'approved'")],
 ['execution locks the action row transactionally',migration.includes('for update')],
 ['task idempotency uses unique workflow_step_key',migration.includes('workflow_step_key')&&migration.includes('on conflict (organization_id, workflow_step_key) do nothing')],
 ['task and action transition occur in one database function',migration.includes('insert into public.growth_tasks')&&migration.includes('update public.growth_command_actions')],
 ['already executed retry returns existing task',migration.includes("v_action.status = 'executed'")&&migration.includes("'already_executed', true")],
 ['RPC is service-role only',migration.includes('security invoker')&&migration.includes('revoke all on function')&&migration.includes('to service_role')],
 ['API calls atomic RPC',api.includes("rpc('execute_growth_command_action'")],
 ['execution writes audit event',api.includes("growth.command_action.executed")],
 ['unapproved ad spend, publishing and payments remain excluded',ui.includes('Ads, payments and public publishing remain outside this execution path')&&externalMigration.includes("'send_email','send_whatsapp'")],
 ['UI supports propose, approve, reject and execute',ui.includes('Propose action for approval')&&ui.includes("act(item.id,'approve')")&&ui.includes("act(item.id,'reject')")&&ui.includes("act(item.id,'execute')")],
 ['UI is mounted in Command Center',fs.readFileSync('components/growth-command-center.tsx','utf8').includes('GrowthCommandActionExecution')],
 ['release is registered in verify:all',fs.readFileSync('package.json','utf8').includes('verify:growth-command-center-action-execution-v61910')]
];let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`${checks.length-fail}/${checks.length} atomic action execution checks passed`);process.exitCode=fail?1:0;
