const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = '/internal-storage-files/files';
const ACTIVE_DIR = path.join(ROOT, '_active-sessions');
const OWNER_DIR = path.join(ROOT, '_vue-session-owners');
const WORKSPACE_DIR = path.join(ROOT, 'codex-workspace');

function text(value) { return String(value ?? '').trim(); }
function safe(value) { return text(value).replace(/[^a-zA-Z0-9_.@-]+/g, '_').slice(0, 180); }
function readJson(filePath, fallback = null) { try { if (!fs.existsSync(filePath)) return fallback; const raw = fs.readFileSync(filePath, 'utf8').trim(); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
function writeJsonAtomic(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); const tmp = `${filePath}.${Date.now()}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8'); fs.renameSync(tmp, filePath); }
function deepMerge(target, source) { if (!source || typeof source !== 'object' || Array.isArray(source)) return target; for (const [k, v] of Object.entries(source)) { if (v === undefined) continue; if (v && typeof v === 'object' && !Array.isArray(v)) { if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {}; deepMerge(target[k], v); } else target[k] = v; } return target; }
function identity() { const sec = msg.__axetFlowsSecurityContext || {}; const idp = sec.externalIdpUserInfo || {}; const roles = Array.isArray(sec.userRoles || sec.roles) ? (sec.userRoles || sec.roles).map(String) : String(sec.userRoles || sec.roles || '').split(/[;,\s]+/).filter(Boolean); return { userKey: text(idp.preferred_username || idp.email || idp.sub || sec.login || msg.req?.user?.email || msg.req?.user?.id), axetUserId: text(sec.axetUserId), isAdmin: roles.some((role) => /(^|_)SUPER_ADMIN$|(^|_)ADMIN$/i.test(role)) }; }
function response(code, payload) { msg.statusCode = code; msg.headers = { ...(msg.headers || {}), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }; msg.payload = payload; return msg; }
function kill(pid) { const p = Number(pid); if (!p) return false; try { if (os.platform() === 'win32') spawn('taskkill', ['/PID', String(p), '/T', '/F'], { detached: true, stdio: 'ignore' }).unref(); else spawn('sh', ['-c', `pkill -TERM -P ${p} 2>/dev/null; kill -TERM ${p} 2>/dev/null; sleep 2; pkill -KILL -P ${p} 2>/dev/null; kill -KILL ${p} 2>/dev/null`], { detached: true, stdio: 'ignore' }).unref(); return true; } catch (_) { return false; } }

const who = identity();
if (!who.userKey) return response(401, { ok: false, error: 'AUTH_REQUIRED' });
const sessionId = text(msg.req?.params?.sessionId);
if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) return response(400, { ok: false, error: 'INVALID_SESSION_ID' });
const projectPath = path.join(WORKSPACE_DIR, sessionId);
const statePath = path.join(projectPath, 'codex-docs', 'SESSION_STATE.json');
const state = readJson(statePath, null);
if (!state) return response(404, { ok: false, error: 'SESSION_NOT_FOUND' });
const activePath = path.join(ACTIVE_DIR, `${who.userKey}.json`);
const active = readJson(activePath, null);
const owner = readJson(path.join(OWNER_DIR, `${safe(sessionId)}.json`), null);
const authorized = who.isAdmin || active?.sessionId === sessionId || text(owner?.userKey).toLowerCase() === who.userKey.toLowerCase() || (who.axetUserId && text(state?.context?.axet_user_id) === who.axetUserId);
if (!authorized) return response(403, { ok: false, error: 'SESSION_FORBIDDEN' });

if (msg._apiAction === 'release') {
  const terminal = state?.resultReady === true || state?.runtime?.completed === true || state?.execution?.finished === true || state?.execution?.stopped === true;
  if (!terminal && msg.payload?.force !== true) return response(409, { ok: false, error: 'SESSION_RUNNING', message: 'La sesión sigue ejecutándose. Detén la ejecución antes de liberarla.' });
  try { if (active?.sessionId === sessionId && fs.existsSync(activePath)) fs.unlinkSync(activePath); } catch (err) { return response(500, { ok: false, error: 'RELEASE_FAILED', message: err.message }); }
  return response(200, { ok: true, sessionId, released: true });
}

const now = new Date().toISOString();
const updated = deepMerge(state, {
  updatedAt: now,
  runtime: { status: 'Stopped by user', manualStop: true, completed: false, success: false },
  execution: { stopRequested: true, stopRequestedAt: now, stopped: true, finished: true, shouldContinue: false, reason: 'manual-stop' }
});
writeJsonAtomic(statePath, updated);
const pids = [updated?.execution?.process?.pid, updated?.execution?.process?.workerPid, updated?.execution?.workerPid].filter(Boolean);
let killRequested = false;
for (const pid of new Set(pids.map(Number))) killRequested = kill(pid) || killRequested;
if (active?.sessionId === sessionId) {
  writeJsonAtomic(activePath, { ...active, status: 'stopped', updatedAt: now, stoppedAt: now });
}
flow.set(`__front_stop:${sessionId}`, { sessionId, stopped: true, reason: 'manual-stop', stoppedAt: now });
flow.set(`__front_stop:${who.userKey}:${sessionId}`, { sessionId, stopped: true, reason: 'manual-stop', stoppedAt: now });
return response(200, { ok: true, sessionId, stopped: true, killRequested, updatedAt: now });
