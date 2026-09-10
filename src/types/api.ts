export interface Choice {
  value: string
  label: string
}

export interface AppUser {
  login: string
  displayName: string
  email: string
  initials: string
  axetUserId?: string | null
  roles: string[]
}

export interface SessionTasks {
  completed: number
  total: number
  remaining: number
  batch: number
  live: boolean
}

export interface SessionSummary {
  sessionId: string
  status: string
  progress: number
  ready: boolean
  failed: boolean
  stopped: boolean
  terminal: boolean
  canStop: boolean
  tasks: SessionTasks
  updatedAt: string | null
  createdAt: string | null
  selectedSources: string[]
  sourceType: string
  unit: string
  project: string
  opportunityId: string
  opportunityTitle: string
  template: string
  outputLanguage: string
  model: string
  reasoning: string
  error: string | null
  hasLog?: boolean
  logSize?: number
}

export interface BootstrapOptions {
  languages: Choice[]
  sectorOutputFormats: Choice[]
  templates: Choice[]
  processedUnits: Choice[]
  processedProjectsByUnit: Record<string, Choice[]>
  opportunitySectors: Choice[]
  sourcePriority: string[]
}

export interface BootstrapResponse {
  ok: boolean
  app: {
    id: string
    name: string
    apiVersion: string
    frontend: string
    routes?: Record<string, string>
    legacy?: {
      adminFilesAvailable: boolean
      oktaUserSearchAvailable: boolean
    }
  }
  cache: {
    ready: boolean
    builtAt: string | null
    buildReason: string | null
    buildMs: number
    stats: Record<string, unknown> | null
  }
  options: BootstrapOptions
  active: SessionSummary | null
  user: {
    login: string
    axetUserId: string | null
    roles: string[]
  }
}

export interface OpportunityItem {
  value: string
  label: string
  opportunityId: string
  businessOpportunityId: string
  title: string
  sector: string
  unit: string
  customer: string
  country?: string
  folderName?: string
  documentCount?: number
  hasPdf?: boolean
  hasCsv?: boolean
  indexStatus?: string
}

export interface OpportunitySearchParams {
  sector?: string
  unit?: string
  customer?: string
  businessId?: string
  q?: string
  page?: number
  size?: number
}

export interface OpportunitySearchResponse {
  ok: boolean
  requiresFilter?: boolean
  message?: string
  filters: Record<string, string>
  facets: {
    sectors: Choice[]
    units: Choice[]
    customers: Choice[]
  }
  items: OpportunityItem[]
  pagination: {
    page: number
    size: number
    total: number
    pages: number
  }
  index?: {
    generatedAt: string | null
    total: number
  }
}

export interface UploadToken {
  uploadId: string
  name: string
  type: string
  size: number
  scope: string
  createdAt: string
}

export interface ExecutionRequest {
  includeProcessed: boolean
  includeOpportunity: boolean
  includeUploads: boolean
  unidadProcesado: string
  proyectoProcesado: string
  opportunitySelectionMode: 'filters' | 'businessId'
  businessOpportunityIdSearch: string
  sector: string
  unidadOportunidad: string
  cliente: string
  opportunityId: string
  uploadIds: string[]
  idioma: string
  plantilla: string
  sector_outputformat: 'general' | 'sector_publico' | 'sector_privado'
  instruccionEspecifica: string
}

export interface ExecutionAcceptedResponse {
  ok: boolean
  accepted: boolean
  sessionId: string
  status: string
  selectedSources: string[]
  sourceType: string
  createdAt: string
  links: {
    status: string
    results: string
    stop: string
  }
}

export interface PhaseDefinition {
  id: string
  label: string
  icon?: string
}

export type PhaseState = 'pending' | 'current' | 'done' | 'error' | string

export interface SourceSummaryEntry {
  active: boolean
  fileCount: number
  files: Array<{ name: string; size: number }>
  errors: unknown[]
  missing: unknown[]
}

export interface ExecutionStatusResponse {
  ok: boolean
  session: SessionSummary
  phases: PhaseDefinition[]
  phaseStatus: Record<string, PhaseState>
  sourceSummary: Record<string, SourceSummaryEntry>
  runtime: {
    status: string
    progress: number
    completed: boolean
    success?: boolean
    processingStarted: boolean
    stale: boolean
    staleMinutes: number
    error: string | null
  }
  logs: {
    events: Array<Record<string, unknown>>
    tail: string
  }
  resultReady: boolean
  updatedAt: string | null
}

export interface ResultFile {
  name: string
  size: number | null
  modifiedAt: string | null
  kind: string
}

export interface ExecutionResultsResponse {
  ok: boolean
  session: SessionSummary
  ready: boolean
  terminal: boolean
  failed: boolean
  stopped: boolean
  success: boolean
  result: Record<string, unknown> | null
  monitoring: Record<string, unknown> | null
  selection: {
    template: string
    outputType: string
    sectorOutputFormat: string
    model: string
    reasoning: string
  }
  context: {
    selectedSources: string[]
    unit: string
    project: string
    opportunityId: string
    opportunityTitle: string
    customer: string
    outputLanguage: string
    instruction: string
  }
  answers: Record<string, unknown> | null
  files: ResultFile[]
  report: string | null
}

export interface LogSessionResponse {
  ok: boolean
  sessions: SessionSummary[]
  adminScope: boolean
}

export interface LogTailResponse {
  ok: boolean
  session: SessionSummary
  tail: string
}

export interface ManaActionResponse {
  ok: boolean
  action: string | null
  status: string
  opportunityId: string | null
  opportunity: {
    title: string | null
    sector: string | null
    unit: string | null
    customer: string | null
    information: string | null
  }
  sharePoint: {
    folderName: string | null
    folderPath: string | null
    checkedAt: string | null
    text: string | null
    hasPdf?: boolean
    hasCsv?: boolean
    hasOpportunityInfo?: boolean
    pdfFiles: string[]
    csvFiles: string[]
    files: string[]
    fileCount: number | null
  }
  delete: {
    prepared: boolean
    choices: Choice[]
    deletedFilename: string | null
  }
  index: {
    summary: string | null
  }
  details?: Record<string, unknown>
}

export interface ApiProblem {
  ok?: false
  error?: string
  message?: string
  details?: unknown
}
