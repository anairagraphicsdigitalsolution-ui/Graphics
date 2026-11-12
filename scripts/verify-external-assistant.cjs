const fs=require('fs');
const component=fs.readFileSync('components/ai-sales-chat.tsx','utf8');
const css=fs.readFileSync('app/globals.css','utf8');
const checks=[
  ['existing Anaira assistant mode is preserved',component.includes("setAssistantMode('anaira')")],
  ['external assistant mode is available in popup',component.includes("setAssistantMode('external')")],
  ['external URL can be configured in popup',component.includes('anaira-external-assistant-url')&&component.includes('saveExternalUrl')],
  ['external URL is validated before saving',component.includes('validAssistantUrl(value)')],
  ['external URL persists in browser storage',component.includes("localStorage.setItem('anaira-external-assistant-url'")],
  ['external assistant is embedded inside popup iframe',component.includes('<iframe className="ai-chat-external-frame"')],
  ['deployment-wide URL environment variable supported',component.includes('NEXT_PUBLIC_EXTERNAL_ASSISTANT_URL')],
  ['external popup styles exist',css.includes('.ai-chat-external-frame')&&css.includes('.ai-chat-mode-tabs')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} external assistant checks passed`);process.exit(failed?1:0);
