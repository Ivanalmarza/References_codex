const fs = require('fs');
const path = require('path');

const ROOT = '/internal-storage-files/files/_vue-uploads';
function clean(value) { return String(value || '').trim(); }
function safe(value) { return clean(value).replace(/[^a-zA-Z0-9_.@-]+/g, '_').replace(/^\.+/, '').slice(0, 180); }
function identity() {
  const sec = msg.__axetFlowsSecurityContext || {};
  const idp = sec.externalIdpUserInfo || {};
  return clean(idp.preferred_username || idp.email || idp.sub || sec.login || msg.req?.user?.email || msg.req?.user?.id || '');
}
function response(code, payload) {
  msg.statusCode = code;
  msg.headers = { ...(msg.headers || {}), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  msg.payload = payload;
  return msg;
}
const userKey = identity();
if (!userKey) return response(401, { ok: false, error: 'AUTH_REQUIRED' });
const uploadId = clean(msg.req?.params?.uploadId);
if (!/^[a-f0-9]{24,64}$/i.test(uploadId)) return response(400, { ok: false, error: 'INVALID_UPLOAD_ID' });
const dir = path.join(ROOT, safe(userKey), uploadId);
const metaPath = path.join(dir, 'metadata.json');
try {
  if (!fs.existsSync(metaPath)) return response(404, { ok: false, error: 'UPLOAD_NOT_FOUND' });
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (clean(meta.userKey).toLowerCase() !== userKey.toLowerCase()) return response(403, { ok: false, error: 'UPLOAD_FORBIDDEN' });
  fs.rmSync(dir, { recursive: true, force: true });
  return response(200, { ok: true, uploadId, deleted: true });
} catch (err) {
  return response(500, { ok: false, error: 'UPLOAD_DELETE_FAILED', message: err.message });
}
