const fs=require('fs');
const route=fs.readFileSync('app/api/growth/control-center/route.ts','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const usageRows=route.indexOf('const usageRows = usage.rows || [];');
const usageCapped=route.indexOf('const usageCapped = Number(usage.total || 0) > usageRows.length;');
const checks=[
 ['usageRows declared before usageCapped',usageRows>=0&&usageCapped>usageRows],
 ['usageRows safely defaults to empty array',/const usageRows = usage\.rows \|\| \[\];/.test(route)],
 ['usageCapped compares exact total against loaded rows',/Number\(usage\.total \|\| 0\) > usageRows\.length/.test(route)],
 ['usage cost aggregation uses usageRows',/usageRows\.reduce\(\(sum: number, item: any\) => sum \+ Number\(item\.estimated_cost \|\| 0\), 0\)/.test(route)],
 ['release version bumped',pkg.version==='6.124.7'],
 ['verifier registered in verify:all',pkg.scripts['verify:all'].includes('verify:growth-control-center-usage-order-v61246')]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`RESULT ${checks.length-fail}/${checks.length} PASS`);process.exitCode=fail?1:0;
