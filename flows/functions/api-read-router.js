const fs = require('fs');
const path = require('path');

const FILES_ROOT = '/internal-storage-files/files';
const ACTIVE_DIR = path.join(FILES_ROOT, '_active-sessions');
const OWNER_DIR = path.join(FILES_ROOT, '_vue-session-owners');
const WORKSPACE_DIR = path.join(FILES_ROOT, 'codex-workspace');
const PROCESSED_DIR = path.join(FILES_ROOT, 'procesado');
const TEMPLATES_DIR = path.join(FILES_ROOT, 'plantillas');
const OPPORTUNITIES_INDEX = path.join(FILES_ROOT, 'opportunities_index.json');
const OPPORTUNITIES_FILTERS = path.join(FILES_ROOT, 'opportunities_filters.json');

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function safeName(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_.@-]+/g, '_').slice(0, 180);
}

function readJson(filePath, fallback = null) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    node.warn(`Vue API read JSON failed ${filePath}: ${err.message}`);
    return fallback;
  }
}

function asRoles(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || '')
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function identity(currentMsg) {
  const security = currentMsg.__axetFlowsSecurityContext || {};
  const idp = security.externalIdpUserInfo || {};
  const userKey = normalizeText(
    idp.preferred_username ||
    idp.email ||
    idp.sub ||
    security.login ||
    currentMsg.req?.user?.email ||
    currentMsg.req?.user?.id ||
    currentMsg.userId ||
    ''
  );
  const axetUserId = normalizeText(security.axetUserId || currentMsg.axet_user_id || '');
  const roles = asRoles(security.userRoles || security.roles || currentMsg.req?.user?.roles || []);
  const isAdmin = roles.some((role) => /(^|_)SUPER_ADMIN$|(^|_)ADMIN$/i.test(role));
  return { userKey, axetUserId, roles, isAdmin };
}

function respond(statusCode, payload) {
  msg.statusCode = statusCode;
  msg.headers = {
    ...(msg.headers || {}),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  msg.payload = payload;
  return msg;
}

function requireIdentity() {
  const who = identity(msg);
  if (!who.userKey || who.userKey === 'anonymous') {
    respond(401, { ok: false, error: 'AUTH_REQUIRED', message: 'No se ha podido resolver el usuario autenticado.' });
    return null;
  }
  return who;
}

function canonicalSessionId(value) {
  const sessionId = normalizeText(value);
  return /^[a-zA-Z0-9_-]{8,128}$/.test(sessionId) ? sessionId : '';
}

function sessionPaths(sessionId) {
  const projectPath = path.join(WORKSPACE_DIR, sessionId);
  const docsPath = path.join(projectPath, 'codex-docs');
  return {
    projectPath,
    docsPath,
    statePath: path.join(docsPath, 'SESSION_STATE.json'),
    answersPath: path.join(docsPath, 'output', 'respuestas.json'),
    reportPath: path.join(docsPath, 'EXECUTION_REPORT.md'),
    planPath: path.join(docsPath, 'PLAN.md'),
    logPath: path.join(projectPath, `codex-unified-${sessionId}.log`)
  };
}

function getActive(who) {
  return readJson(path.join(ACTIVE_DIR, `${who.userKey}.json`), null);
}

function ownsSession(sessionId, who, state) {
  if (who.isAdmin) return true;

  const owner = readJson(path.join(OWNER_DIR, `${safeName(sessionId)}.json`), null);
  if (owner) {
    if (normalizeText(owner.userKey).toLowerCase() === who.userKey.toLowerCase()) return true;
    if (who.axetUserId && normalizeText(owner.axetUserId) === who.axetUserId) return true;
  }

  const active = getActive(who);
  if (normalizeText(active?.sessionId) === sessionId) return true;

  const stateUserKey = normalizeText(
    state?.context?.userKey ||
    state?.context?.user ||
    state?.monitoring?.user ||
    ''
  );
  const stateUserId = normalizeText(
    state?.context?.axet_user_id ||
    state?.context?.axetUserId ||
    state?.monitoring?.axetUserId ||
    ''
  );

  return (
    (!!stateUserKey && stateUserKey.toLowerCase() === who.userKey.toLowerCase()) ||
    (!!who.axetUserId && !!stateUserId && stateUserId === who.axetUserId)
  );
}

function readAuthorizedSession(rawSessionId, who) {
  const sessionId = canonicalSessionId(rawSessionId);
  if (!sessionId) return { error: respond(400, { ok: false, error: 'INVALID_SESSION_ID' }) };

  const paths = sessionPaths(sessionId);
  const state = readJson(paths.statePath, null);
  if (!state) return { error: respond(404, { ok: false, error: 'SESSION_NOT_FOUND', sessionId }) };
  if (!ownsSession(sessionId, who, state)) {
    return { error: respond(403, { ok: false, error: 'SESSION_FORBIDDEN', sessionId }) };
  }

  return { sessionId, paths, state };
}

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function isStopped(state) {
  return Boolean(
    state?.execution?.stopped === true ||
    state?.execution?.stopRequested === true ||
    state?.execution?.reason === 'manual-stop' ||
    state?.runtime?.manualStop === true
  );
}

function hasExplicitFailure(state) {
  const phaseStatus = state?.progressView?.phaseStatus || {};
  return Boolean(
    state?.runtime?.error ||
    state?.execution?.error ||
    phaseStatus.execute === 'error' ||
    phaseStatus.report === 'error' ||
    state?.execution?.reason === 'worker-error' ||
    state?.execution?.reason === 'spawn-error' ||
    state?.execution?.reason === 'implementation-error'
  );
}

function isReady(state, answersExist = false) {
  const explicitSuccess = Boolean(
    state?.resultReady === true ||
    state?.readyToRedirect === true ||
    state?.result?.success === true ||
    (state?.runtime?.completed === true && state?.runtime?.success === true)
  );
  const legacyCompletedAnswers = Boolean(
    answersExist &&
    (state?.execution?.finished === true || state?.runtime?.completed === true) &&
    state?.runtime?.success !== false &&
    !hasExplicitFailure(state)
  );
  return explicitSuccess || legacyCompletedAnswers;
}

function isTerminal(state, ready, stopped) {
  return Boolean(
    ready ||
    stopped ||
    hasExplicitFailure(state) ||
    state?.runtime?.completed === true ||
    state?.execution?.finished === true
  );
}

function isFailed(state, ready, stopped, terminal) {
  if (stopped) return false;
  if (hasExplicitFailure(state)) return true;
  if (!terminal) return false;
  if (state?.runtime?.success === false) return true;
  return !ready;
}

function taskData(state) {
  const candidates = [state?.tasksLive, state?.tasks].filter(Boolean);
  candidates.sort((a, b) => number(b?.completed) - number(a?.completed));
  const tasks = candidates[0] || {};
  const completed = number(tasks.completed);
  const total = number(tasks.total);
  return { completed, total, remaining: Math.max(0, number(tasks.remaining, total - completed)), batch: number(tasks.batch), live: tasks.live === true };
}

function sourceSummary(state) {
  const summary = state?.context?.sourceSummary || state?.input?.sourceSummary || state?.sourceSummary || {};
  const result = {};
  for (const source of ['processed', 'opportunity', 'uploads']) {
    const entry = summary?.[source] || {};
    result[source] = {
      active: entry.active === true,
      fileCount: number(entry.fileCount, Array.isArray(entry.files) ? entry.files.length : 0),
      files: Array.isArray(entry.files)
        ? entry.files.slice(0, 100).map((file) => ({
            name: normalizeText(file?.logicalName || file?.name || file?.originalName || path.basename(file?.localPath || '')),
            size: number(file?.size)
          }))
        : [],
      errors: Array.isArray(entry.errors) ? entry.errors.slice(0, 20) : [],
      missing: Array.isArray(entry.missing) ? entry.missing.slice(0, 20) : []
    };
  }
  return result;
}

function readTail(filePath, maxLines = 160, maxBytes = 180000) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return '';
    const stat = fs.statSync(filePath);
    const size = Math.min(stat.size, maxBytes);
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(size);
    fs.readSync(fd, buffer, 0, size, Math.max(0, stat.size - size));
    fs.closeSync(fd);
    return buffer.toString('utf8').split(/\r?\n/).slice(-maxLines).join('\n');
  } catch (err) {
    node.warn(`Vue API log tail failed: ${err.message}`);
    return '';
  }
}

function summarizeSession(sessionId, state, active) {
  const tasks = taskData(state || {});
  const paths = sessionPaths(sessionId);
  const answersExist = fs.existsSync(paths.answersPath);
  const stopped = isStopped(state || {});
  const readyCandidate = isReady(state || {}, answersExist);
  const terminal = isTerminal(state || {}, readyCandidate, stopped);
  const failed = isFailed(state || {}, readyCandidate, stopped, terminal);
  const ready = readyCandidate && !failed && !stopped;
  const runtimeProgress = number(state?.runtime?.progress, number(state?.progress));
  const taskProgress = tasks.total > 0 ? Math.round((tasks.completed / tasks.total) * 100) : 0;
  const progress = Math.max(0, Math.min(100, ready && !failed ? 100 : Math.max(runtimeProgress, taskProgress)));

  return {
    sessionId,
    status: normalizeText(
      state?.runtime?.status ||
      active?.status ||
      (stopped ? 'Detenida por el usuario' : failed ? 'Error' : ready ? 'Completado' : 'En ejecución')
    ),
    progress,
    ready,
    failed,
    stopped,
    terminal,
    canStop: !terminal,
    tasks,
    updatedAt: state?.updatedAt || active?.updatedAt || null,
    createdAt: state?.createdAt || active?.createdAt || null,
    selectedSources: Array.isArray(state?.context?.selectedSources)
      ? state.context.selectedSources
      : (Array.isArray(active?.selectedSources) ? active.selectedSources : []),
    sourceType: normalizeText(state?.context?.sourceType || active?.sourceType || ''),
    unit: normalizeText(state?.context?.unidad || state?.context?.unit || active?.unit || ''),
    project: normalizeText(state?.context?.proyecto || state?.context?.project || active?.project || ''),
    opportunityId: normalizeText(state?.context?.opportunityId || active?.opportunityId || ''),
    opportunityTitle: normalizeText(state?.context?.opportunityTitle || active?.opportunityTitle || ''),
    template: normalizeText(state?.selection?.plantilla || state?.selection?.template || state?.context?.plantilla || ''),
    outputLanguage: normalizeText(state?.context?.outputLanguage || ''),
    model: normalizeText(state?.selection?.modelSelect || state?.selection?.model || state?.selection?.requestedModel || ''),
    reasoning: normalizeText(state?.selection?.reasoningLevel || state?.selection?.reasoning || state?.selection?.requestedReasoning || ''),
    error: normalizeText(state?.runtime?.error || state?.execution?.error || (failed || stopped ? state?.execution?.reason : '') || '') || null
  };
}

function choice(value, label) {
  const cleanValue = normalizeText(value);
  if (!cleanValue) return null;
  return { value: cleanValue, label: normalizeText(label || value) || cleanValue };
}

function uniqueChoices(values) {
  const seen = new Set();
  const result = [];
  for (const item of values || []) {
    const normalized = typeof item === 'object'
      ? choice(item.value ?? item.id ?? item.name, item.label ?? item.name ?? item.value)
      : choice(item, item);
    if (!normalized || seen.has(normalized.value)) continue;
    seen.add(normalized.value);
    result.push(normalized);
  }
  return result.sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

function scanProcessed() {
  const units = [];
  const projectsByUnit = {};
  try {
    if (!fs.existsSync(PROCESSED_DIR)) return { units, projectsByUnit };
    for (const unitDir of fs.readdirSync(PROCESSED_DIR, { withFileTypes: true })) {
      if (!unitDir.isDirectory()) continue;
      const unit = unitDir.name;
      const projects = [];
      const unitPath = path.join(PROCESSED_DIR, unit);
      for (const projectDir of fs.readdirSync(unitPath, { withFileTypes: true })) {
        if (!projectDir.isDirectory()) continue;
        const markdownPath = path.join(unitPath, projectDir.name, 'markdown');
        if (fs.existsSync(markdownPath) && fs.statSync(markdownPath).isDirectory()) projects.push(choice(projectDir.name));
      }
      if (projects.length) {
        units.push(choice(unit));
        projectsByUnit[unit] = uniqueChoices(projects);
      }
    }
  } catch (err) {
    node.warn(`Vue API processed scan failed: ${err.message}`);
  }
  return { units: uniqueChoices(units), projectsByUnit };
}

function scanTemplates() {
  try {
    return uniqueChoices(
      fs.readdirSync(TEMPLATES_DIR)
        .filter((name) => ['.pptx', '.docx'].includes(path.extname(name).toLowerCase()))
        .map((name) => choice(name))
    );
  } catch (_) {
    return [];
  }
}

function getSectorChoices(cacheData, filtersData) {
  const cached = uniqueChoices(cacheData?.sectores || []);
  if (cached.length) return cached;
  return uniqueChoices((filtersData?.sectors || []).map((entry) => choice(entry?.name)));
}

function bootstrap(who) {
  const cache = global.get('referenceGenerator_selectors_v1') || null;
  const data = cache?.selectorData || {};
  const filters = readJson(OPPORTUNITIES_FILTERS, { sectors: [] });
  const hasProcessedCache = Array.isArray(data.unidadesProcesado) && data.unidadesProcesado.length > 0 &&
    data.proyectosProcesadoPorUnidad && typeof data.proyectosProcesadoPorUnidad === 'object';
  const scannedProcessed = hasProcessedCache ? { units: [], projectsByUnit: {} } : scanProcessed();

  const processedUnits = uniqueChoices(hasProcessedCache ? data.unidadesProcesado : scannedProcessed.units);
  const processedProjectsByUnit = {};
  const sourceProjects = hasProcessedCache ? data.proyectosProcesadoPorUnidad : scannedProcessed.projectsByUnit;
  for (const [unit, projects] of Object.entries(sourceProjects)) {
    processedProjectsByUnit[unit] = uniqueChoices(projects);
  }

  const templates = uniqueChoices(Array.isArray(data.plantillas) && data.plantillas.length ? data.plantillas : scanTemplates());
  const active = getActive(who);
  let activeSummary = null;
  if (active?.sessionId) {
    const sessionId = canonicalSessionId(active.sessionId);
    if (sessionId) activeSummary = summarizeSession(sessionId, readJson(sessionPaths(sessionId).statePath, {}), active);
  }

  return respond(200, {
    ok: true,
    app: {
      id: 'references-codex',
      name: 'Codex References Generator',
      apiVersion: '2.1.0',
      frontend: 'vue',
      routes: { newExecution: '#/new', logs: '#/logs', mana: '#/mana', admin: '#/admin' },
      legacy: { adminFilesAvailable: false, oktaUserSearchAvailable: false }
    },
    cache: {
      ready: Boolean(cache?.selectorData),
      builtAt: cache?.builtAt || null,
      buildReason: cache?.buildReason || null,
      buildMs: number(cache?.buildMs),
      stats: cache?.stats || null
    },
    options: {
      languages: [choice('Español (ES)'), choice('English (EN)')],
      sectorOutputFormats: [
        choice('general', 'General'),
        choice('sector_publico', 'Sector Público'),
        choice('sector_privado', 'Sector Privado')
      ],
      templates,
      processedUnits,
      processedProjectsByUnit,
      opportunitySectors: getSectorChoices(data, filters),
      sourcePriority: ['uploads', 'opportunity', 'processed']
    },
    active: activeSummary,
    user: {
      login: who.userKey,
      axetUserId: who.axetUserId || null,
      roles: who.roles
    }
  });
}

function normalizeBusinessId(value) {
  let raw = normalizeText(value).toUpperCase().replace(/\s+/g, '');
  if (/^\d+$/.test(raw)) raw = `OPP-${raw}`;
  if (/^OPP\d+$/.test(raw)) raw = `OPP-${raw.slice(3)}`;
  return raw;
}

function itemView(item) {
  const opportunityId = normalizeText(item?.opportunityId || item?.id || item?.salesforceOpportunityId || item?.businessOpportunityId);
  const title = normalizeText(item?.title || item?.name || item?.opportunityName || item?.folderName || opportunityId);
  const businessOpportunityId = normalizeBusinessId(item?.businessOpportunityId || item?.opportunityBusinessId || item?.OpportunityId__c || '');
  return {
    value: opportunityId,
    label: `${title} (${opportunityId})`,
    opportunityId,
    businessOpportunityId,
    title,
    sector: normalizeText(item?.sector),
    unit: normalizeText(item?.unit),
    customer: normalizeText(item?.customerName || item?.customer),
    country: normalizeText(item?.country),
    folderName: normalizeText(item?.sharePointFolder || item?.folderName || item?.folder),
    documentCount: number(item?.documentCount, Array.isArray(item?.files) ? item.files.length : 0),
    hasPdf: Boolean(item?.hasPdf || item?.hasProposal),
    hasCsv: Boolean(item?.hasCsv || item?.hasOpportunityInfo),
    indexStatus: normalizeText(item?.indexStatus)
  };
}

function getOpportunityCatalog() {
  let stat = null;
  try { stat = fs.statSync(OPPORTUNITIES_INDEX); } catch (_) {}
  const signature = stat ? `${stat.size}:${stat.mtimeMs}` : 'missing';
  const key = 'referencesVue_opportunityCatalog_v3';
  const cached = global.get(key);
  if (cached?.signature === signature && Array.isArray(cached.items)) return cached;

  const index = readJson(OPPORTUNITIES_INDEX, { items: [] });
  const items = Array.isArray(index?.items)
    ? index.items.map(itemView).filter((item) => item.opportunityId)
    : [];

  const sectors = [];
  const unitsBySector = {};
  const customersBySectorUnit = {};
  const itemsByFilter = {};
  const itemsByBusinessId = {};
  const itemsByOpportunityId = {};

  for (const item of items) {
    if (item.sector) sectors.push(choice(item.sector));
    if (item.sector && item.unit) {
      unitsBySector[item.sector] = unitsBySector[item.sector] || [];
      unitsBySector[item.sector].push(choice(item.unit));
    }
    if (item.sector && item.unit && item.customer) {
      const unitKey = `${item.sector}||${item.unit}`;
      const filterKey = `${unitKey}||${item.customer}`;
      customersBySectorUnit[unitKey] = customersBySectorUnit[unitKey] || [];
      customersBySectorUnit[unitKey].push(choice(item.customer));
      itemsByFilter[filterKey] = itemsByFilter[filterKey] || [];
      itemsByFilter[filterKey].push(item);
    }
    if (item.businessOpportunityId) {
      itemsByBusinessId[item.businessOpportunityId] = itemsByBusinessId[item.businessOpportunityId] || [];
      itemsByBusinessId[item.businessOpportunityId].push(item);
    }
    itemsByOpportunityId[item.opportunityId] = item;
  }

  const catalog = {
    signature,
    generatedAt: index?.generatedAt || index?.updatedAt || null,
    items,
    sectors: uniqueChoices(sectors),
    unitsBySector: Object.fromEntries(Object.entries(unitsBySector).map(([key, values]) => [key, uniqueChoices(values)])),
    customersBySectorUnit: Object.fromEntries(Object.entries(customersBySectorUnit).map(([key, values]) => [key, uniqueChoices(values)])),
    itemsByFilter,
    itemsByBusinessId,
    itemsByOpportunityId
  };
  global.set(key, catalog);
  return catalog;
}

function opportunities() {
  const query = msg.req?.query || {};
  const sector = normalizeText(query.sector);
  const unit = normalizeText(query.unit);
  const customer = normalizeText(query.customer);
  const businessId = normalizeBusinessId(query.businessId);
  const opportunityId = normalizeText(query.opportunityId);
  const searchText = normalizeText(query.q);
  const search = searchText.toLowerCase();
  const page = Math.max(1, Math.floor(number(query.page, 1)));
  const size = Math.max(1, Math.min(200, Math.floor(number(query.size, 50))));
  const catalog = getOpportunityCatalog();

  let candidates = [];
  let requiresFilter = false;
  let message = '';

  if (opportunityId) {
    const exact = catalog.itemsByOpportunityId[opportunityId];
    candidates = exact ? [exact] : [];
  } else if (businessId) {
    candidates = catalog.itemsByBusinessId[businessId] || [];
  } else if (search) {
    if (search.length < 3) {
      return respond(400, {
        ok: false,
        error: 'SEARCH_TOO_SHORT',
        message: 'Introduce al menos 3 caracteres para buscar por texto.'
      });
    }
    candidates = catalog.items.filter((item) => [
      item.title,
      item.opportunityId,
      item.businessOpportunityId,
      item.customer,
      item.unit,
      item.sector
    ].join(' ').toLowerCase().includes(search));
  } else if (sector && unit && customer) {
    candidates = catalog.itemsByFilter[`${sector}||${unit}||${customer}`] || [];
  } else {
    requiresFilter = true;
    message = sector && unit
      ? 'Selecciona un cliente para cargar sus oportunidades.'
      : sector
        ? 'Selecciona una unidad para continuar.'
        : 'Selecciona sector, unidad y cliente, o busca por identificador o texto.';
  }

  candidates = candidates.slice().sort((a, b) => a.label.localeCompare(b.label, 'es'));
  const total = candidates.length;
  const start = (page - 1) * size;
  const items = candidates.slice(start, start + size);

  return respond(200, {
    ok: true,
    requiresFilter,
    message: message || `${total} oportunidad(es) encontrada(s).`,
    filters: { sector, unit, customer, businessId, opportunityId, q: searchText },
    facets: {
      sectors: catalog.sectors,
      units: sector ? (catalog.unitsBySector[sector] || []) : [],
      customers: sector && unit ? (catalog.customersBySectorUnit[`${sector}||${unit}`] || []) : []
    },
    items,
    pagination: { page, size, total, pages: Math.max(1, Math.ceil(total / size)) },
    index: { generatedAt: catalog.generatedAt, total: catalog.items.length }
  });
}

function activeSession(who) {
  const active = getActive(who);
  if (!active?.sessionId) return respond(200, { ok: true, active: null });
  const sessionId = canonicalSessionId(active.sessionId);
  if (!sessionId) return respond(200, { ok: true, active: null });
  const state = readJson(sessionPaths(sessionId).statePath, {});
  return respond(200, { ok: true, active: summarizeSession(sessionId, state, active) });
}

function sessionStatus(who) {
  const resolved = readAuthorizedSession(msg.req?.params?.sessionId, who);
  if (resolved.error) return resolved.error;
  const { sessionId, paths, state } = resolved;
  const active = getActive(who);
  const summary = summarizeSession(sessionId, state, active?.sessionId === sessionId ? active : null);
  const globalProgress = global.get(`codexproject${sessionId}`) || null;
  const globalLogs = Array.isArray(globalProgress?.logs) ? globalProgress.logs.slice(-80) : [];

  return respond(200, {
    ok: true,
    session: summary,
    phases: state?.progressView?.phases || globalProgress?.phases || [],
    phaseStatus: state?.progressView?.phaseStatus || globalProgress?.phaseStatus || {},
    sourceSummary: sourceSummary(state),
    runtime: {
      status: summary.status,
      progress: summary.progress,
      completed: state?.runtime?.completed === true,
      success: state?.runtime?.success,
      processingStarted: state?.runtime?.processing_started === true,
      stale: state?.runtime?.stale === true,
      staleMinutes: number(state?.runtime?.staleMinutes),
      error: summary.error
    },
    logs: {
      events: globalLogs,
      tail: readTail(paths.logPath, 120, 160000)
    },
    resultReady: summary.ready,
    updatedAt: state?.updatedAt || null
  });
}

function sessionResults(who) {
  const resolved = readAuthorizedSession(msg.req?.params?.sessionId, who);
  if (resolved.error) return resolved.error;
  const { sessionId, paths, state } = resolved;
  const answers = readJson(paths.answersPath, null);
  const summary = summarizeSession(sessionId, state, getActive(who));
  const ready = summary.ready;
  const outputDir = path.dirname(paths.answersPath);
  const files = [];

  try {
    if (fs.existsSync(outputDir)) {
      for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(outputDir, entry.name);
        const stat = fs.statSync(fullPath);
        files.push({ name: entry.name, size: stat.size, modifiedAt: stat.mtime.toISOString(), kind: path.extname(entry.name).slice(1).toLowerCase() || 'file' });
      }
    }
  } catch (err) {
    node.warn(`Vue API result file scan failed: ${err.message}`);
  }

  const output = state?.output || {};
  for (const candidate of [output.generatedExcelFilename, output.generatedFilename, state?.monitoring?.generatedFilename]) {
    const name = normalizeText(candidate);
    if (name && !files.some((file) => file.name === name)) files.push({ name, size: null, modifiedAt: null, kind: path.extname(name).slice(1).toLowerCase() || 'file' });
  }

  const responseAvailable = Boolean(summary.ready || answers || summary.terminal);

  return respond(responseAvailable ? 200 : 409, {
    ok: responseAvailable,
    session: summary,
    ready: summary.ready,
    terminal: summary.terminal,
    failed: summary.failed,
    stopped: summary.stopped,
    success: summary.ready && !summary.failed && !summary.stopped,
    result: state?.result || null,
    monitoring: state?.monitoring || null,
    selection: {
      template: normalizeText(state?.selection?.plantilla || state?.selection?.template || state?.context?.plantilla),
      outputType: normalizeText(state?.selection?.outputType || state?.context?.outputType),
      sectorOutputFormat: normalizeText(state?.selection?.sector_outputformat || state?.context?.sector_outputformat || 'general'),
      model: normalizeText(state?.selection?.modelSelect || state?.selection?.model || state?.selection?.requestedModel),
      reasoning: normalizeText(state?.selection?.reasoningLevel || state?.selection?.reasoning || state?.selection?.requestedReasoning)
    },
    context: {
      selectedSources: state?.context?.selectedSources || [],
      unit: normalizeText(state?.context?.unidad || state?.context?.unit),
      project: normalizeText(state?.context?.proyecto || state?.context?.project),
      opportunityId: normalizeText(state?.context?.opportunityId),
      opportunityTitle: normalizeText(state?.context?.opportunityTitle),
      customer: normalizeText(state?.context?.opportunityCustomer),
      outputLanguage: normalizeText(state?.context?.outputLanguage),
      instruction: normalizeText(state?.context?.instruccionEspecifica)
    },
    answers,
    files,
    report: fs.existsSync(paths.reportPath) ? fs.readFileSync(paths.reportPath, 'utf8').slice(0, 200000) : null
  });
}

function logs(who) {
  const query = msg.req?.query || {};
  const requestedSessionId = canonicalSessionId(query.sessionId);
  const maxLines = Math.max(20, Math.min(1000, Math.floor(number(query.lines, 240))));

  if (requestedSessionId) {
    const resolved = readAuthorizedSession(requestedSessionId, who);
    if (resolved.error) return resolved.error;
    return respond(200, {
      ok: true,
      session: summarizeSession(requestedSessionId, resolved.state, getActive(who)),
      tail: readTail(resolved.paths.logPath, maxLines, 800000)
    });
  }

  const sessions = [];
  try {
    if (fs.existsSync(WORKSPACE_DIR)) {
      const entries = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory());
      for (const entry of entries) {
        const sessionId = canonicalSessionId(entry.name);
        if (!sessionId) continue;
        const paths = sessionPaths(sessionId);
        const state = readJson(paths.statePath, null);
        if (!state || !ownsSession(sessionId, who, state)) continue;
        const summary = summarizeSession(sessionId, state, null);
        let logSize = 0;
        try { if (fs.existsSync(paths.logPath)) logSize = fs.statSync(paths.logPath).size; } catch (_) {}
        sessions.push({ ...summary, hasLog: logSize > 0, logSize });
      }
    }
  } catch (err) {
    node.warn(`Vue API logs scan failed: ${err.message}`);
  }

  sessions.sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));
  return respond(200, { ok: true, sessions: sessions.slice(0, 250), adminScope: who.isAdmin });
}

function health(who) {
  const selectorCache = global.get('referenceGenerator_selectors_v1') || null;
  return respond(200, {
    ok: true,
    service: 'references-codex-vue-api',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    user: who.userKey,
    selectorsReady: Boolean(selectorCache?.selectorData),
    selectorsBuiltAt: selectorCache?.builtAt || null
  });
}

const who = requireIdentity();
if (!who) return msg;

switch (msg._apiAction) {
  case 'health': return health(who);
  case 'bootstrap': return bootstrap(who);
  case 'opportunities': return opportunities();
  case 'active': return activeSession(who);
  case 'status': return sessionStatus(who);
  case 'results': return sessionResults(who);
  case 'logs': return logs(who);
  case 'mana-bootstrap': return bootstrap(who);
  default: return respond(404, { ok: false, error: 'API_ACTION_NOT_FOUND', action: msg._apiAction || null });
}
