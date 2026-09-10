const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILES_ROOT = '/internal-storage-files/files';
const OWNER_DIR = path.join(FILES_ROOT, '_vue-session-owners');
const UPLOAD_ROOT = path.join(FILES_ROOT, '_vue-uploads');
const WORKSPACE_ROOT = path.join(FILES_ROOT, 'codex-workspace');
const PROCESSED_ROOT = path.join(FILES_ROOT, 'procesado');
const TEMPLATES_ROOT = path.join(FILES_ROOT, 'plantillas');
const INDEX_PATH = path.join(FILES_ROOT, 'opportunities_index.json');

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}
function safePart(value, fallback = '') {
  const result = normalizeText(value)
    .replace(/[^a-zA-Z0-9_.@-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180);
  return result || fallback;
}
function isWithin(basePath, targetPath) {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function catalogSegment(value) {
  const normalized = normalizeText(value);
  if (!normalized || normalized === '.' || normalized === '..' || /[\\/\0]/.test(normalized)) return '';
  return normalized;
}
function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}
function identity(currentMsg) {
  const sec = currentMsg.__axetFlowsSecurityContext || {};
  const idp = sec.externalIdpUserInfo || {};
  return {
    userKey: normalizeText(idp.preferred_username || idp.email || idp.sub || sec.login || currentMsg.req?.user?.email || currentMsg.req?.user?.id || ''),
    axetUserId: normalizeText(sec.axetUserId || ''),
    oktaId: normalizeText(sec.oktaId || '')
  };
}
function readJson(filePath, fallback = null) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    node.warn(`Vue start read JSON failed ${filePath}: ${err.message}`);
    return fallback;
  }
}
function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid || 'fn'}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}
function response(statusCode, payload) {
  msg.statusCode = statusCode;
  msg.headers = { ...(msg.headers || {}), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  msg.payload = payload;
  return msg;
}
function fail(statusCode, error, message, details) {
  return [response(statusCode, { ok: false, error, message, details: details || null }), null];
}
function normalizeUploadIds(body) {
  const raw = body.uploadIds || body.uploads || [];
  return (Array.isArray(raw) ? raw : [raw])
    .map((item) => typeof item === 'object' ? item.uploadId || item.id || item.value : item)
    .map(normalizeText)
    .filter(Boolean);
}
function hydrateUploads(uploadIds, who) {
  const files = [];
  for (const uploadId of uploadIds) {
    if (!/^[a-f0-9]{24,64}$/i.test(uploadId)) throw new Error(`Upload id no válido: ${uploadId}`);
    const dir = path.join(UPLOAD_ROOT, safePart(who.userKey, 'user'), uploadId);
    const metadata = readJson(path.join(dir, 'metadata.json'), null);
    if (!metadata) throw new Error(`Upload no encontrado: ${uploadId}`);
    if (normalizeText(metadata.userKey).toLowerCase() !== who.userKey.toLowerCase()) throw new Error(`Upload no autorizado: ${uploadId}`);
    const filePath = path.resolve(normalizeText(metadata.path));
    if (!filePath.startsWith(path.resolve(dir) + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`Upload no disponible: ${uploadId}`);
    }
    files.push({
      uploadId,
      name: normalizeText(metadata.name),
      originalName: normalizeText(metadata.name),
      type: normalizeText(metadata.type),
      size: Number(metadata.size || fs.statSync(filePath).size),
      path: filePath
    });
  }
  return files;
}
function validateTemplate(template) {
  const value = normalizeText(template);
  if (!value) return '';
  if (value === '__blank_docx__') return value;
  if (/[\\/\0]/.test(value) || !['.docx', '.pptx'].includes(path.extname(value).toLowerCase())) return '';
  try {
    const candidates = fs.readdirSync(TEMPLATES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    return candidates.includes(value) ? value : '';
  } catch (err) {
    node.warn(`Vue start template scan failed: ${err.message}`);
    return '';
  }
}

const who = identity(msg);
if (!who.userKey) return fail(401, 'AUTH_REQUIRED', 'No se ha podido resolver el usuario autenticado.');

const body = msg.payload?.data && typeof msg.payload.data === 'object' ? msg.payload.data : (msg.payload || {});
const includeProcessed = bool(body.includeProcessed);
const includeOpportunity = bool(body.includeOpportunity);
const includeUploads = bool(body.includeUploads);
const selectedSources = [];
if (includeProcessed) selectedSources.push('processed');
if (includeOpportunity) selectedSources.push('opportunity');
if (includeUploads) selectedSources.push('uploads');
if (!selectedSources.length) return fail(400, 'SOURCE_REQUIRED', 'Activa al menos una fuente.');

const unidadProcesado = catalogSegment(body.unidadProcesado);
const proyectoProcesado = catalogSegment(body.proyectoProcesado);
if (includeProcessed) {
  if (!unidadProcesado || !proyectoProcesado) return fail(400, 'PROCESSED_SELECTION_REQUIRED', 'Selecciona unidad y proyecto procesado.');
  const markdownPath = path.resolve(PROCESSED_ROOT, unidadProcesado, proyectoProcesado, 'markdown');
  if (!isWithin(PROCESSED_ROOT, markdownPath)) {
    return fail(400, 'PROCESSED_SELECTION_INVALID', 'La selección de proyecto procesado no es válida.');
  }
  if (!fs.existsSync(markdownPath) || !fs.statSync(markdownPath).isDirectory()) {
    return fail(404, 'PROCESSED_PROJECT_NOT_FOUND', 'No existe el markdown preprocesado seleccionado.');
  }
}

const opportunityId = normalizeText(body.opportunityId);
let selectedOpportunity = null;
if (includeOpportunity) {
  if (!opportunityId) return fail(400, 'OPPORTUNITY_REQUIRED', 'Selecciona una oportunidad.');
  const index = readJson(INDEX_PATH, { items: [] });
  selectedOpportunity = (index.items || []).find((item) => normalizeText(item.opportunityId || item.id || item.salesforceOpportunityId || item.businessOpportunityId) === opportunityId) || null;
  if (!selectedOpportunity) return fail(404, 'OPPORTUNITY_NOT_FOUND', `No se encontró la oportunidad ${opportunityId}.`);
}

let uploadFiles = [];
try {
  if (includeUploads) {
    const uploadIds = normalizeUploadIds(body);
    if (!uploadIds.length) return fail(400, 'UPLOAD_REQUIRED', 'Añade al menos un archivo.');
    uploadFiles = hydrateUploads(uploadIds, who);
  }
} catch (err) {
  return fail(400, 'UPLOAD_INVALID', err.message);
}

const plantilla = validateTemplate(body.plantilla || body.template);
if (!plantilla) return fail(400, 'TEMPLATE_REQUIRED', 'Selecciona una plantilla DOCX o PPTX válida.');

const idioma = normalizeText(body.idioma || body.outputLanguage || 'Español (ES)');
const sectorOutput = ['general', 'sector_publico', 'sector_privado'].includes(normalizeText(body.sector_outputformat).toLowerCase())
  ? normalizeText(body.sector_outputformat).toLowerCase()
  : 'general';

const sessionId = crypto.randomBytes(16).toString('hex');
const projectPath = path.join(WORKSPACE_ROOT, sessionId);
const projectDocsDir = path.join(projectPath, 'codex-docs');
fs.mkdirSync(projectDocsDir, { recursive: true });

const formData = {
  includeProcessed,
  includeOpportunity,
  includeUploads,
  unidadProcesado,
  proyectoProcesado,
  opportunitySelectionMode: normalizeText(body.opportunitySelectionMode || 'filters'),
  businessOpportunityIdSearch: normalizeText(body.businessOpportunityIdSearch),
  sector: normalizeText(body.sector || selectedOpportunity?.sector),
  unidadOportunidad: normalizeText(body.unidadOportunidad || selectedOpportunity?.unit),
  cliente: normalizeText(body.cliente || selectedOpportunity?.customerName || selectedOpportunity?.customer),
  opportunityId,
  uploadFiles,
  idioma,
  plantilla,
  sector_outputformat: sectorOutput,
  instruccionEspecifica: normalizeText(body.instruccionEspecifica),
  model_select: normalizeText(body.model_select || body.requestedModel),
  requestedReasoning: normalizeText(body.requestedReasoning || body.reasoningLevel),
  extract: body.extract === undefined ? true : body.extract
};

const now = new Date().toISOString();
const sourceType = selectedSources.length > 1 ? 'mixed' : selectedSources[0];
const queuedState = {
  _id: sessionId,
  sessionId,
  createdAt: now,
  updatedAt: now,
  lastCheckpoint: 'vue-api-queued',
  timeline: [{ checkpoint: 'vue-api-queued', ts: now }],
  runtime: { status: 'En cola...', progress: 0, completed: false, success: false, processing_started: false, error: null },
  execution: { phase: 'queued', finished: false, stopped: false, shouldContinue: true },
  context: {
    userKey: who.userKey,
    axet_user_id: who.axetUserId || null,
    okta_id: who.oktaId || null,
    selectedSources,
    sourceType,
    includeProcessed,
    includeOpportunity,
    includeUploads,
    unidad: unidadProcesado || normalizeText(selectedOpportunity?.unit) || 'mixto',
    proyecto: proyectoProcesado || normalizeText(selectedOpportunity?.title || selectedOpportunity?.name) || selectedSources.join('_'),
    opportunityId: opportunityId || null,
    opportunityTitle: normalizeText(selectedOpportunity?.title || selectedOpportunity?.name) || null,
    opportunityCustomer: normalizeText(selectedOpportunity?.customerName || selectedOpportunity?.customer) || null,
    plantilla,
    sector_outputformat: sectorOutput,
    instruccionEspecifica: formData.instruccionEspecifica || null,
    outputLanguage: idioma
  },
  selection: { plantilla, template: plantilla, sector_outputformat: sectorOutput, requestedModel: formData.model_select || null, requestedReasoning: formData.requestedReasoning || null },
  transport: { frontend: 'vue', apiVersion: '2.1.0' }
};
writeJsonAtomic(path.join(projectDocsDir, 'SESSION_STATE.json'), queuedState);
writeJsonAtomic(path.join(OWNER_DIR, `${sessionId}.json`), {
  sessionId,
  userKey: who.userKey,
  axetUserId: who.axetUserId || null,
  projectPath,
  createdAt: now,
  frontend: 'vue'
});
msg.sessionId = sessionId;
msg.msgid = sessionId;
msg.projectPath = projectPath;
msg.projectDocsDir = projectDocsDir;
msg.submission = { ...formData };
msg.onInitSubmission = { ...formData, sessionId, projectPath };
msg._transport = 'vue-background';
msg._apiRequestId = msg._msgid || null;
msg._vueUploadIds = uploadFiles.map((item) => item.uploadId).filter(Boolean);
msg._vueSessionOwner = who.userKey;

const backgroundMsg = RED.util.cloneMessage(msg);
delete backgroundMsg.req;
delete backgroundMsg.res;
backgroundMsg.payload = { data: { ...formData } };
backgroundMsg.__vueExecution = { sessionId, acceptedAt: now, userKey: who.userKey };
backgroundMsg._vueUploadIds = [...msg._vueUploadIds];

response(202, {
  ok: true,
  accepted: true,
  sessionId,
  status: 'queued',
  selectedSources,
  sourceType,
  createdAt: now,
  links: {
    status: `./api/executions/${sessionId}`,
    results: `./api/executions/${sessionId}/results`,
    stop: `./api/executions/${sessionId}/stop`
  }
});

node.warn(`Vue API execution accepted user=${who.userKey} sid=${sessionId.slice(0, 8)} sources=${selectedSources.join(',')}`);
return [msg, backgroundMsg];
