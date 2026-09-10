const fs = require('fs');
const path = require('path');

const ROOT = '/internal-storage-files/files';
const ACTIVE_DIR = path.join(ROOT, '_active-sessions');
const OWNER_DIR = path.join(ROOT, '_vue-session-owners');
const WORKSPACE_DIR = path.join(ROOT, 'codex-workspace');

function text(value) { return String(value ?? '').trim(); }
function safe(value) { return text(value).replace(/[^a-zA-Z0-9_.@-]+/g, '_').slice(0, 180); }
function readJson(filePath, fallback = null) { try { if (!fs.existsSync(filePath)) return fallback; const raw = fs.readFileSync(filePath, 'utf8').trim(); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
function identity() { const sec = msg.__axetFlowsSecurityContext || {}; const idp = sec.externalIdpUserInfo || {}; const roles = Array.isArray(sec.userRoles || sec.roles) ? (sec.userRoles || sec.roles).map(String) : String(sec.userRoles || sec.roles || '').split(/[;,\s]+/).filter(Boolean); return { userKey: text(idp.preferred_username || idp.email || idp.sub || sec.login || msg.req?.user?.email || msg.req?.user?.id), axetUserId: text(sec.axetUserId), isAdmin: roles.some((role) => /(^|_)SUPER_ADMIN$|(^|_)ADMIN$/i.test(role)) }; }
function error(code, key, message) { msg.statusCode = code; msg.headers = { ...(msg.headers || {}), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }; msg.payload = { ok: false, error: key, message: message || key }; return [null, null, null, msg]; }

const who = identity();
if (!who.userKey) return error(401, 'AUTH_REQUIRED');
const sessionId = text(msg.req?.params?.sessionId);
if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) return error(400, 'INVALID_SESSION_ID');
const projectPath = path.join(WORKSPACE_DIR, sessionId);
const statePath = path.join(projectPath, 'codex-docs', 'SESSION_STATE.json');
const state = readJson(statePath, null);
if (!state) return error(404, 'SESSION_NOT_FOUND');
const active = readJson(path.join(ACTIVE_DIR, `${who.userKey}.json`), null);
const owner = readJson(path.join(OWNER_DIR, `${safe(sessionId)}.json`), null);
const authorized = who.isAdmin || active?.sessionId === sessionId || text(owner?.userKey).toLowerCase() === who.userKey.toLowerCase() || (who.axetUserId && text(state?.context?.axet_user_id) === who.axetUserId);
if (!authorized) return error(403, 'SESSION_FORBIDDEN');

const answersPath = path.join(projectPath, 'codex-docs', 'output', 'respuestas.json');
if (!fs.existsSync(answersPath)) return error(409, 'RESULT_NOT_READY', 'La ejecución todavía no ha generado respuestas.json.');

const context = state.context || {};
const selection = state.selection || {};
const selectedSources = Array.isArray(context.selectedSources) ? context.selectedSources : [];
const sourceType = text(context.sourceType || (selectedSources.length > 1 ? 'mixed' : selectedSources[0]));
const plantilla = text(selection.plantilla || selection.template || context.plantilla || context.template);
const sectorOutput = text(selection.sector_outputformat || context.sector_outputformat || 'general');
const unidad = text(context.unidad || context.unit || 'unidad');
const proyecto = text(context.proyecto || context.project || 'proyecto');
const submission = {
  sessionId,
  projectPath,
  selectedSources,
  sourceType,
  unidad,
  proyecto,
  opportunityId: text(context.opportunityId),
  plantilla,
  template: plantilla,
  sector_outputformat: sectorOutput,
  instruccionEspecifica: text(context.instruccionEspecifica),
  outputLanguage: text(context.outputLanguage),
  data: {
    sessionId,
    projectPath,
    selectedSources,
    sourceType,
    unidad,
    proyecto,
    opportunityId: text(context.opportunityId),
    plantilla,
    template: plantilla,
    sector_outputformat: sectorOutput
  }
};

msg._transport = 'http';
msg.sessionId = sessionId;
msg.projectPath = projectPath;
msg.projectDocsDir = path.join(projectPath, 'codex-docs');
msg.selectedSources = selectedSources;
msg.sourceType = sourceType;
msg.unit = unidad;
msg.project = proyecto;
msg.opportunityId = submission.opportunityId || null;
msg.plantilla = plantilla;
msg.templateName = plantilla;
msg.sector_outputformat = sectorOutput;
msg.submission = submission;
msg.onInitSubmission = { ...submission, data: { ...submission.data } };
msg.payload = { sessionId, projectPath, data: { ...submission.data }, submission: { ...submission } };

switch (msg._apiAction) {
  case 'export-excel': return [msg, null, null, null];
  case 'export-template': return [null, msg, null, null];
  case 'sharepoint': return [null, null, msg, null];
  default: return error(400, 'UNKNOWN_SESSION_ACTION');
}
