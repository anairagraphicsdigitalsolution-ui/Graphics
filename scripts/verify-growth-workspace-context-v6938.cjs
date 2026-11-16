const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const nav = fs.readFileSync(path.join(root, 'components/growth-primary-nav.tsx'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const checks = [
  ['workspace membership query includes organization_id and role', /select\('organization_id,role'\)/.test(nav)],
  ['workspace organizations are filtered to the signed-in member ids', /orgQuery\.in\('id',orgIds\)/.test(nav)],
  ['active workspace is restored from the shared dashboard key', /anaira-growth-active-org/.test(nav)],
  ['role is resolved against the selected workspace, not aggregated globally', /roleByOrg\.get\(org\.id\)/.test(nav) && !/roles\.find\(/.test(nav)],
  ['workspace switch validates membership before switching', /workspaces\.some\(workspace=>workspace\.id===next\)/.test(nav)],
  ['workspace switch persists selection and reloads current route', /localStorage\.setItem\('anaira-growth-active-org',next\)/.test(nav) && /window\.location\.assign\(pathname/.test(nav)],
  ['workspace selector is exposed in desktop navigation', /growth-active-workspace/.test(nav)],
  ['platform admin workspace role is explicit', /platformAdmin\?'platform_admin'/.test(nav)],
  ['release version is bumped', /^6\.(?:93\.[8-9]|(?:95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115|116|117|118|119|120|121|122|123|124)\.\d+)$/.test(pkg.version)],
  ['verifier is registered in verify:all', pkg.scripts['verify:all'].includes('npm run verify:growth-workspace-context-v6938')],
];
let failed=0;
for (const [label, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${label}`); if(!ok) failed++; }
console.log(`Workspace context verification: ${checks.length-failed}/${checks.length} PASS`);
process.exitCode=failed?1:0;
