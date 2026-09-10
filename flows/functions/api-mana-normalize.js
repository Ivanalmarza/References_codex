function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

const data = msg.payload?.data && typeof msg.payload.data === 'object'
  ? msg.payload.data
  : (msg.payload && typeof msg.payload === 'object' && !Buffer.isBuffer(msg.payload) ? msg.payload : {});
const result = msg.result || msg.deleteSelection || null;

const statusText = text(
  result?.statusText ||
  data.crudStatus ||
  data.deleteStatus ||
  data.resultadoOperacion ||
  data.message
);
const failure = Boolean(msg.error) || result?.ok === false || /^\s*[❌]/.test(statusText) || /^\s*error\b/i.test(statusText);

const response = {
  ok: !failure,
  action: result?.action || msg.crud?.action || data.crudAction || null,
  status: statusText || (failure ? 'Error' : 'Operación completada'),
  opportunityId: result?.opportunityId || msg.crud?.opportunityId || data.opportunityId || data.deleteOpportunityId || null,
  opportunity: {
    title: result?.title || msg.crud?.selectedOpportunity?.title || null,
    sector: result?.sector || msg.crud?.selectedOpportunity?.sector || data.sector || null,
    unit: result?.unit || msg.crud?.selectedOpportunity?.unit || data.unidadOportunidad || null,
    customer: result?.customer || msg.crud?.selectedOpportunity?.customerName || data.cliente || null,
    information: result?.opportunityInfoTexto || data.opportunityInfoTexto || data.deleteOpportunityInfo || data.resultadoOportunidad || null
  },
  sharePoint: {
    folderName: result?.folderName || msg.crud?.folderName || data.deleteFolderName || null,
    folderPath: result?.folderPath || msg.crud?.folderPath || data.deleteFolderPath || null,
    checkedAt: result?.checkedAt || result?.preparedAt || null,
    text: result?.sharePointText || data.sharePointCheckTexto || data.deleteFilesText || data.resultadoSharePoint || null,
    hasPdf: result?.hasPdf,
    hasCsv: result?.hasCsv,
    hasOpportunityInfo: result?.hasOpportunityInfo,
    pdfFiles: result?.pdfFiles || [],
    csvFiles: result?.csvFiles || [],
    files: result?.fileNames || [],
    fileCount: result?.fileCount ?? (Array.isArray(result?.fileNames) ? result.fileNames.length : null)
  },
  delete: {
    prepared: Boolean(msg.deleteSelection || data.deleteFileChoices),
    choices: result?.deleteFileChoices || data.deleteFileChoices || [],
    deletedFilename: result?.deletedFilename || msg.crud?.deletedFilename || null
  },
  index: {
    summary: result?.indexStatusResumen || data.indexStatusResumen || data.resultadoIndice || null
  }
};

// Upload-success functions put the uploaded filenames only in the status text; preserve a compact
// raw block for any additional action-specific values, while deliberately excluding selector maps.
const permitted = [
  'crudStatus', 'sharePointCheckTexto', 'indexStatusResumen',
  'deleteStatus', 'deleteFilesText', 'deleteFileCountLabel',
  'resultadoOperacion', 'resultadoSharePoint', 'resultadoIndice'
];
response.details = {};
for (const key of permitted) {
  if (data[key] !== undefined && data[key] !== '') response.details[key] = data[key];
}
if (!Object.keys(response.details).length) delete response.details;

msg.statusCode = Number(msg.statusCode || (failure ? 400 : 200));
msg.headers = {
  ...(msg.headers || {}),
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};
msg.payload = response;
return msg;
