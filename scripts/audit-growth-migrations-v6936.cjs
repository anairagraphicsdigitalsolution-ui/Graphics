#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const dir=path.join(process.cwd(),'supabase','migrations');
if(!fs.existsSync(dir)){console.error('supabase/migrations not found');process.exit(2);}
const files=fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).sort();
const sql=files.map(name=>({name,body:fs.readFileSync(path.join(dir,name),'utf8')}));
const all=sql.map(x=>x.body).join('\n');
const tables=new Map();
for(const f of sql){
 const re=/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z_][\w]*)/ig;let m;
 while((m=re.exec(f.body))){
  const name=m[1].toLowerCase();
  if(!tables.has(name))tables.set(name,{createdIn:f.name,rlsEnabled:false,policies:[]});
 }
}
for(const [name,meta] of tables){
 for(const f of sql){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(new RegExp('alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?'+escaped+'\\s+enable\\s+row\\s+level\\s+security','i').test(f.body))meta.rlsEnabled=true;
  const policyRe=new RegExp('create\\s+policy\\s+["\\w -]+\\s+on\\s+(?:public\\.)?'+escaped+'\\b','ig');let p;
  while((p=policyRe.exec(f.body)))meta.policies.push(f.name);
  if(/create\s+policy\s+%I\s+on\s+public\.%I/i.test(f.body)){
   const arrayBlock=(f.body.match(/foreach\s+\w+\s+in\s+array\s+array\s*\[([\s\S]*?)\]/i)||[])[1]||'';
   const dynamicTables=[...arrayBlock.matchAll(/'([a-zA-Z_][\w]*)'/g)].map(m=>m[1].toLowerCase());
   if(dynamicTables.includes(name))meta.policies.push('dynamic:'+f.name);
  }
 }
}
const missingRls=[...tables].filter(([,v])=>!v.rlsEnabled).map(([table,v])=>({table,createdIn:v.createdIn}));
const noPolicies=[...tables].filter(([,v])=>v.rlsEnabled&&!v.policies.length).map(([table,v])=>({table,createdIn:v.createdIn}));
function hasExplicitServiceRoleOnly(table){
 let revoke=false,grant=false;
 for(const f of sql){
  const statements=f.body.split(';').map(x=>x.trim().toLowerCase());
  for(const stmt of statements){
   if(!stmt.includes(table.toLowerCase()))continue;
   if(/^revoke\s+all\s+on\b/.test(stmt)&&/\bfrom\b/.test(stmt)&&/\b(public|anon|authenticated)\b/.test(stmt))revoke=true;
   if(/^grant\s+[\w,\s]+\s+on\b/.test(stmt)&&/\bto\s+service_role\b/.test(stmt))grant=true;
  }
 }
 return revoke&&grant;
}
const privateServiceRoleOnly=noPolicies.filter(x=>hasExplicitServiceRoleOnly(x.table));
const policyReviewRequired=noPolicies.filter(x=>!hasExplicitServiceRoleOnly(x.table));
const definer=[...all.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w.]+)[\s\S]{0,1800}?security\s+definer/ig)].map(m=>m[1]);
const definerWithoutSearchPath=[];
for(const fn of definer){
 const idx=all.toLowerCase().indexOf(('function '+fn).toLowerCase());
 const chunk=idx>=0?all.slice(idx,idx+5000):'';
 if(!/set\s+search_path\s*=/i.test(chunk))definerWithoutSearchPath.push(fn);
}
const riskyGrants=[...all.matchAll(/grant\s+[^;]*\bto\s+(?:anon|public)\b[^;]*;/ig)].map(m=>m[0].replace(/\s+/g,' ').trim());
const duplicateVersions=[];
for(let i=1;i<files.length;i++)if(files[i].slice(0,14)===files[i-1].slice(0,14))duplicateVersions.push([files[i-1],files[i]]);
const report={
 migrationCount:files.length,
 lexicalOrderValid:files.every((f,i)=>i===0||files[i-1]<f),
 createdTableCount:tables.size,
 tablesMissingExplicitRlsEnable:missingRls,
 rlsEnabledTablesWithoutDetectedPolicy:noPolicies,
 explicitlyServiceRoleOnlyTables:privateServiceRoleOnly,
 tablesNeedingPolicyOrPrivilegeReview:policyReviewRequired,
 securityDefinerFunctionsDetected:definer,
 securityDefinerFunctionsMissingNearbySearchPath:definerWithoutSearchPath,
 grantsToAnonOrPublicForManualReview:riskyGrants,
 duplicateTimestampPrefixes:duplicateVersions,
 limitations:'Static regex audit only. Dynamic SQL, inherited policies, extension-managed objects and runtime grants require live database catalog verification.'
};
fs.writeFileSync(path.join(process.cwd(),'MIGRATION-SECURITY-AUDIT-v6.93.9.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
console.log('\nStatic migration audit complete. This tool does not apply or modify migrations.');
