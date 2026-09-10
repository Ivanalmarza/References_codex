'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'references-codex-vue-'));
const FUNCTIONS = path.join(__dirname, '..', 'flows', 'functions');
const globalMap = new Map();
const flowMap = new Map();
const logs = [];

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  mkdir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function security(user = 'ivan@example.com', axetUserId = 'user-1', roles = ['ROLE_PUBLIC']) {
  return {
    login: user,
    axetUserId,
    oktaId: `okta-${axetUserId}`,
    userRoles: roles,
    externalIdpUserInfo: {
      preferred_username: user,
      email: user,
      sub: `sub-${axetUserId}`,
      access_token: 'access-token',
      id_token: 'id-token',
      refresh_token: 'refresh-token',
    },
  };
}

function cloneMessage(value) {
  return structuredClone(value);
}

function executeFunction(fileName, msg, overrides = {}) {
  const filePath = path.join(FUNCTIONS, fileName);
  let source = fs.readFileSync(filePath, 'utf8');
  source = source.split('/internal-storage-files/files').join(ROOT.replace(/\\/g, '/'));

  const node = {
    warn: (...args) => logs.push(['warn', ...args]),
    error: (...args) => logs.push(['error', ...args]),
    status: (...args) => logs.push(['status', ...args]),
    send: (...args) => logs.push(['send', ...args]),
    ...(overrides.node || {}),
  };
  const globalContext = overrides.global || {
    get: (key) => globalMap.get(key),
    set: (key, value) => globalMap.set(key, value),
  };
  const flow = overrides.flow || {
    get: (key) => flowMap.get(key),
    set: (key, value) => flowMap.set(key, value),
  };
  const env = overrides.env || { get: () => '' };
  const RED = overrides.RED || { util: { cloneMessage } };

  const fn = new Function(
    'msg', 'node', 'global', 'flow', 'env', 'RED', 'Buffer', 'require', 'process',
    source,
  );
  return fn(msg, node, globalContext, flow, env, RED, Buffer, require, process);
}

function apiMsg(action, user = 'ivan@example.com', extra = {}) {
  const axetUserId = extra.axetUserId || 'user-1';
  return {
    _apiAction: action,
    __axetFlowsSecurityContext: security(user, axetUserId),
    req: { query: {}, params: {}, user: { email: user }, ...(extra.req || {}) },
    payload: extra.payload || {},
    ...Object.fromEntries(Object.entries(extra).filter(([key]) => !['req', 'payload', 'axetUserId'].includes(key))),
  };
}

function functionSyntaxChecks() {
  const files = fs.readdirSync(FUNCTIONS).filter((name) => name.endsWith('.js'));
  for (const name of files) {
    const source = fs.readFileSync(path.join(FUNCTIONS, name), 'utf8');
    // Node-RED Function-node source can contain a top-level return, so parse it as a function body.
    new Function('msg', 'node', 'global', 'flow', 'env', 'RED', 'Buffer', 'require', 'process', source);
  }
  return files.length;
}

function seedCatalog() {
  const items = [];
  for (let index = 0; index < 45_000; index += 1) {
    items.push({
      opportunityId: `SF-${String(index).padStart(6, '0')}`,
      businessOpportunityId: index === 1234 ? 'OPP-1234' : `OPP-X${index}`,
      title: `Opportunity ${index}`,
      sector: `Sector ${index % 5}`,
      unit: `Unit ${index % 10}`,
      customerName: `Customer ${index % 50}`,
      country: index % 2 ? 'ES' : 'PT',
      folderName: `folder-${index}`,
      documentCount: index % 8,
      hasPdf: index % 2 === 0,
      hasCsv: index % 3 === 0,
      indexStatus: 'Ready',
    });
  }
  writeJson(path.join(ROOT, 'opportunities_index.json'), {
    generatedAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
    total: items.length,
    items,
  });
  writeJson(path.join(ROOT, 'opportunities_filters.json'), {
    sectors: Array.from({ length: 5 }, (_, index) => ({ name: `Sector ${index}` })),
  });
  mkdir(path.join(ROOT, 'procesado', 'Unit A', 'Project A', 'markdown'));
  fs.writeFileSync(path.join(ROOT, 'procesado', 'Unit A', 'Project A', 'markdown', 'input.md'), '# Test', 'utf8');
  mkdir(path.join(ROOT, 'plantillas'));
  fs.writeFileSync(path.join(ROOT, 'plantillas', 'PPTX_General.pptx'), 'test', 'utf8');
  fs.writeFileSync(path.join(ROOT, 'plantillas', 'Reference.docx'), 'test', 'utf8');
}

function readApiChecks() {
  seedCatalog();
  const healthMsg = apiMsg('health');
  executeFunction('api-read-router.js', healthMsg);
  assert.equal(healthMsg.statusCode, 200);
  assert.equal(healthMsg.payload.service, 'references-codex-vue-api');

  const bootstrapMsg = apiMsg('bootstrap');
  executeFunction('api-read-router.js', bootstrapMsg);
  assert.equal(bootstrapMsg.statusCode, 200);
  assert.equal(bootstrapMsg.payload.options.processedUnits[0].value, 'Unit A');
  assert.equal(bootstrapMsg.payload.options.templates.length, 2);
  assert.equal(bootstrapMsg.payload.options.opportunitySectors.length, 5);
  assert.equal(bootstrapMsg.payload.app.legacy.adminFilesAvailable, false);
  assert.equal(Object.prototype.hasOwnProperty.call(bootstrapMsg.payload, 'items'), false);
  assert.ok(JSON.stringify(bootstrapMsg.payload).length < 50_000, 'bootstrap must stay compact');

  const startedAt = Date.now();
  const facetsMsg = apiMsg('opportunities', 'ivan@example.com', {
    req: { query: { sector: 'Sector 4' }, params: {} },
  });
  executeFunction('api-read-router.js', facetsMsg);
  const catalogBuildMs = Date.now() - startedAt;
  assert.equal(facetsMsg.statusCode, 200);
  assert.equal(facetsMsg.payload.index.total, 45_000);
  assert.equal(facetsMsg.payload.requiresFilter, true);
  assert.ok(facetsMsg.payload.facets.units.some((item) => item.value === 'Unit 4'));
  assert.equal(facetsMsg.payload.items.length, 0);

  const filteredMsg = apiMsg('opportunities', 'ivan@example.com', {
    req: { query: { sector: 'Sector 4', unit: 'Unit 4', customer: 'Customer 34', page: '1', size: '25' }, params: {} },
  });
  executeFunction('api-read-router.js', filteredMsg);
  assert.equal(filteredMsg.statusCode, 200);
  assert.equal(filteredMsg.payload.items.length, 25);
  assert.ok(filteredMsg.payload.pagination.total > 25);
  assert.ok(filteredMsg.payload.items.every((item) => item.sector === 'Sector 4' && item.unit === 'Unit 4' && item.customer === 'Customer 34'));

  const businessMsg = apiMsg('opportunities', 'ivan@example.com', {
    req: { query: { businessId: '1234' }, params: {} },
  });
  executeFunction('api-read-router.js', businessMsg);
  assert.equal(businessMsg.statusCode, 200);
  assert.equal(businessMsg.payload.items.length, 1);
  assert.equal(businessMsg.payload.items[0].opportunityId, 'SF-001234');

  const shortSearch = apiMsg('opportunities', 'ivan@example.com', {
    req: { query: { q: 'ab' }, params: {} },
  });
  executeFunction('api-read-router.js', shortSearch);
  assert.equal(shortSearch.statusCode, 400);
  assert.equal(shortSearch.payload.error, 'SEARCH_TOO_SHORT');

  return { catalogBuildMs, catalogSize: 45_000 };
}

function uploadChecks() {
  const uploadMsg = apiMsg(null, 'ivan@example.com', {
    payload: {
      name: 'proposal.pdf',
      type: 'application/pdf',
      scope: 'execution',
      data: `data:application/pdf;base64,${Buffer.from('sample-pdf').toString('base64')}`,
    },
  });
  executeFunction('api-upload-create.js', uploadMsg);
  assert.equal(uploadMsg.statusCode, 201);
  assert.match(uploadMsg.payload.upload.uploadId, /^[a-f0-9]{36}$/);
  const uploadId = uploadMsg.payload.upload.uploadId;

  const manaMsg = apiMsg(null, 'ivan@example.com', {
    payload: { action: 'upload', opportunityId: 'SF-001234', uploadIds: [uploadId] },
  });
  const manaOutput = executeFunction('api-mana-action.js', manaMsg);
  assert.equal(Array.isArray(manaOutput), true);
  assert.equal(manaOutput[0].submission.data.crudAction, 'upload');
  assert.equal(manaOutput[0].submission.data.uploadFile.length, 1);
  assert.ok(fs.existsSync(manaOutput[0].submission.data.uploadFile[0].path));

  executeFunction('api-cleanup-staged-uploads.js', manaOutput[0]);
  const uploadDir = path.dirname(manaOutput[0].submission.data.uploadFile[0].path);
  assert.equal(fs.existsSync(uploadDir), false);

  const secondUpload = apiMsg(null, 'ivan@example.com', {
    payload: {
      name: 'notes.txt',
      type: 'text/plain',
      data: Buffer.from('notes').toString('base64'),
    },
  });
  executeFunction('api-upload-create.js', secondUpload);
  const secondId = secondUpload.payload.upload.uploadId;
  const deleteMsg = apiMsg(null, 'ivan@example.com', {
    req: { query: {}, params: { uploadId: secondId } },
  });
  executeFunction('api-upload-delete.js', deleteMsg);
  assert.equal(deleteMsg.statusCode, 200);
  assert.equal(deleteMsg.payload.deleted, true);

  return { uploadCreate: true, uploadDelete: true, manaHydration: true };
}

function startChecks() {
  const traversalMsg = apiMsg(null, 'ivan@example.com', {
    payload: {
      includeProcessed: true,
      includeOpportunity: false,
      includeUploads: false,
      unidadProcesado: '..',
      proyectoProcesado: 'Project A',
      idioma: 'Español (ES)',
      plantilla: 'PPTX_General.pptx',
    },
  });
  const traversalOutput = executeFunction('api-start.js', traversalMsg);
  assert.equal(traversalOutput[0].statusCode, 400);

  const unknownTemplateMsg = apiMsg(null, 'ivan@example.com', {
    payload: {
      includeProcessed: true,
      includeOpportunity: false,
      includeUploads: false,
      unidadProcesado: 'Unit A',
      proyectoProcesado: 'Project A',
      idioma: 'Español (ES)',
      plantilla: 'Unknown.pptx',
    },
  });
  const unknownTemplateOutput = executeFunction('api-start.js', unknownTemplateMsg);
  assert.equal(unknownTemplateOutput[0].statusCode, 400);
  assert.equal(unknownTemplateOutput[0].payload.error, 'TEMPLATE_REQUIRED');

  const startMsg = apiMsg(null, 'ivan@example.com', {
    payload: {
      includeProcessed: true,
      includeOpportunity: false,
      includeUploads: false,
      unidadProcesado: 'Unit A',
      proyectoProcesado: 'Project A',
      idioma: 'Español (ES)',
      plantilla: 'PPTX_General.pptx',
      sector_outputformat: 'general',
      instruccionEspecifica: 'Mantener el detalle técnico.',
    },
  });
  const output = executeFunction('api-start.js', startMsg);
  assert.ok(Array.isArray(output));
  const [httpMsg, backgroundMsg] = output;
  assert.equal(httpMsg.statusCode, 202);
  assert.equal(httpMsg.payload.accepted, true);
  assert.match(httpMsg.payload.sessionId, /^[a-f0-9]{32}$/);
  assert.equal(backgroundMsg.submission.includeProcessed, true);
  assert.equal(backgroundMsg.submission.unidadProcesado, 'Unit A');
  assert.equal(backgroundMsg.submission.proyectoProcesado, 'Project A');
  assert.equal(backgroundMsg.submission.plantilla, 'PPTX_General.pptx');
  assert.equal(backgroundMsg.submission.extract, true);
  assert.equal(backgroundMsg._transport, 'vue-background');
  assert.equal(backgroundMsg.req, undefined);
  assert.equal(backgroundMsg.res, undefined);
  assert.ok(backgroundMsg.__axetFlowsSecurityContext.externalIdpUserInfo.access_token);

  const sessionId = httpMsg.payload.sessionId;
  const statePath = path.join(ROOT, 'codex-workspace', sessionId, 'codex-docs', 'SESSION_STATE.json');
  const ownerPath = path.join(ROOT, '_vue-session-owners', `${sessionId}.json`);
  assert.ok(fs.existsSync(statePath));
  assert.ok(fs.existsSync(ownerPath));
  assert.equal(readJson(statePath).lastCheckpoint, 'vue-api-queued');
  assert.equal(readJson(ownerPath).userKey, 'ivan@example.com');

  return { sessionId, statePath, ownerPath, traversalRejected: true, unknownTemplateRejected: true };
}

function sessionChecks(started) {
  const { sessionId, statePath } = started;
  const activePath = path.join(ROOT, '_active-sessions', 'ivan@example.com.json');
  writeJson(activePath, { sessionId, projectPath: path.dirname(path.dirname(path.dirname(statePath))), status: 'running', updatedAt: new Date().toISOString() });

  const statusMsg = apiMsg('status', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-read-router.js', statusMsg);
  assert.equal(statusMsg.statusCode, 200);
  assert.equal(statusMsg.payload.session.sessionId, sessionId);
  assert.equal(statusMsg.payload.session.ready, false);
  assert.equal(statusMsg.payload.session.canStop, true);

  const forbiddenMsg = apiMsg('status', 'other@example.com', {
    axetUserId: 'user-2',
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-read-router.js', forbiddenMsg);
  assert.equal(forbiddenMsg.statusCode, 403);

  const state = readJson(statePath);
  state.runtime = { status: 'Error', progress: 100, completed: true, success: false, error: 'boom' };
  state.execution = { finished: true, reason: 'implementation-error' };
  state.artifacts = { executionReport: path.join(path.dirname(statePath), 'EXECUTION_REPORT.md') };
  writeJson(statePath, state);
  fs.writeFileSync(path.join(path.dirname(statePath), 'EXECUTION_REPORT.md'), '# Failed report', 'utf8');

  const failedMsg = apiMsg('status', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-read-router.js', failedMsg);
  assert.equal(failedMsg.payload.session.failed, true);
  assert.equal(failedMsg.payload.session.ready, false);
  assert.equal(failedMsg.payload.session.terminal, true);

  const answersPath = path.join(path.dirname(statePath), 'output', 'respuestas.json');
  writeJson(answersPath, { Cliente: { respuesta: 'Test' } });
  const failedWithAnswers = apiMsg('status', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-read-router.js', failedWithAnswers);
  assert.equal(failedWithAnswers.payload.session.failed, true);
  assert.equal(failedWithAnswers.payload.session.ready, false, 'failed sessions must not redirect to successful results');

  const failedResults = apiMsg('results', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-read-router.js', failedResults);
  assert.equal(failedResults.statusCode, 200, 'terminal failed sessions must remain inspectable');
  assert.equal(failedResults.payload.failed, true);
  assert.equal(failedResults.payload.success, false);
  assert.deepEqual(failedResults.payload.answers, { Cliente: { respuesta: 'Test' } });

  const success = readJson(statePath);
  success.runtime = { status: 'Completado', progress: 100, completed: true, success: true, error: null };
  success.execution = { finished: true };
  success.resultReady = true;
  success.readyToRedirect = true;
  success.result = { success: true, sessionId };
  writeJson(statePath, success);

  const successMsg = apiMsg('status', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-read-router.js', successMsg);
  assert.equal(successMsg.payload.session.ready, true);
  assert.equal(successMsg.payload.session.failed, false);
  assert.equal(successMsg.payload.session.progress, 100);

  const resultsMsg = apiMsg('results', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-read-router.js', resultsMsg);
  assert.equal(resultsMsg.statusCode, 200);
  assert.deepEqual(resultsMsg.payload.answers, { Cliente: { respuesta: 'Test' } });

  const actionMsg = apiMsg('export-template', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  const actionOutput = executeFunction('api-session-action.js', actionMsg);
  assert.equal(actionOutput[0], null);
  assert.equal(actionOutput[1].sessionId, sessionId);
  assert.equal(actionOutput[1].submission.plantilla, 'PPTX_General.pptx');

  const stopState = readJson(statePath);
  stopState.runtime = { status: 'Running', completed: false, success: false };
  stopState.execution = { finished: false, stopped: false };
  stopState.resultReady = false;
  stopState.readyToRedirect = false;
  delete stopState.result;
  writeJson(statePath, stopState);

  const stopMsg = apiMsg('stop', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-stop-release.js', stopMsg);
  assert.equal(stopMsg.statusCode, 200);
  assert.equal(stopMsg.payload.stopped, true);
  assert.equal(readJson(statePath).execution.stopRequested, true);
  assert.equal(flowMap.get(`__front_stop:ivan@example.com:${sessionId}`).stopped, true);

  const stoppedResults = apiMsg('results', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
  });
  executeFunction('api-read-router.js', stoppedResults);
  assert.equal(stoppedResults.statusCode, 200, 'stopped sessions must remain inspectable');
  assert.equal(stoppedResults.payload.stopped, true);
  assert.equal(stoppedResults.payload.success, false);

  const releaseMsg = apiMsg('release', 'ivan@example.com', {
    req: { query: {}, params: { sessionId } },
    payload: {},
  });
  executeFunction('api-stop-release.js', releaseMsg);
  assert.equal(releaseMsg.statusCode, 200);
  assert.equal(releaseMsg.payload.released, true);
  assert.equal(fs.existsSync(activePath), false);

  return { authorization: true, status: true, failureGate: true, results: true, stopRelease: true };
}

function main() {
  const syntaxFunctions = functionSyntaxChecks();
  const catalog = readApiChecks();
  const uploads = uploadChecks();
  const started = startChecks();
  const sessions = sessionChecks(started);

  const summary = {
    ok: true,
    root: ROOT,
    syntaxFunctions,
    catalog,
    uploads,
    start: {
      accepted: true,
      sessionId: started.sessionId,
      traversalRejected: started.traversalRejected,
      unknownTemplateRejected: started.unknownTemplateRejected,
    },
    sessions,
    warningsCaptured: logs.filter(([kind]) => kind === 'warn').length,
    errorsCaptured: logs.filter(([kind]) => kind === 'error').length,
  };
  console.log(JSON.stringify(summary, null, 2));
  fs.rmSync(ROOT, { recursive: true, force: true });
}

try {
  main();
} catch (error) {
  console.error(error.stack || error);
  console.error(`Test root retained for inspection: ${ROOT}`);
  process.exitCode = 1;
}
