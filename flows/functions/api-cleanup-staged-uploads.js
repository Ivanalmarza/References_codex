const fs = require('fs');
const path = require('path');

const ROOT = '/internal-storage-files/files/_vue-uploads';

function normalizeText(value) {
  return String(value ?? '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}
function safePart(value, fallback = '') {
  return normalizeText(value).replace(/[^a-zA-Z0-9_.@-]+/g, '_').replace(/^\.+/, '').slice(0, 180) || fallback;
}
function identity() {
  const sec = msg.__axetFlowsSecurityContext || {};
  const idp = sec.externalIdpUserInfo || {};
  return normalizeText(
    msg._vueSessionOwner ||
    idp.preferred_username ||
    idp.email ||
    idp.sub ||
    sec.login ||
    ''
  );
}

const ids = Array.isArray(msg._vueUploadIds)
  ? msg._vueUploadIds.map(normalizeText).filter((id) => /^[a-f0-9]{24,64}$/i.test(id))
  : [];
const userKey = identity();

if (ids.length && userKey) {
  const userRoot = path.resolve(path.join(ROOT, safePart(userKey, 'user')));
  for (const uploadId of ids) {
    const target = path.resolve(path.join(userRoot, uploadId));
    if (!target.startsWith(userRoot + path.sep)) continue;
    try {
      fs.rmSync(target, { recursive: true, force: true });
    } catch (err) {
      node.warn(`Vue upload cleanup ${uploadId}: ${err.message}`);
    }
  }
}

delete msg._vueUploadIds;
return msg;
