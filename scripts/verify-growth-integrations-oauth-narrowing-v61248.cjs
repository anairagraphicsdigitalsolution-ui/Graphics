const fs = require('fs');
const source = fs.readFileSync('lib/growth-integrations.ts', 'utf8');
const checks = [
  ['Meta and Instagram return before OAuth refresh branch', /if \(provider === 'meta' \|\| provider === 'instagram'\) return String\(credentials\.access_token\);[\s\S]*?let endpoint = 'https:\/\/oauth2\.googleapis\.com\/token';/.test(source)],
  ['unreachable Instagram/Meta comparison removed from narrowed branch', !/if \(provider === 'instagram' \|\| provider === 'meta'\)/.test(source)],
  ['Google and LinkedIn refresh-token flow retained', /if \(provider === 'linkedin'\) endpoint = 'https:\/\/www\.linkedin\.com\/oauth\/v2\/accessToken';[\s\S]*?credentials\.access_token = payload\.access_token;/.test(source)],
  ['rotated credentials continue to be encrypted and persisted', /const encrypted = encryptSecret\(credentials\);[\s\S]*?growth_social_accounts[\s\S]*?growth_integrations/.test(source)],
];
let failures = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failures++; }
console.log(`RESULT ${checks.length - failures}/${checks.length} PASS`);
process.exitCode = failures ? 1 : 0;
