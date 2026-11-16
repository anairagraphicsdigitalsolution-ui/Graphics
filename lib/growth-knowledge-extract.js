const { inflateSync, inflateRawSync } = require('node:zlib');

const MAX_ENTRIES = 500;
const MAX_EXPANDED = 20 * 1024 * 1024;
const MAX_ENTRY = 12 * 1024 * 1024;

function decodeXml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    const key = entity.toLowerCase();
    if (key === 'amp') return '&'; if (key === 'lt') return '<'; if (key === 'gt') return '>';
    if (key === 'quot') return '"'; if (key === 'apos') return "'";
    const code = key.startsWith('#x') ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}
function xmlText(xml) {
  return decodeXml(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
}
function zipEntries(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65558); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid Office document container.');
  const count = buffer.readUInt16LE(eocd + 10), centralSize = buffer.readUInt32LE(eocd + 12), centralOffset = buffer.readUInt32LE(eocd + 16);
  if (!count || count > MAX_ENTRIES || centralOffset + centralSize > buffer.length) throw new Error('Office document contains too many or invalid entries.');
  const entries = new Map(); let offset = centralOffset, total = 0;
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid Office document directory.');
    const method = buffer.readUInt16LE(offset + 10), compressed = buffer.readUInt32LE(offset + 20), expanded = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28), extraLen = buffer.readUInt16LE(offset + 30), commentLen = buffer.readUInt16LE(offset + 32), localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    if (name.includes('..') || name.startsWith('/') || expanded > MAX_ENTRY) throw new Error('Unsafe or oversized Office document entry.');
    total += expanded; if (total > MAX_EXPANDED) throw new Error('Office document expands beyond the allowed size.');
    if (!name.endsWith('/')) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Invalid Office document entry.');
      const localNameLen = buffer.readUInt16LE(localOffset + 26), localExtraLen = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const compressedData = buffer.subarray(start, start + compressed);
      let data;
      if (method === 0) data = Buffer.from(compressedData);
      else if (method === 8) data = inflateRawSync(compressedData, { maxOutputLength: MAX_ENTRY });
      else throw new Error('Unsupported Office document compression method.');
      if (data.length !== expanded) throw new Error('Office document entry size mismatch.');
      entries.set(name, data);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
function extractDocx(buffer) {
  const entries = zipEntries(buffer), xml = entries.get('word/document.xml');
  if (!xml) throw new Error('DOCX document body was not found.');
  const main = xml.toString('utf8');
  const parts = [...main.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => decodeXml(m[1]));
  const headers = [...entries.entries()].filter(([name]) => /^word\/(header|footer)\d+\.xml$/.test(name)).flatMap(([, data]) => [...data.toString('utf8').matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => decodeXml(m[1])));
  return [...parts, ...headers].join(' ').replace(/\s+/g, ' ').trim();
}
function extractXlsx(buffer) {
  const entries = zipEntries(buffer), shared = entries.get('xl/sharedStrings.xml');
  const strings = shared ? [...shared.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlText(m[1])) : [];
  const sheets = [...entries.entries()].filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort(([a], [b]) => a.localeCompare(b));
  if (!sheets.length) throw new Error('XLSX workbook contains no readable worksheets.');
  const output = [];
  for (const [name, data] of sheets) {
    const xml = data.toString('utf8'); output.push(name.split('/').pop());
    for (const row of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const type = /\bt="([^"]+)"/.exec(cell[1])?.[1];
        if (type === 's') { const index = Number(/<v>(\d+)<\/v>/.exec(cell[2])?.[1]); cells.push(strings[index] || ''); }
        else if (type === 'inlineStr') cells.push(xmlText(cell[2]));
        else { const value = /<v>([\s\S]*?)<\/v>/.exec(cell[2])?.[1]; if (value != null) cells.push(decodeXml(value)); }
      }
      if (cells.some(Boolean)) output.push(cells.join(' | '));
    }
  }
  return output.join('\n').trim();
}
function decodePdfString(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\\') {
      const next = raw[++i];
      if (next === 'n') out += '\n'; else if (next === 'r') out += '\n'; else if (next === 't') out += '\t';
      else if (next === 'b' || next === 'f') out += ' ';
      else if (next === '\n' || next === '\r') { if (next === '\r' && raw[i + 1] === '\n') i++; }
      else if (/[0-7]/.test(next || '')) { let oct = next; for (let j = 0; j < 2 && /[0-7]/.test(raw[i + 1] || ''); j++) oct += raw[++i]; out += String.fromCharCode(parseInt(oct, 8)); }
      else out += next || '';
    } else out += raw[i];
  }
  return out;
}
function extractPdf(buffer) {
  if (buffer.toString('latin1', 0, 8).indexOf('%PDF-') !== 0) throw new Error('Invalid PDF file signature.');
  const source = buffer.toString('latin1'); let text = '';
  const streams = /<<(?:.|\r|\n)*?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streams)) {
    let stream = Buffer.from(match[1], 'latin1');
    const header = match[0].slice(0, match[0].indexOf('stream'));
    if (/\/FlateDecode/.test(header)) { try { stream = inflateSync(stream, { maxOutputLength: MAX_ENTRY }); } catch { continue; } }
    else if (/\/Filter\s/.test(header)) continue;
    const content = stream.toString('latin1');
    for (const m of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) text += decodePdfString(m[1]) + ' ';
    for (const m of content.matchAll(/\[((?:.|\r|\n)*?)\]\s*TJ/g)) {
      for (const part of m[1].matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F]+)>/g)) {
        if (part[1] != null) text += decodePdfString(part[1]);
        else if (part[2]) { const bytes = Buffer.from(part[2].length % 2 ? part[2].slice(0, -1) : part[2], 'hex'); text += bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff ? bytes.toString('utf16le', 2).split('').reverse().join('') : bytes.toString('latin1'); }
      }
      text += ' ';
    }
  }
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** @param {Buffer} bytes @param {string} fileName @returns {{text:string,mimeType:string}} */
function extractKnowledgeText(bytes, fileName) {
  const ext = fileName.toLowerCase().split('.').pop();
  let text, mimeType;
  if (ext === 'txt' || ext === 'csv' || ext === 'md' || ext === 'markdown') {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    mimeType = ext === 'csv' ? 'text/csv' : (ext === 'md' || ext === 'markdown' ? 'text/markdown' : 'text/plain');
  } else if (ext === 'docx') { text = extractDocx(bytes); mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }
  else if (ext === 'xlsx') { text = extractXlsx(bytes); mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; }
  else if (ext === 'pdf') { text = extractPdf(bytes); mimeType = 'application/pdf'; }
  else throw new Error('Supported formats: TXT, CSV, Markdown, PDF, DOCX and XLSX.');
  text = text.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('No searchable text could be extracted. Scanned PDFs require OCR and are not supported yet.');
  return { text, mimeType };
}
module.exports = { extractKnowledgeText };
