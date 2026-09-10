'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function formatDiagnostic(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start == null) return message;
  const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${path.relative(ROOT, diagnostic.file.fileName)}:${pos.line + 1}:${pos.character + 1} ${message}`;
}

function parseTs(fileName, source) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors = sourceFile.parseDiagnostics || [];
  if (errors.length) throw new Error(errors.map(formatDiagnostic).join('\n'));
}

function validateVue(fileName, source) {
  const scriptMatches = [...source.matchAll(/<script(?:\s+setup)?(?:\s+lang=["']ts["'])?[^>]*>([\s\S]*?)<\/script>/gi)];
  if (scriptMatches.length > 1) throw new Error(`${path.relative(ROOT, fileName)} contains multiple script blocks; validator expects one`);
  if (scriptMatches.length === 1) parseTs(`${fileName}.ts`, scriptMatches[0][1]);

  const rootTemplateOpen = (source.match(/<template\s*>/gi) || []).length;
  if (rootTemplateOpen !== 1 || source.lastIndexOf('</template>') < source.indexOf('<template>')) {
    throw new Error(`${path.relative(ROOT, fileName)} must contain one root template block`);
  }
  if (source.includes('<script') && !source.includes('</script>')) throw new Error(`${path.relative(ROOT, fileName)} has an unclosed script block`);
}

const files = walk(SRC).filter((file) => /\.(ts|vue)$/.test(file)).sort();
let tsFiles = 0;
let vueFiles = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.vue')) {
    validateVue(file, source);
    vueFiles += 1;
  } else {
    parseTs(file, source);
    tsFiles += 1;
  }
}

const vite = path.join(ROOT, 'vite.config.ts');
parseTs(vite, fs.readFileSync(vite, 'utf8'));
tsFiles += 1;

console.log(JSON.stringify({ ok: true, tsFiles, vueFiles, total: tsFiles + vueFiles }, null, 2));
