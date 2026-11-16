const assert = require('node:assert/strict');
const { deflateRawSync } = require('node:zlib');
const { extractKnowledgeText } = require('../lib/growth-knowledge-extract.js');
function zip(files) {
  const local = [], central = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), raw = Buffer.from(value), compressed = deflateRawSync(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50,0); lh.writeUInt16LE(20,4); lh.writeUInt16LE(8,8); lh.writeUInt32LE(compressed.length,18); lh.writeUInt32LE(raw.length,22); lh.writeUInt16LE(nameBytes.length,26);
    local.push(lh,nameBytes,compressed);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50,0); ch.writeUInt16LE(20,4); ch.writeUInt16LE(20,6); ch.writeUInt16LE(8,10); ch.writeUInt32LE(compressed.length,20); ch.writeUInt32LE(raw.length,24); ch.writeUInt16LE(nameBytes.length,28); ch.writeUInt32LE(offset,42);
    central.push(ch,nameBytes); offset += lh.length + nameBytes.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central), localBuffer = Buffer.concat(local), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(Object.keys(files).length,8); end.writeUInt16LE(Object.keys(files).length,10); end.writeUInt32LE(centralBuffer.length,12); end.writeUInt32LE(localBuffer.length,16);
  return Buffer.concat([localBuffer,centralBuffer,end]);
}
const docx = zip({'word/document.xml':'<w:document><w:body><w:p><w:r><w:t>Anaira DOCX extraction test</w:t></w:r></w:p></w:body></w:document>'});
const xlsx = zip({'xl/sharedStrings.xml':'<sst><si><t>Hotel CRM</t></si><si><t>Room inventory</t></si></sst>','xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData></worksheet>'});
const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Length 37 >> stream\nBT (Anaira PDF extraction test) Tj ET\nendstream\nendobj\n%%EOF');
const tests = [
  ['DOCX body text', extractKnowledgeText(docx,'test.docx').text.includes('Anaira DOCX extraction test')],
  ['XLSX shared strings and cells', extractKnowledgeText(xlsx,'test.xlsx').text.includes('Hotel CRM') && extractKnowledgeText(xlsx,'test.xlsx').text.includes('Room inventory')],
  ['PDF text operators', extractKnowledgeText(pdf,'test.pdf').text.includes('Anaira PDF extraction test')],
  ['TXT UTF-8', extractKnowledgeText(Buffer.from('Anaira UTF-8 test'),'test.txt').text === 'Anaira UTF-8 test'],
];
let failed=0; for(const [name,ok] of tests){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
assert.equal(failed,0,`${failed} extraction checks failed`); console.log(`\n${tests.length-failed} PASS / ${failed} FAIL`);
