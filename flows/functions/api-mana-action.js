const fs = require('fs');
const path = require('path');

const ROOT = '/internal-storage-files/files';
const UPLOAD_ROOT = path.join(ROOT, '_vue-uploads');

function normalizeText(value) {
  return String(value ?? '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').trim();
}
function safePart(value, fallback = '') {
  return normalizeText(value).replace(/[^a-zA-Z0-9_.@-]+/g, '_').replace(/^\.+/, '').slice(0, 180) || fallback;
}
function readJson(filePath, fallback = null) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}
function identity() {
  const sec = msg.__axetFlowsSecurityContext || {};
  const idp = sec.externalIdpUserInfo || {};
  return normalizeText(
    idp.preferred_username || idp.email || idp.sub || sec.login ||
    msg.req?.user?.email || msg.req?.user?.id || msg.userId || ''
  );
}
function response(statusCode, error, message) {
  msg.statusCode = statusCode;
  msg.headers = { ...(msg.headers || {}), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  msg.payload = { ok: false, error, message };
  return msg;
}
function uploadIds(body) {
  const raw = body.uploadIds || body.uploads || [];
  return (Array.isArray(raw) ? raw : [raw])
    .map((item) => typeof item === 'object' ? item.uploadId || item.id || item.value : item)
    .map(normalizeText)
    .filter(Boolean);
}
function hydrateUploads(ids, userKey) {
  return ids.map((uploadId) => {
    if (!/^[a-f0-9]{24,64}$/i.test(uploadId)) throw new Error(`Upload id no válido: ${uploadId}`);
    const dir = path.join(UPLOAD_ROOT, safePart(userKey, 'user'), uploadId);
    const metadata = readJson(path.join(dir, 'metadata.json'), null);
    if (!metadata) throw new Error(`Upload no encontrado: ${uploadId}`);
    if (normalizeText(metadata.userKey).toLowerCase() !== userKey.toLowerCase()) throw new Error(`Upload no autorizado: ${uploadId}`);
    const filePath = path.resolve(normalizeText(metadata.path));
    if (!filePath.startsWith(path.resolve(dir) + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`Upload no disponible: ${uploadId}`);
    }
    return {
      uploadId,
      name: normalizeText(metadata.name),
      originalName: normalizeText(metadata.name),
      type: normalizeText(metadata.type),
      size: Number(metadata.size || fs.statSync(filePath).size),
      path: filePath
    };
  });
}

const userKey = identity();
if (!userKey) return [null, null, response(401, 'AUTH_REQUIRED', 'No se ha podido resolver el usuario autenticado.')];

const body = msg.payload?.data && typeof msg.payload.data === 'object' ? msg.payload.data : (msg.payload || {});
const actionRaw = normalizeText(body.action || body.crudAction || 'checkRequired');
const actionAliases = {
  upload: 'upload',
  check: 'checkRequired',
  checkRequired: 'checkRequired',
  delete: 'deleteDoc',
  deleteDoc: 'deleteDoc',
  deleteDocList: 'deleteDoc',
  deleteDocConfirm: 'deleteDocConfirm'
};
const action = actionAliases[actionRaw];
if (!action) return [null, null, response(400, 'MANA_ACTION_INVALID', `Acción no soportada: ${actionRaw}`)];

const opportunityId = normalizeText(body.opportunityId);
if (!opportunityId) return [null, null, response(400, 'OPPORTUNITY_REQUIRED', 'Selecciona una oportunidad.')];

let uploads = [];
try {
  if (action === 'upload') {
    const ids = uploadIds(body);
    if (!ids.length) return [null, null, response(400, 'UPLOAD_REQUIRED', 'Selecciona al menos un documento.')];
    uploads = hydrateUploads(ids, userKey);
  }
} catch (err) {
  return [null, null, response(400, 'UPLOAD_INVALID', err.message)];
}

msg._transport = 'http';
msg._apiRequestId = msg._msgid || null;
msg.sessionUserKey = userKey;
msg._vueUploadIds = uploads.map((item) => item.uploadId).filter(Boolean);

if (action === 'deleteDocConfirm') {
  const deleteFileName = normalizeText(body.deleteFileName || body.fileName || body.fileToDelete);
  if (!deleteFileName) return [null, null, response(400, 'DELETE_FILE_REQUIRED', 'Selecciona el documento que quieres eliminar.')];
  const data = { deleteFileName, opportunityId, userKey };
  msg.payload = { data };
  msg.submission = { data };
  msg.onInitSubmission = { data };
  return [null, msg, null];
}

const data = {
  crudAction: action,
  opportunityId,
  sector: normalizeText(body.sector),
  unidadOportunidad: normalizeText(body.unidadOportunidad || body.unit),
  cliente: normalizeText(body.cliente || body.customer),
  uploadFile: uploads,
  userKey
};
msg.payload = { data };
msg.submission = { data };
msg.onInitSubmission = { data };
return [msg, null, null];
