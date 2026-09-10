'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const FUNCTIONS = path.join(ROOT, 'flows', 'functions');
const PARALLEL = path.join(ROOT, 'flows', 'flows-references-codex-vue-PARALLEL.json');
const CUTOVER = path.join(ROOT, 'flows', 'flows-references-codex-vue-CUTOVER.json');

function walk(dir, predicate = () => true) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath, predicate));
    else if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function parseTypescript(label, source) {
  const sourceFile = ts.createSourceFile(
    label,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const errors = (sourceFile.parseDiagnostics || []).filter(
    (item) => item.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length) {
    const host = {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => ROOT,
      getNewLine: () => '\n',
    };
    throw new Error(`${label}:\n${ts.formatDiagnostics(errors, host)}`);
  }
}

function validateSource() {
  const tsFiles = walk(SRC, (file) => file.endsWith('.ts'));
  const vueFiles = walk(SRC, (file) => file.endsWith('.vue'));

  for (const file of tsFiles) parseTypescript(path.relative(ROOT, file), fs.readFileSync(file, 'utf8'));
  for (const file of vueFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const scripts = [...source.matchAll(/<script(?:\s+setup)?(?:\s+lang=["']ts["'])?[^>]*>([\s\S]*?)<\/script>/gi)];
    scripts.forEach((match, index) => parseTypescript(`${path.relative(ROOT, file)}#script-${index + 1}`, match[1]));
    assert.ok(/<template(?:\s[^>]*)?>/i.test(source), `${path.relative(ROOT, file)} must have a template`);
    assert.ok(/<\/template>/i.test(source), `${path.relative(ROOT, file)} must close its template`);
  }

  const functionFiles = walk(FUNCTIONS, (file) => file.endsWith('.js'));
  for (const file of functionFiles) {
    const source = fs.readFileSync(file, 'utf8');
    new Function('msg', 'node', 'global', 'flow', 'env', 'RED', 'Buffer', 'require', 'process', source);
  }

  const vite = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  const api = fs.readFileSync(path.join(SRC, 'services', 'api.ts'), 'utf8');
  const referenceApi = fs.readFileSync(path.join(SRC, 'services', 'referenceApi.ts'), 'utf8');
  assert.match(vite, /base:\s*['"]\.\/['"]/);
  assert.match(api, /\.\/api\//);
  assert.match(referenceApi, /axios\.get\(['"]\/_auth\/user['"]/);

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(packageJson.name, 'references-codex-vue');
  assert.equal(lock.name, packageJson.name);
  assert.equal(lock.version, packageJson.version);
  assert.equal(lock.packages[''].name, packageJson.name);
  assert.equal(lock.packages[''].version, packageJson.version);

  return { tsFiles: tsFiles.length, vueFiles: vueFiles.length, functionFiles: functionFiles.length };
}

function validateFlow(filePath, mode) {
  const nodes = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const byId = new Map();
  for (const node of nodes) {
    assert.ok(node.id, `${mode}: node without id`);
    assert.ok(!byId.has(node.id), `${mode}: duplicate node id ${node.id}`);
    byId.set(node.id, node);
  }

  for (const node of nodes) {
    for (const output of node.wires || []) {
      for (const target of output || []) assert.ok(byId.has(target), `${mode}: missing wire ${node.id} -> ${target}`);
    }
    for (const target of node.links || []) assert.ok(byId.has(target), `${mode}: missing link ${node.id} => ${target}`);
  }

  const httpNodes = nodes.filter((node) => node.type === 'http in');
  const routes = httpNodes.map((node) => `${String(node.method || 'get').toUpperCase()} ${node.url}`);
  assert.equal(routes.length, 17, `${mode}: expected 17 HTTP routes`);
  assert.equal(new Set(routes).size, routes.length, `${mode}: duplicate HTTP route`);

  const requiredRoutes = [
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
    'POST /references-codex/api/mana/actions',
  ];
  assert.deepEqual([...routes].sort(), [...requiredRoutes].sort(), `${mode}: route contract mismatch`);

  const spa = nodes.find((node) => node.type === 'axet-spa-app' && node.appId === 'references-codex');
  assert.ok(spa, `${mode}: SPA node missing`);
  assert.equal(spa.mode, 'http');
  assert.equal(spa.entryFile, 'index.html');
  assert.equal(spa.gitInstallCmd, 'npm ci');
  assert.equal(spa.gitBuildCmd, 'npm run build');
  assert.equal(spa.gitOutputDir, 'dist');

  const start = nodes.find((node) => node.name === '[VUE MIGRATION] Accept execution + adapt msg.submission');
  assert.ok(start, `${mode}: start adapter missing`);
  assert.equal(start.outputs, 2);
  assert.ok(start.wires[1].includes('c89f58e0bee76524'), `${mode}: background start must enter previous-session finalizer`);
  assert.ok(byId.get('c89f58e0bee76524').wires[0].includes('dcb3673520f594ca'), `${mode}: existing execution subflow disconnected`);

  const extract = byId.get('18802043bb3d589b');
  const cleanup = nodes.find((node) => node.name === '[VUE MIGRATION] Cleanup staged uploads after materialization');
  assert.ok(cleanup && extract.wires[0].includes(cleanup.id), `${mode}: staged uploads are not cleaned after materialization`);

  const finalizer = byId.get('a4013f4e7ca38731');
  const finalGate = nodes.find((node) => node.name === '[VUE MIGRATION] Suppress legacy final redirect for Vue');
  assert.ok(finalGate && finalizer.wires[0].includes(finalGate.id), `${mode}: final legacy redirect gate missing`);

  const catchExport = nodes.find((node) => node.name === '[VUE MIGRATION] Catch export errors');
  assert.ok(catchExport && catchExport.scope.length >= 15, `${mode}: result branch catch is incomplete`);
  assert.match(byId.get('ae810650ebcbaa12').func, /\{ \.\.\.msg, payload: \{ message: 'Error generando PPTX local'/);
  assert.match(byId.get('392510151ef3dc48').func, /SharePoint', msg\);/);

  const forms = nodes.filter((node) => node.type === 'axetflows-form');
  const viewActions = nodes.filter((node) => node.type === 'axetflows-view-action');
  const legacyApps = nodes.filter((node) => node.type === 'axetflows-app');
  assert.equal(forms.length, 13, `${mode}: source forms were not preserved`);
  if (mode === 'parallel') {
    assert.equal(forms.filter((node) => node.d).length, 0, 'parallel: Form.io must remain enabled');
  } else {
    assert.equal(forms.filter((node) => node.d).length, forms.length, 'cutover: all forms must be disabled');
    assert.equal(viewActions.filter((node) => node.d).length, viewActions.length, 'cutover: all view actions must be disabled');
    assert.equal(legacyApps.filter((node) => node.d).length, legacyApps.length, 'cutover: legacy app must be disabled');
    assert.equal(spa.d, undefined, 'cutover: SPA must remain enabled');
  }

  const globalConfig = nodes.find((node) => node.type === 'global-config');
  assert.equal(globalConfig.modules['axet-flows-contrib-nodes-axet-ui-spa'], '1.0.1');
  const serialized = JSON.stringify(nodes);
  assert.ok(!/AXET_CLIENT_SECRET\s*:\s*["'][^"']{8,}/.test(serialized), `${mode}: embedded AXET secret remains`);

  return {
    nodes: nodes.length,
    routes: routes.length,
    forms: forms.length,
    disabledLegacy: nodes.filter((node) => node.d && ['axetflows-form', 'axetflows-view-action', 'axetflows-app'].includes(node.type)).length,
  };
}

const source = validateSource();
const parallel = validateFlow(PARALLEL, 'parallel');
const cutover = validateFlow(CUTOVER, 'cutover');
console.log(JSON.stringify({ ok: true, source, parallel, cutover }, null, 2));
