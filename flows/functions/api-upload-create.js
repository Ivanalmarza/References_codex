const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILES_ROOT = '/internal-storage-files/files';
const UPLOAD_ROOT = path.join(FILES_ROOT, '_vue-uploads');
const MAX_BYTES = 250 * 1024 * 1024;

function normalizeText(value) {
  return String(value ?? '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').trim();
}
function safePart(value, fallback = '') {
  const result = normalizeText(value).replace(/[^a-zA-Z0-9_.@-]+/g, '_').replace(/^\.+/, '').slice(0, 180);
  return result || fallback;
}
function identity() {
  const sec = msg.__axetFlowsSecurityContext || {};
  const idp = sec.externalIdpUserInfo || {};
  return {
    userKey: normalizeText(idp.preferred_username || idp.email || idp.sub || sec.login || msg.req?.user?.email || msg.req?.user?.id || ''),
    axetUserId: normalizeText(sec.axetUserId || '')
  };
}
function respond(statusCode, payload) {
  msg.statusCode = statusCode;
  msg.headers = { ...(msg.headers || {}), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  msg.payload = payload;
  return msg;
}
function parseBuffer(raw) {
  if (Buffer.isBuffer(raw)) return raw;
  const text = String(raw || '');
  if (!text) return null;
  const comma = text.indexOf(',');
  const base64 = /^data:/i.test(text) && comma >= 0 ? text.slice(comma + 1) : text;
  return Buffer.from(base64.replace(/\s+/g, ''), 'base64');
}
function purgeExpired(userDir, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(userDir)) return;
    const cutoff = Date.now() - maxAgeMs;
    for (const entry of fs.readdirSync(userDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-f0-9]{24,64}$/i.test(entry.name)) continue;
      const dir = path.join(userDir, entry.name);
      const metadata = readJsonSafe(path.join(dir, 'metadata.json'));
      const createdAt = Date.parse(metadata?.createdAt || '') || fs.statSync(dir).mtimeMs;
      if (createdAt < cutoff) fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    node.warn(`Vue upload purge failed: ${err.message}`);
  }
}
function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}
function writeJsonAtomic(filePath, data) {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

const who = identity();
if (!who.userKey) return respond(401, { ok: false, error: 'AUTH_REQUIRED' });

try {
  const body = msg.payload?.data && typeof msg.payload.data === 'object' ? msg.payload.data : (msg.payload || {});
  const originalName = safePart(body.name || body.originalName || body.filename, 'upload.bin');
  const buffer = parseBuffer(body.data || body.base64 || body.content);
  if (!buffer || !buffer.length) return respond(400, { ok: false, error: 'EMPTY_FILE', message: 'El archivo no contiene datos.' });
  if (buffer.length > MAX_BYTES) return respond(413, { ok: false, error: 'FILE_TOO_LARGE', maxBytes: MAX_BYTES });

  const uploadId = crypto.randomBytes(18).toString('hex');
  const userDir = path.join(UPLOAD_ROOT, safePart(who.userKey, 'user'));
  purgeExpired(userDir);
  const uploadDir = path.join(userDir, uploadId);
  fs.mkdirSync(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, originalName);
  fs.writeFileSync(filePath, buffer, { mode: 0o600 });

  const metadata = {
    uploadId,
    userKey: who.userKey,
    axetUserId: who.axetUserId || null,
    name: originalName,
    type: normalizeText(body.type || body.mimeType || 'application/octet-stream'),
    size: buffer.length,
    scope: normalizeText(body.scope || 'execution'),
    path: filePath,
    createdAt: new Date().toISOString()
  };
  writeJsonAtomic(path.join(uploadDir, 'metadata.json'), metadata);

  return respond(201, {
    ok: true,
    upload: { uploadId, name: metadata.name, type: metadata.type, size: metadata.size, scope: metadata.scope, createdAt: metadata.createdAt }
  });
} catch (err) {
  node.error(`Vue upload failed: ${err.message}`);
  return respond(500, { ok: false, error: 'UPLOAD_FAILED', message: err.message });
}
