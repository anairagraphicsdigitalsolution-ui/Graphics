const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'app/api/growth/automation/reliability/route.ts');
const source = fs.readFileSync(file, 'utf8');
const checks = [
  ['ageMinutes has explicit nullable return type', /function ageMinutes\([^)]*\):number\|null/.test(source)],
  ['shared stale lease predicate exists', /function isStaleLease\([^)]*\):boolean/.test(source)],
  ['predicate stores age once before null guard', /const age=ageMinutes\(value,now\);return age!==null&&age>=threshold;/.test(source)],
  ['workflow stale run uses null-safe predicate', /staleRuns=runs\.filter\(\(x:any\)=>x\.status==='running'&&isStaleLease\(x\.locked_at,now,10\)\)/.test(source)],
  ['schedule stale lease uses null-safe predicate', /staleSchedules=schedules\.filter\(\(x:any\)=>x\.enabled&&isStaleLease\(x\.locked_at,now,20\)\)/.test(source)],
  ['job stale lease uses null-safe predicate', /staleJobs=jobs\.filter\(\(x:any\)=>x\.status==='processing'&&isStaleLease\(x\.locked_at,now,10\)\)/.test(source)],
  ['old unsafe repeated nullable comparison removed', !/ageMinutes\(x\.locked_at,now\)!==null&&ageMinutes\(x\.locked_at,now\)>=/.test(source)],
  ['release version bumped', JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8')).version === '6.124.6'],
];
let failed=0;
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
console.log(`${checks.length-failed}/${checks.length} checks passed`);
if(failed) process.exit(1);
