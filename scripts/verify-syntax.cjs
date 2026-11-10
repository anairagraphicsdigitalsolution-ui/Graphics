// Source-level syntax verification only. Does not replace strict tsc or next build.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let count = 0;
let failures = 0;
function scan(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const file = path.join(dir,entry.name);
    if (entry.isDirectory()) { scan(file); continue; }
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith('.d.ts')) continue;
    count++;
    const result = ts.transpileModule(fs.readFileSync(file,'utf8'), {
      fileName:file, reportDiagnostics:true,
      compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve}
    });
    for (const diagnostic of result.diagnostics || []) {
      if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
      failures++;
      console.error(`${path.relative(root,file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText,' ')}`);
    }
  }
}
scan(root);
console.log(`Checked ${count} TS/TSX source files; ${failures} syntax errors.`);
process.exitCode = failures ? 1 : 0;
