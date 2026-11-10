const fs=require('fs'),path=require('path');
const roots=['app','components','lib'];
const files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.next','.git'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx|jsx)$/.test(e.name))files.push(p);}}
roots.forEach(walk);
let failed=0;
for(const file of files){const source=fs.readFileSync(file,'utf8');const match=source.match(/^\s*(['"])use client\1\s*;?/);const any=source.match(/(['"])use client\1/);if(any&&!match){console.error('FAIL misplaced client directive:',file);failed++;}}
if(!failed)console.log(`PASS client directive placement checked in ${files.length} TSX/JSX files`);
else process.exitCode=1;
