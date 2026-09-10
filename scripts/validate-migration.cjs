'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('/mnt/data/flows - 2026-09-02T122949.321.json');
const FLOWS_DIR = path.join(ROOT, 'flows');
const PARALLEL_PATH = path.join(FLOWS_DIR, 'flows-references-codex-vue-PARALLEL.json');
const CUTOVER_PATH = path.join(FLOWS_DIR, 'flows-references-codex-vue-CUTOVER.json');
const FUNCTIONS_DIR = path.join(FLOWS_DIR, 'functions');

const EXPECTED_ROUTES = [
  'get /references-codex/api/health',
  'get /references-codex/api/bootstrap',
  'get /references-codex/api/opportunities',
  'post /references-codex/api/uploads',
  'delete /references-codex/api/uploads/:uploadId',
  'post /references-codex/api/executions',
  'get /references-codex/api/executions/active',
  'get /references-codex/api/executions/:sessionId',
  'post /references-codex/api/executions/:sessionId/stop',
  'post /references-codex/api/executions/:sessionId/release',
  'get /references-codex/api/executions/:sessionId/results',
  'get /references-codex/api/logs',
  'post /references-codex/api/executions/:sessionId/export/excel',
  'post /references-codex/api/executions/:sessionId/export/template',
  'post /references-codex/api/executions/:sessionId/sharepoint',
  'get /references-codex/api/mana/bootstrap',
  'post /references-codex/api/mana/actions',
].sort();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function indexById(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function one(nodes, predicate, message) {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, `${message}: expected one, found ${matches.length}`);
  return matches[0];
}

function assertGraph(nodes, label) {
  const ids = new Set();
  for (const node of nodes) {
    assert.ok(node.id, `${label}: node without id`);
    assert.ok(!ids.has(node.id), `${label}: duplicate node id ${node.id}`);
    ids.add(node.id);
  }

  const missing = [];
  for (const node of nodes) {
    for (const output of node.wires || []) {
      for (const target of output || []) {
        if (!ids.has(target)) missing.push(`${node.id}->${target}`);
      }
    }
    for (const target of node.links || []) {
      if (!ids.has(target)) missing.push(`${node.id}=>${target}`);
    }
  }
  assert.deepEqual(missing, [], `${label}: missing graph targets`);
  return ids;
}

function assertOriginalNodesPreserved(original, generated, label) {
  const generatedById = indexById(generated);
  for (const node of original) {
    const current = generatedById.get(node.id);
    assert.ok(current, `${label}: original node missing ${node.id}`);
    assert.equal(current.type, node.type, `${label}: node type changed ${node.id}`);
    assert.equal(current.name || '', node.name || '', `${label}: node name changed ${node.id}`);
  }
}

function assertRoutes(nodes, label) {
  const routes = nodes
    .filter((node) => node.type === 'http in' && String(node.url || '').startsWith('/references-codex/api/'))
    .map((node) => `${String(node.method || '').toLowerCase()} ${node.url}`)
    .sort();
  assert.deepEqual(routes, EXPECTED_ROUTES, `${label}: HTTP route set differs`);
  assert.equal(new Set(routes).size, routes.length, `${label}: duplicate HTTP method+URL`);
}

function assertSpa(nodes, label) {
  const spa = one(
    nodes,
    (node) => node.type === 'axet-spa-app' && node.appId === 'references-codex',
    `${label}: SPA node`,
  );
  assert.equal(spa.mode, 'http');
  assert.equal(spa.entryFile, 'index.html');
  assert.equal(spa.gitBranch, 'main');
  assert.equal(spa.gitInstallCmd, 'npm ci');
  assert.equal(spa.gitBuildCmd, 'npm run build');
  assert.equal(spa.gitOutputDir, 'dist');
  assert.notEqual(spa.d, true, `${label}: SPA must stay enabled`);

  const config = one(nodes, (node) => node.type === 'global-config', `${label}: global-config`);
  assert.equal(config.modules?.['axet-flows-contrib-nodes-axet-ui-spa'], '1.0.1');
}

function assertNoEmbeddedSecret(nodes, label) {
  const serialized = JSON.stringify(nodes);
  assert.ok(
    !/AXET_CLIENT_SECRET\s*:\s*["'][^"']{8,}["']/.test(serialized),
    `${label}: embedded AXET_CLIENT_SECRET remains`,
  );
  const envNode = nodes.find((node) => node.id === '8344d78c784d16e9');
  assert.ok(envNode?.func?.includes('runtimeSecret("AXET_CLIENT_SECRET")'), `${label}: runtime secret lookup missing`);
}

function assertFunctionSyntax(nodes, originalIds, label) {
  let checked = 0;
  for (const node of nodes) {
    if (node.type !== 'function' || originalIds.has(node.id)) continue;
    new Function('msg', 'node', 'global', 'flow', 'env', 'RED', 'Buffer', 'require', 'process', node.func || '');
    checked += 1;
  }
  assert.ok(checked >= 25, `${label}: too few generated Function nodes parsed (${checked})`);
  return checked;
}

function assertSourceFunctionSyntax() {
  const files = fs.readdirSync(FUNCTIONS_DIR).filter((name) => name.endsWith('.js')).sort();
  for (const name of files) {
    const source = fs.readFileSync(path.join(FUNCTIONS_DIR, name), 'utf8');
    new Function('msg', 'node', 'global', 'flow', 'env', 'RED', 'Buffer', 'require', 'process', source);
  }
  assert.equal(files.length, 12, 'Unexpected generated Function source count');
  return files;
}

function assertIntegration(nodes, label) {
  const byId = indexById(nodes);

  const start = one(nodes, (node) => node.name === '[VUE MIGRATION] Accept execution + adapt msg.submission', `${label}: start adapter`);
  assert.equal(start.outputs, 2);
  assert.deepEqual(start.wires?.[0], [one(nodes, (node) => node.type === 'http response' && node.name === '[VUE MIGRATION] HTTP response', `${label}: response`).id]);
  assert.deepEqual(start.wires?.[1], ['c89f58e0bee76524']);

  const extract = byId.get('18802043bb3d589b');
  const uploadCleanup = one(nodes, (node) => node.name === '[VUE MIGRATION] Cleanup staged uploads after materialization', `${label}: staged cleanup`);
  assert.deepEqual(extract.wires?.[0], [uploadCleanup.id]);
  assert.deepEqual(uploadCleanup.wires?.[0], ['e1c02662b32ac7a5']);
  assert.equal(uploadCleanup.z, extract.z);

  const finalGate = one(nodes, (node) => node.name === '[VUE MIGRATION] Suppress legacy final redirect for Vue', `${label}: final gate`);
  assert.deepEqual(byId.get('a4013f4e7ca38731')?.wires?.[0], [finalGate.id]);
  assert.deepEqual(finalGate.wires?.[0], ['3256255457c58600']);

  const progressGate = one(nodes, (node) => node.name === '[VUE MIGRATION] Suppress legacy progress redirect', `${label}: progress gate`);
  assert.deepEqual(byId.get('733e6e6f17e9e0c4')?.wires?.[0], [progressGate.id]);
  assert.deepEqual(progressGate.wires?.[0], ['c01106f385abba80']);

  const manaCleanup = one(nodes, (node) => node.name === '[VUE MIGRATION] Cleanup MANA staged uploads', `${label}: MANA cleanup`);
  const manaUploadTransport = one(nodes, (node) => node.name === '[VUE MIGRATION] mana-upload: HTTP or Form.io', `${label}: MANA upload transport`);
  assert.deepEqual(byId.get('76451753b678684b')?.wires?.[0], [manaUploadTransport.id]);
  assert.deepEqual(manaUploadTransport.wires?.[0], [manaCleanup.id]);
  assert.deepEqual(manaUploadTransport.wires?.[1], ['86741cc9b41c2658']);

  const readRouter = one(nodes, (node) => node.name === '[VUE MIGRATION] Read API router', `${label}: read router`);
  assert.ok((readRouter.func || '').includes("case 'opportunities'"), `${label}: opportunities action missing`);
  assert.ok((readRouter.func || '').includes("case 'results'"), `${label}: results action missing`);

  const envInject = one(nodes, (node) => node.name === '[VUE MIGRATION] Initialize runtime environment on deploy', `${label}: env inject`);
  assert.equal(envInject.once, true);
  assert.deepEqual(envInject.wires?.[0], ['8344d78c784d16e9']);
}

function assertLegacyMode(nodes, cutover, label) {
  const legacy = nodes.filter((node) => ['axetflows-form', 'axetflows-view-action', 'axetflows-app'].includes(node.type));
  assert.equal(legacy.length, 43, `${label}: unexpected legacy frontend count`);
  const disabled = legacy.filter((node) => node.d === true);
  assert.equal(disabled.length, cutover ? 43 : 0, `${label}: unexpected disabled legacy count`);
}

function validateOne(original, nodes, label, cutover) {
  const ids = assertGraph(nodes, label);
  assertOriginalNodesPreserved(original, nodes, label);
  assertRoutes(nodes, label);
  assertSpa(nodes, label);
  assertNoEmbeddedSecret(nodes, label);
  assertIntegration(nodes, label);
  assertLegacyMode(nodes, cutover, label);
  const parsedGeneratedFunctions = assertFunctionSyntax(nodes, new Set(original.map((node) => node.id)), label);
  return {
    nodes: nodes.length,
    graphIds: ids.size,
    httpRoutes: EXPECTED_ROUTES.length,
    originalNodesPreserved: original.length,
    parsedGeneratedFunctions,
    legacyDisabled: nodes.filter((node) => node.d && ['axetflows-form', 'axetflows-view-action', 'axetflows-app'].includes(node.type)).length,
  };
}

function main() {
  const original = readJson(SOURCE);
  const parallel = readJson(PARALLEL_PATH);
  const cutover = readJson(CUTOVER_PATH);
  const sourceFunctionFiles = assertSourceFunctionSyntax();
  const summary = {
    ok: true,
    source: path.basename(SOURCE),
    sourceNodes: original.length,
    sourceFunctionFiles,
    parallel: validateOne(original, parallel, 'PARALLEL', false),
    cutover: validateOne(original, cutover, 'CUTOVER', true),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
