const fs=require('node:fs');
const api=fs.readFileSync('app/api/growth/command-actions/route.ts','utf8');
const ui=fs.readFileSync('components/growth-command-action-execution.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261116080000_growth_command_action_execution_v61900.sql','utf8');
const cc=fs.readFileSync('components/growth-command-center.tsx','utf8');
const checks=[
 ['execution ledger is workspace-scoped',migration.includes('organization_id uuid not null')&&api.includes(".eq('organization_id', orgId)")],
 ['only internal create_task action is permitted',migration.includes("action_type in ('create_task')")&&api.includes("action_type: 'create_task'")],
 ['pending approval is the initial state',migration.includes("default 'pending_approval'")&&api.includes("status: 'pending_approval'")],
 ['only owner and manager can propose actions',api.includes("['owner','manager']")],
 ['approval and rejection require pending state',api.includes("action.status !== 'pending_approval'")],
 ['execution requires approved state',api.includes("action.status !== 'approved'")],
 ['task execution has a database idempotency marker',api.includes("rpc('execute_growth_command_action'")&&fs.existsSync('supabase/migrations/20261116082000_growth_command_action_atomic_execution_v61910.sql')],
 ['execution writes an audit event',api.includes("growth.command_action.executed")],
 ['external side effects are explicitly excluded',api.includes('No external message, campaign or payment action')&&(ui.includes('External communications, ad spend, publishing and payments')||ui.includes('External communications, ad spend, publishing and payments are not executed here'))],
 ['UI supports proposal, approval, rejection and execution',ui.includes('Propose action for approval')&&ui.includes("act(item.id,'approve')")&&ui.includes("act(item.id,'reject')")&&ui.includes("act(item.id,'execute')")],
 ['UI is mounted in Command Center',cc.includes('GrowthCommandActionExecution')],
 ['ledger is RLS enabled and service-role only',migration.includes('enable row level security')&&migration.includes('revoke all on public.growth_command_actions from anon, authenticated')],
];let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`${checks.length-fail}/${checks.length} action execution checks passed`);process.exitCode=fail?1:0;
