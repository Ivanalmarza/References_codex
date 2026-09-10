function normalizePayload(value) {
  if (value === undefined) return null;
  if (Buffer.isBuffer(value)) return { type: 'Buffer', length: value.length };
  return value;
}

const raw = normalizePayload(msg.payload);
const explicitError = msg.error?.message || msg.error || raw?.error || null;
const ok = !explicitError;

msg.statusCode = Number(msg.statusCode || (ok ? 200 : 500));
msg.headers = {
  ...(msg.headers || {}),
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};
msg.payload = ok
  ? { ok: true, data: raw, sessionId: msg.sessionId || msg.submission?.sessionId || null }
  : { ok: false, error: 'FLOW_ACTION_FAILED', message: String(explicitError), data: raw };
return msg;
