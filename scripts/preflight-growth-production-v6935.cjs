#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const exists = p => fs.existsSync(path.join(root, p));
const migrationDir = path.join(root, 'supabase', 'migrations');
const migrations = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter(x => x.endsWith('.sql')).sort()
  : [];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const requiredFiles = [
  'app/api/growth/readiness/route.ts',
  'app/api/growth/worker/route.ts',
  'supabase/migrations/20261115090000_growth_external_effect_reconciliation_v6932.sql',
  'supabase/migrations/20261115100000_growth_external_effect_reconciliation_audit_v6933.sql',
];
const envExample = exists('.env.example') ? '.env.example' : exists('.env.local.example') ? '.env.local.example' : null;
const envNames = new Set();
for (const file of ['.env.example', '.env.local.example', '.env.local', '.env.production']) {
  if (!exists(file)) continue;
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
    if (m) envNames.add(m[1]);
  }
}
const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
];
const report = {
  version: pkg.version,
  migrationCount: migrations.length,
  migrationNamesSorted: migrations.every((name, i) => i === 0 || migrations[i - 1] < name),
  lockfilePresent: exists('package-lock.json'),
  buildScriptPresent: typeof pkg.scripts?.build === 'string',
  nextDependencyDeclared: Boolean(pkg.dependencies?.next || pkg.devDependencies?.next),
  nextInstalled: exists('node_modules/next/package.json'),
  requiredSourceFilesPresent: requiredFiles.filter(exists),
  requiredSourceFilesMissing: requiredFiles.filter(x => !exists(x)),
  envExamplePresent: Boolean(envExample),
  envExamplePath: envExample,
  envNamesFound: [...envNames].sort(),
  requiredEnvNamesNotDocumented: requiredEnv.filter(x => !envNames.has(x)),
  envFilesPresent: ['.env.local', '.env.production'].filter(exists),
  productionBuildPreviouslyVerified: false,
  liveDatabaseMigrationStatus: 'unknown_not_connected',
  liveProviderCertification: 'not_run',
};
console.log(JSON.stringify(report, null, 2));
const blockers = [];
if (!report.migrationNamesSorted) blockers.push('Migration filenames are not lexically sortable.');
if (report.requiredSourceFilesMissing.length) blockers.push('Required source files are missing.');
if (!report.lockfilePresent) blockers.push('No package-lock.json; reproducible npm install is not established.');
if (!report.nextDependencyDeclared) blockers.push('Next.js dependency is not declared.');
if (!report.nextInstalled) blockers.push('Next.js is not installed in this working tree.');
if (!report.envExamplePresent) blockers.push('No environment example file found.');
if (report.requiredEnvNamesNotDocumented.length) blockers.push('Required production environment variables are not fully documented.');
if (report.envFilesPresent.length === 0) blockers.push('No local production environment file is present; live checks cannot run here.');
console.log('\nPRODUCTION PREFLIGHT');
for (const item of blockers) console.log(`BLOCKED: ${item}`);
if (!blockers.length) console.log('Static preflight passed. Live database/provider verification is still a separate gate.');
process.exitCode = blockers.length ? 2 : 0;
