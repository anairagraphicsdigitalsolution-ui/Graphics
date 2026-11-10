const fs = require('node:fs');
const source = fs.readFileSync('app/api/growth/billing/route.ts', 'utf8');
const workspaceQuery = source.match(/const \{data:paymentRows,([^}]+)\}=await c\.db\.from\('growth_manual_payments'\)/);
if (!workspaceQuery || !/error:paymentError/.test(workspaceQuery[1]) || /paymentError/.test(workspaceQuery[1].replace('error:paymentError', ''))) {
  console.error('FAIL Workspace billing query must alias PostgREST error as paymentError.');
  process.exit(1);
}
if (!/if\(paymentError\)return apiJson\(\{error:'Payment history is unavailable\./.test(source)) {
  console.error('FAIL Workspace billing must handle payment query errors.');
  process.exit(1);
}
console.log('PASS Workspace billing PostgREST error destructuring is correctly typed');
console.log('PASS Workspace billing payment query errors are handled');
