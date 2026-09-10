const payload = msg.payload && typeof msg.payload === 'object' && !Buffer.isBuffer(msg.payload)
  ? msg.payload
  : null;
const message = String(
  payload?.message ||
  payload?.error?.message ||
  payload?.error ||
  msg.error?.message ||
  msg.error ||
  'La operación no se ha podido completar.'
);

msg.statusCode = Number(msg.statusCode || 400);
msg.headers = {
  ...(msg.headers || {}),
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};
msg.payload = {
  ok: false,
  error: payload?.error && typeof payload.error === 'string' ? payload.error : 'REQUEST_FAILED',
  message,
  details: payload?.details || null
};
return msg;
