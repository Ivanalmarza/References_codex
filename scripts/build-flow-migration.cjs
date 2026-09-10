'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INPUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(PROJECT_ROOT, 'flows', 'source-flow.json');
const OUT_DIR = path.join(PROJECT_ROOT, 'flows');
const FUNCTIONS = path.join(PROJECT_ROOT, 'flows', 'functions');
const MAIN_Z = 'b678025fa24bf933';
const EXECUTION_Z = '6efe739b.ee17.4dc8.83b2.ee1138c607b7';

fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(INPUT)) {
  throw new Error(`Source flow not found: ${INPUT}. Pass it as the first argument.`);
}
const original = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

function stableId(label) {
  return crypto.createHash('sha1').update(`references-vue-full:${label}`).digest('hex').slice(0, 16);
}
function readFunction(name) {
  return fs.readFileSync(path.join(FUNCTIONS, name), 'utf8');
}
function fn(label, name, func, x, y, outputs = 1, wires = []) {
  return {
    id: stableId(label), type: 'function', z: MAIN_Z, name, func, outputs,
    setupErrors: 0, functionErrors: 0, closeErrors: 0,
    initialize: '', finalize: '', x, y, wires
  };
}
function fnInZ(label, z, name, func, x, y, outputs = 1, wires = []) {
  const node = fn(label, name, func, x, y, outputs, wires);
  node.z = z;
  return node;
}
function httpIn(label, method, url, name, x, y, target) {
  return {
    id: stableId(label), type: 'http in', z: MAIN_Z, name, url, method,
    upload: false, skipBodyParsing: false, x, y, wires: [[target]]
  };
}
function httpResponse(label, name, x, y) {
  return {
    id: stableId(label), type: 'http response', z: MAIN_Z, name,
    statusCode: '', headers: {}, x, y, wires: []
  };
}
function injectOnce(label, name, x, y, target) {
  return {
    id: stableId(label), type: 'inject', z: MAIN_Z, name,
    props: [
      { p: 'payload' },
      { p: 'topic', vt: 'str' },
      { p: '_vueDeployInit', v: 'true', vt: 'bool' }
    ],
    repeat: '', crontab: '', once: true, onceDelay: 0.2,
    topic: '', payload: '', payloadType: 'date',
    x, y, wires: [[target]]
  };
}
function comment(label, name, info, x, y, width) {
  const n = { id: stableId(label), type: 'comment', z: MAIN_Z, name, info, x, y, wires: [] };
  if (width) n.width = width;
  return n;
}
function catchNode(label, name, scope, x, y, target) {
  return {
    id: stableId(label), type: 'catch', z: MAIN_Z, name, scope,
    uncaught: false, x, y, wires: [[target]]
  };
}
function tagNode(label, action, x, y, target, extra = '') {
  return fn(label, `API: ${action}`, `msg._apiAction = ${JSON.stringify(action)};\n${extra}return msg;`, x, y, 1, [[target]]);
}
function transportNode(label, name, x, y, apiTarget, legacyTarget) {
  return fn(
    label,
    name,
    "const transport = String(msg._transport || '');\nif (transport === 'http' || transport.startsWith('vue')) return [msg, null];\nreturn [null, msg];",
    x,
    y,
    2,
    [[apiTarget], [legacyTarget]]
  );
}
function find(nodes, id) {
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new Error(`Node not found: ${id}`);
  return node;
}
function setOutput(nodes, id, output, targets) {
  const node = find(nodes, id);
  node.wires = Array.isArray(node.wires) ? node.wires : [];
  while (node.wires.length <= output) node.wires.push([]);
  node.wires[output] = targets;
}
function safeEnvFunction(func) {
  let out = String(func || '');
  if (!out.includes('AXET_CLIENT_SECRET')) return out;
  out = out.replace(/let\s+env\s*=\s*\{/g, 'let runtimeEnv = {');
  out = out.replace(/\benv\.(logsFolder|filesFolder|filesFolderFP|fullPath|root|slash)\b/g, 'runtimeEnv.$1');
  out = out.replace(/global\.set\((['"])env\1,\s*env\s*\)/g, 'global.set("env", runtimeEnv)');
  const insertAfter = 'const path = require("path");';
  const helper = `\n\nfunction runtimeSecret(key, fallback = '') {\n    try {\n        const value = (typeof env !== 'undefined' && env && typeof env.get === 'function') ? env.get(key) : '';\n        return value || fallback;\n    } catch (_) {\n        return fallback;\n    }\n}`;
  if (!out.includes('function runtimeSecret(')) {
    if (out.includes(insertAfter)) out = out.replace(insertAfter, insertAfter + helper);
    else out = helper.trimStart() + '\n' + out;
  }
  out = out.replace(/AXET_CLIENT_ID:\s*['"][^'"]*['"]/g, 'AXET_CLIENT_ID: runtimeSecret("AXET_CLIENT_ID")');
  out = out.replace(/AXET_CLIENT_SECRET:\s*['"][^'"]*['"]/g, 'AXET_CLIENT_SECRET: runtimeSecret("AXET_CLIENT_SECRET")');
  out = out.replace(/AXET_SCOPE:\s*['"][^'"]*['"]/g, 'AXET_SCOPE: runtimeSecret("AXET_SCOPE", "api://2f72c6d3-2d2e-4800-b458-1642e97f9dff/.default")');
  return out;
}

function build(cutover) {
  const nodes = JSON.parse(JSON.stringify(original));

  // Remove an earlier POC, if the source flow ever contains one.
  const filtered = nodes.filter((node) => !String(node.name || '').startsWith('[VUE MIGRATION]') && node.appId !== 'references-codex');
  nodes.length = 0;
  nodes.push(...filtered);

  // Configure SPA module and remove embedded credentials from the generated export.
  const globalConfig = nodes.find((node) => node.type === 'global-config');
  if (!globalConfig) throw new Error('global-config not found');
  globalConfig.modules = { ...(globalConfig.modules || {}), 'axet-flows-contrib-nodes-axet-ui-spa': '1.0.1' };
  const envNode = nodes.find((node) => node.id === '8344d78c784d16e9');
  if (envNode?.func) envNode.func = safeEnvFunction(envNode.func);

  const apiResponseId = stableId('http-response-common');
  const binaryResponseId = stableId('binary-response');
  const jsonResponseId = stableId('json-response');
  const errorResponseId = stableId('error-response');
  const manaNormalizeId = stableId('mana-normalize');
  const manaUploadCleanupId = stableId('mana-upload-cleanup');
  const readRouterId = stableId('read-router');
  const stopHandlerId = stableId('stop-handler');
  const sessionActionId = stableId('session-action');
  const envGateId = stableId('environment-init-gate');
  const finalBackgroundGateId = stableId('final-background-gate');
  const stagedUploadCleanupId = stableId('staged-upload-cleanup');

  const newNodes = [];

  newNodes.push(injectOnce(
    'environment-init',
    '[VUE MIGRATION] Initialize runtime environment on deploy',
    170, 300,
    '8344d78c784d16e9'
  ));
  newNodes.push(fn(
    'environment-init-gate',
    '[VUE MIGRATION] Environment init gate',
    "if (msg._vueDeployInit === true) return null;\nreturn msg;",
    650, 240, 1, [['fb3b71e1d4d5fa2a']]
  ));
  setOutput(nodes, '8344d78c784d16e9', 0, [envGateId]);

  newNodes.push(comment(
    'comment-architecture',
    '[VUE MIGRATION] SPA + API HTTP',
    'Frontend Vue completo. Todas las llamadas de negocio son relativas a ./api/. El usuario se obtiene desde /_auth/user. Los endpoints adaptan las peticiones HTTP al contrato msg.submission del backend existente.',
    3780, 80, 520
  ));

  newNodes.push({
    id: stableId('spa-app'),
    type: 'axet-spa-app',
    z: MAIN_Z,
    name: '[VUE MIGRATION] References Codex Vue',
    appId: 'references-codex',
    appName: 'References Codex',
    mode: 'http',
    entryFile: 'index.html',
    gitUrl: '',
    gitBranch: 'main',
    gitSubdir: '',
    gitInstallCmd: 'npm ci',
    gitBuildCmd: 'npm run build',
    gitOutputDir: 'dist',
    gitArtifactOnly: false,
    authType: 'none',
    customOkta: false,
    issuer: '', clientId: '', clientSecret: '', audience: '', scopes: '', redirectUri: '',
    sessionExpireTimeInMinutes: 90,
    accessControl: 'auto',
    accessRulesCollection: '', accessUsersCollection: '', accessProjectsCollection: '',
    accessCacheTtl: 60, accessBypassRoles: '',
    sseRetentionMs: 60000, sseMaxSessions: 5000, sseMaxOutboxBytes: 262144,
    x: 3980, y: 130, wires: []
  });

  newNodes.push(httpResponse('http-response-common', '[VUE MIGRATION] HTTP response', 4700, 920));
  newNodes.push(fn('binary-response', '[VUE MIGRATION] Binary download response', readFunction('api-binary-response.js'), 4420, 1040, 1, [[apiResponseId]]));
  newNodes.push(fn('json-response', '[VUE MIGRATION] JSON action response', readFunction('api-json-normalize.js'), 4420, 1100, 1, [[apiResponseId]]));
  newNodes.push(fn('error-response', '[VUE MIGRATION] Error response', readFunction('api-error-response.js'), 4420, 1160, 1, [[apiResponseId]]));
  newNodes.push(fn('mana-normalize', '[VUE MIGRATION] Normalize MANA response', readFunction('api-mana-normalize.js'), 4500, 1220, 1, [[apiResponseId]]));
  newNodes.push(fn('mana-upload-cleanup', '[VUE MIGRATION] Cleanup MANA staged uploads', readFunction('api-cleanup-staged-uploads.js'), 4280, 1220, 1, [[manaNormalizeId]]));

  // Read API routes.
  newNodes.push(comment('comment-read-api', '[VUE MIGRATION] API de lectura', 'Bootstrap, oportunidades paginadas, sesión activa, progreso, resultados y logs.', 3780, 220, 460));
  newNodes.push(fn('read-router', '[VUE MIGRATION] Read API router', readFunction('api-read-router.js'), 4320, 480, 1, [[apiResponseId]]));
  const readRoutes = [
    ['health', 'get', '/references-codex/api/health', 'Health', 230],
    ['bootstrap', 'get', '/references-codex/api/bootstrap', 'Bootstrap', 260],
    ['opportunities', 'get', '/references-codex/api/opportunities', 'Oportunidades', 320],
    ['active', 'get', '/references-codex/api/executions/active', 'Sesión activa', 380],
    ['status', 'get', '/references-codex/api/executions/:sessionId', 'Estado ejecución', 440],
    ['results', 'get', '/references-codex/api/executions/:sessionId/results', 'Resultados', 500],
    ['logs', 'get', '/references-codex/api/logs', 'Logs', 560],
    ['mana-bootstrap', 'get', '/references-codex/api/mana/bootstrap', 'MANA bootstrap', 620]
  ];
  for (const [action, method, url, title, y] of readRoutes) {
    const tagId = stableId(`tag-read-${action}`);
    newNodes.push(httpIn(`http-read-${action}`, method, url, `[VUE MIGRATION] GET ${title}`, 3600, y, tagId));
    newNodes.push(tagNode(`tag-read-${action}`, action, 3940, y, readRouterId));
  }

  // Upload API.
  const uploadCreateId = stableId('upload-create');
  const uploadDeleteId = stableId('upload-delete');
  newNodes.push(comment('comment-write-api', '[VUE MIGRATION] API de escritura', 'Uploads temporales, inicio, parada, liberación y acciones de resultado.', 3780, 700, 460));
  newNodes.push(httpIn('http-upload-create', 'post', '/references-codex/api/uploads', '[VUE MIGRATION] POST upload', 3600, 750, uploadCreateId));
  newNodes.push(fn('upload-create', '[VUE MIGRATION] Store temporary upload', readFunction('api-upload-create.js'), 4060, 750, 1, [[apiResponseId]]));
  newNodes.push(httpIn('http-upload-delete', 'delete', '/references-codex/api/uploads/:uploadId', '[VUE MIGRATION] DELETE upload', 3600, 810, uploadDeleteId));
  newNodes.push(fn('upload-delete', '[VUE MIGRATION] Delete temporary upload', readFunction('api-upload-delete.js'), 4060, 810, 1, [[apiResponseId]]));

  // Start execution: HTTP response is immediate; second output enters the existing backend.
  const startHandlerId = stableId('start-handler');
  newNodes.push(httpIn('http-start', 'post', '/references-codex/api/executions', '[VUE MIGRATION] POST execution', 3600, 900, startHandlerId));
  newNodes.push(fn(
    'start-handler',
    '[VUE MIGRATION] Accept execution + adapt msg.submission',
    readFunction('api-start.js'),
    4050, 900, 2,
    [[apiResponseId], ['c89f58e0bee76524']]
  ));

  // Stop / release.
  newNodes.push(fn('stop-handler', '[VUE MIGRATION] Stop or release execution', readFunction('api-stop-release.js'), 4300, 980, 1, [[apiResponseId]]));
  for (const [action, url, y] of [
    ['stop', '/references-codex/api/executions/:sessionId/stop', 960],
    ['release', '/references-codex/api/executions/:sessionId/release', 1020]
  ]) {
    const tagId = stableId(`tag-${action}`);
    newNodes.push(httpIn(`http-${action}`, 'post', url, `[VUE MIGRATION] POST ${action}`, 3600, y, tagId));
    newNodes.push(tagNode(`tag-${action}`, action, 3970, y, stopHandlerId));
  }

  // Existing result-generation branches.
  newNodes.push(fn(
    'session-action',
    '[VUE MIGRATION] Resolve session action',
    readFunction('api-session-action.js'),
    4280, 1360, 4,
    [['510ba6ec08000d02'], ['ab71839a79f508c9'], ['72de8cbe39b8b9d0'], [errorResponseId]]
  ));
  const actionRoutes = [
    ['export-excel', '/references-codex/api/executions/:sessionId/export/excel', 'Excel', 1280],
    ['export-template', '/references-codex/api/executions/:sessionId/export/template', 'DOCX/PPTX', 1340],
    ['sharepoint', '/references-codex/api/executions/:sessionId/sharepoint', 'SharePoint', 1400]
  ];
  for (const [action, url, title, y] of actionRoutes) {
    const tagId = stableId(`tag-action-${action}`);
    newNodes.push(httpIn(`http-action-${action}`, 'post', url, `[VUE MIGRATION] POST ${title}`, 3600, y, tagId));
    newNodes.push(tagNode(`tag-action-${action}`, action, 3970, y, sessionActionId));
  }

  // Preserve HTTP context on explicit PPTX errors and make the SharePoint empty-queue error catchable.
  const pptxInjector = find(nodes, 'ae810650ebcbaa12');
  pptxInjector.func = String(pptxInjector.func || '').replace(
    "node.send([null, { payload: { message: 'Error generando PPTX local', error: err.message } }]);",
    "node.send([null, { ...msg, payload: { message: 'Error generando PPTX local', error: err.message } }]);"
  );
  if (!pptxInjector.func.includes("{ ...msg, payload: { message: 'Error generando PPTX local'")) {
    throw new Error('Could not patch PPTX injector HTTP error context');
  }
  const sharePointQueue = find(nodes, '392510151ef3dc48');
  sharePointQueue.func = String(sharePointQueue.func || '').replace(
    "node.error('❌ No hay ficheros generados para subir a SharePoint');",
    "node.error('❌ No hay ficheros generados para subir a SharePoint', msg);"
  );
  if (!sharePointQueue.func.includes("node.error('❌ No hay ficheros generados para subir a SharePoint', msg);")) {
    throw new Error('Could not make SharePoint empty-queue error catchable');
  }

  // Re-route final result nodes based on transport while retaining legacy Form.io in parallel mode.
  const excelTransport = transportNode('transport-excel', '[VUE MIGRATION] Excel: HTTP or Form.io', 1370, 1220, binaryResponseId, '8d80e99f6064d41e');
  const templateTransport = transportNode('transport-template', '[VUE MIGRATION] Document: HTTP or Form.io', 2750, 1340, binaryResponseId, '5d72a40b6e8427ef');
  const sharepointTransport = transportNode('transport-sharepoint', '[VUE MIGRATION] SharePoint: HTTP or Form.io', 3290, 1300, jsonResponseId, '8e76a82b267e3c52');
  newNodes.push(excelTransport, templateTransport, sharepointTransport);
  setOutput(nodes, 'a3ac7e2605af1606', 0, [excelTransport.id]);
  setOutput(nodes, '1ec68cb1dbe8be47', 0, [templateTransport.id]);
  setOutput(nodes, 'b5717aa8be9c2e7f', 0, [sharepointTransport.id]);
  find(nodes, '8d80e99f6064d41e').x = 1650;
  find(nodes, '5d72a40b6e8427ef').x = 3040;
  find(nodes, '8e76a82b267e3c52').x = 3560;

  // Template-generation explicit error outputs.
  const templateErrorTransport = transportNode('transport-template-error', '[VUE MIGRATION] Generation error: HTTP or Form.io', 2130, 1520, errorResponseId, '6049bd72f83ec32d');
  newNodes.push(templateErrorTransport);
  for (const id of ['53077d49373ec222', 'ae810650ebcbaa12']) {
    const current = find(nodes, id).wires?.[1] || [];
    setOutput(nodes, id, 1, [...current.filter((target) => target !== '6049bd72f83ec32d'), templateErrorTransport.id]);
  }

  // Catch errors across the complete Excel / DOCX / PPTX / SharePoint result branches.
  // The two document injectors are excluded because they already expose an explicit error output.
  // Their error messages are patched below so the HTTP transport context is preserved.
  const exportScope = [
    '578892a3ee1b1227', '9365734e99000cd5', 'a3ac7e2605af1606',
    'cca56e93b9459f83', '81d41bd418935de5', 'e8eecd2c0abbf954',
    '2f6877b1601950bf', '6d75f4bde6a8e0bb', '9a9238a79955531e',
    '392510151ef3dc48', 'ab8bc279421fc878', '2062be1755994581',
    '2ea886fa1ab5f030', '1ec68cb1dbe8be47', 'b5717aa8be9c2e7f'
  ];
  const exportCatchGate = transportNode('transport-export-catch', '[VUE MIGRATION] Export catch: HTTP or Form.io', 4040, 1500, errorResponseId, '6049bd72f83ec32d');
  newNodes.push(exportCatchGate);
  newNodes.push(catchNode(
    'catch-export',
    '[VUE MIGRATION] Catch export errors',
    exportScope,
    3800, 1500, exportCatchGate.id
  ));

  // MANA API and adapters.
  const manaActionId = stableId('mana-action');
  newNodes.push(comment('comment-mana', '[VUE MIGRATION] API MANA', 'Subir, comprobar, listar y eliminar documentos de oportunidad reutilizando los nodos Graph actuales.', 3780, 1600, 460));
  newNodes.push(httpIn('http-mana-action', 'post', '/references-codex/api/mana/actions', '[VUE MIGRATION] POST MANA action', 3600, 1660, manaActionId));
  newNodes.push(fn(
    'mana-action',
    '[VUE MIGRATION] Adapt MANA action',
    readFunction('api-mana-action.js'),
    4040, 1660, 3,
    [['ae4a8de39f6a5481'], ['7ac4b50c2cf548c1'], [errorResponseId]]
  ));

  const manaBoundaries = [
    ['mana-upload', '76451753b678684b', 0, '86741cc9b41c2658', 1650, 1640],
    ['mana-check', '7ea175ab46433b30', 0, 'b36b4ba5425076e1', 2140, 2050],
    ['mana-list-delete', '21e14ddb8d5ca39d', 0, '7d8338253b8c1f9d', 1650, 1800],
    ['mana-delete-result', '3eef32465ffefd1e', 0, 'b36b4ba5425076e1', 2140, 2135],
    ['mana-upload-error', 'c8ef8978b39065a1', 0, '1655774b728141cd', 790, 1880],
    ['mana-delete-validation', '7ac4b50c2cf548c1', 1, '8f210509046a42b7', 920, 2215]
  ];
  for (const [label, sourceId, outputIndex, legacyId, x, y] of manaBoundaries) {
    const apiTarget = label === 'mana-upload' ? manaUploadCleanupId : manaNormalizeId;
    const transport = transportNode(`transport-${label}`, `[VUE MIGRATION] ${label}: HTTP or Form.io`, x, y, apiTarget, legacyId);
    newNodes.push(transport);
    const originalTargets = find(nodes, sourceId).wires?.[outputIndex] || [];
    setOutput(nodes, sourceId, outputIndex, [...originalTargets.filter((target) => target !== legacyId), transport.id]);
  }
  find(nodes, '86741cc9b41c2658').x = 1990;
  find(nodes, 'b36b4ba5425076e1').x = 2450;
  find(nodes, '7d8338253b8c1f9d').x = 1990;
  find(nodes, '8f210509046a42b7').x = 1240;



  // Clean staged uploads only after the existing Extract Security Context node has copied them into the workspace.
  const extractNode = find(nodes, '18802043bb3d589b');
  const extractTargets = (extractNode.wires?.[0] || []).slice();
  newNodes.push(fnInZ(
    'staged-upload-cleanup',
    EXECUTION_Z,
    '[VUE MIGRATION] Cleanup staged uploads after materialization',
    readFunction('api-cleanup-staged-uploads.js'),
    430, 380, 1, [extractTargets]
  ));
  setOutput(nodes, '18802043bb3d589b', 0, [stagedUploadCleanupId]);

  // The existing finalizer must still persist monitoring and clean the active session, but Vue jobs must not emit Form.io redirects.
  newNodes.push(fn(
    'final-background-gate',
    '[VUE MIGRATION] Suppress legacy final redirect for Vue',
    "const isVue = Boolean(msg.__vueExecution) || String(msg._transport || '').startsWith('vue');\nif (isVue) return null;\nreturn msg;",
    1110, 1100, 1, [['3256255457c58600']]
  ));
  setOutput(nodes, 'a4013f4e7ca38731', 0, [finalBackgroundGateId]);

  // Suppress the legacy redirect emitted by the old progress branch for Vue-started background jobs.
  const progressGate = fnInZ(
    'execution-progress-view-gate',
    EXECUTION_Z,
    '[VUE MIGRATION] Suppress legacy progress redirect',
    "const transport = String(msg._transport || '');\nif (transport === 'http' || transport.startsWith('vue')) return null;\nreturn msg;",
    730, 580, 1, [['c01106f385abba80']]
  );
  newNodes.push(progressGate);
  setOutput(nodes, '733e6e6f17e9e0c4', 0, [progressGate.id]);
  find(nodes, 'c01106f385abba80').x = 980;

  // Add documentation comments near the old front and API sections.
  newNodes.push(comment(
    'comment-contract',
    '[VUE MIGRATION] Contrato conservado',
    'POST /api/executions construye exactamente los campos que esperaba el formulario: includeProcessed, includeOpportunity, includeUploads, unidad/proyecto, opportunityId, uploadFiles, idioma, plantilla, sector_outputformat e instruccionEspecifica. Desde ahí se reutiliza el subflujo Ejecucion (1).',
    3800, 1810, 520
  ));

  nodes.push(...newNodes);

  if (cutover) {
    for (const node of nodes) {
      if (node.type === 'axetflows-form' || node.type === 'axetflows-view-action' || node.type === 'axetflows-app') {
        node.d = true;
      }
    }
  }

  // Keep the SPA active in both modes.
  const spa = nodes.find((node) => node.id === stableId('spa-app'));
  if (spa) delete spa.d;

  return nodes;
}

function validate(nodes, mode) {
  const ids = new Set();
  for (const node of nodes) {
    if (!node.id) throw new Error(`${mode}: node without id`);
    if (ids.has(node.id)) throw new Error(`${mode}: duplicate id ${node.id}`);
    ids.add(node.id);
  }
  const missing = [];
  for (const node of nodes) {
    for (const targets of node.wires || []) {
      for (const target of targets || []) if (!ids.has(target)) missing.push(`${node.id}->${target}`);
    }
    for (const target of node.links || []) if (!ids.has(target)) missing.push(`${node.id}=>${target}`);
  }
  if (missing.length) throw new Error(`${mode}: missing references: ${missing.slice(0, 20).join(', ')}`);
  const spa = nodes.find((node) => node.type === 'axet-spa-app' && node.appId === 'references-codex');
  if (!spa) throw new Error(`${mode}: SPA node missing`);
  const httpNodes = nodes.filter((node) => node.type === 'http in');
  const httpCount = httpNodes.length;
  if (httpCount < 15) throw new Error(`${mode}: expected >=15 HTTP routes, found ${httpCount}`);
  const routeKeys = new Set();
  for (const route of httpNodes) {
    const key = `${String(route.method || 'get').toUpperCase()} ${route.url}`;
    if (routeKeys.has(key)) throw new Error(`${mode}: duplicate HTTP route ${key}`);
    routeKeys.add(key);
  }
  const serialized = JSON.stringify(nodes);
  if (/AXET_CLIENT_SECRET\s*:\s*["'][^"']{8,}/.test(serialized)) throw new Error(`${mode}: embedded AXET client secret remains`);
  return { nodeCount: nodes.length, httpCount, formCount: nodes.filter((n) => n.type === 'axetflows-form').length, disabledLegacy: nodes.filter((n) => n.d && ['axetflows-form','axetflows-view-action','axetflows-app'].includes(n.type)).length };
}

const parallel = build(false);
const cutover = build(true);
const parallelStats = validate(parallel, 'parallel');
const cutoverStats = validate(cutover, 'cutover');

const parallelPath = path.join(OUT_DIR, 'flows-references-codex-vue-PARALLEL.json');
const cutoverPath = path.join(OUT_DIR, 'flows-references-codex-vue-CUTOVER.json');
fs.writeFileSync(parallelPath, JSON.stringify(parallel, null, 4) + '\n');
fs.writeFileSync(cutoverPath, JSON.stringify(cutover, null, 4) + '\n');

const originalIds = new Set(original.map((node) => node.id));
const addedNodes = parallel.filter((node) => !originalIds.has(node.id));
fs.writeFileSync(path.join(OUT_DIR, 'flows-references-codex-vue-added-nodes.json'), JSON.stringify(addedNodes, null, 4) + '\n');

const manifest = {
  generatedAt: new Date().toISOString(),
  source: path.basename(INPUT),
  appId: 'references-codex',
  basePath: '/references-codex',
  modes: {
    PARALLEL: { description: 'Vue y Form.io disponibles simultáneamente', ...parallelStats },
    CUTOVER: { description: 'SPA Vue activa; nodos Form.io/app/view-action deshabilitados', ...cutoverStats }
  },
  routes: [
    'GET /references-codex/api/health',
    'GET /references-codex/api/bootstrap',
    'GET /references-codex/api/opportunities',
    'POST /references-codex/api/uploads',
    'DELETE /references-codex/api/uploads/:uploadId',
    'POST /references-codex/api/executions',
    'GET /references-codex/api/executions/active',
    'GET /references-codex/api/executions/:sessionId',
    'POST /references-codex/api/executions/:sessionId/stop',
    'POST /references-codex/api/executions/:sessionId/release',
    'GET /references-codex/api/executions/:sessionId/results',
    'GET /references-codex/api/logs',
    'POST /references-codex/api/executions/:sessionId/export/excel',
    'POST /references-codex/api/executions/:sessionId/export/template',
    'POST /references-codex/api/executions/:sessionId/sharepoint',
    'GET /references-codex/api/mana/bootstrap',
    'POST /references-codex/api/mana/actions'
  ],
  existingBackendEntry: 'c89f58e0bee76524',
  existingBackendEntryType: 'function -> subflow:6efe739b.ee17.4dc8.83b2.ee1138c607b7',
  warnings: [
    'Configure gitUrl in the axet-spa-app node before deployment.',
    'Configure AXET_CLIENT_ID, AXET_CLIENT_SECRET and AXET_SCOPE as runtime environment variables.',
    'Rotate the credential that was embedded in the source export.'
  ]
};
fs.writeFileSync(path.join(OUT_DIR, 'migration-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ parallelPath, cutoverPath, parallelStats, cutoverStats, addedNodes: addedNodes.length }, null, 2));
