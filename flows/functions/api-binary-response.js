const path = require('path');

function contentType(fileName) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const types = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.pdf': 'application/pdf',
    '.json': 'application/json; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
  };
  return types[ext] || 'application/octet-stream';
}

function asciiFallback(fileName) {
  const fallback = String(fileName || 'download')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n"\\/]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();
  return fallback || 'download';
}

const download = msg.downloadFileSubmission || {};
const fileName = String(download.fileName || msg.generatedFilename || msg.generatedExcelFilename || 'download.bin').trim();
let data = download.data;

if (data === undefined || data === null) {
  msg.statusCode = 500;
  msg.headers = {
    ...(msg.headers || {}),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  msg.payload = { ok: false, error: 'DOWNLOAD_NOT_READY', message: 'El fichero no se ha podido preparar para descarga.' };
  return msg;
}

if (!Buffer.isBuffer(data)) {
  if (data?.type === 'Buffer' && Array.isArray(data.data)) data = Buffer.from(data.data);
  else if (Array.isArray(data)) data = Buffer.from(data);
  else data = Buffer.from(String(data));
}

const fallback = asciiFallback(fileName);
const encoded = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');

msg.statusCode = 200;
msg.headers = {
  ...(msg.headers || {}),
  'Content-Type': contentType(fileName),
  'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
  'Content-Length': String(data.length),
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff'
};
msg.payload = data;
delete msg.downloadFileSubmission;
return msg;
