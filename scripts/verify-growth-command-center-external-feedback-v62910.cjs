'use strict';
const fs = require('node:fs');
const api = fs.readFileSync('app/api/growth/command-actions/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-command-action-execution.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261117050000_growth_command_external_feedback_v62910.sql', 'utf8');
const checks = [
  ['external feedback migration adds provider job linkage', migration.includes('add column if not exists job_id uuid references public.growth_jobs(id)')],
  ['task feedback remains backward compatible', migration.includes('alter column task_id drop not null')],
  ['exactly one outcome artifact is required', migration.includes('check ((task_id is not null) <> (job_id is not null))')],
  ['external feedback requires executed action', api.includes("if (action.status !== 'executed')")],
  ['external feedback job lookup is tenant scoped', api.includes("from('growth_jobs').select('id,status').eq('id', jobId).eq('organization_id', orgId)")],
  ['feedback waits for terminal provider job result', api.includes("!['succeeded', 'failed'].includes(data.status)")],
  ['feedback insert stores task or job linkage', api.includes('task_id: task?.id || null, job_id: job?.id || null')],
  ['audit event records linked provider job', api.includes('job_id: job?.id || null')],
  ['UI exposes external job outcome', ui.includes('Provider job outcome:')],
  ['UI exposes feedback after provider job completion', ui.includes("['succeeded','failed'].includes(item.external_job?.status||'')")],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`${checks.length - failed} PASS / ${failed} FAIL`);
process.exitCode = failed ? 1 : 0;
