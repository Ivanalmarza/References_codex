import { getApi } from './api'

export interface StartExecutionPayload {
  unidad: string
  proyecto: string
  model: string
  reasoning: string
  selectedSources: string[]
  outputLanguage: string
  instruccionEspecifica?: string
  [key: string]: unknown
}

export interface StartExecutionResult {
  sessionId: string
  projectPath?: string
  [key: string]: unknown
}

/** Loose mirror of SESSION_STATE.json (progressView, execution, tasks, runtime...). */
export interface SessionState {
  sessionId?: string
  runtime?: {
    status?: string
    progress?: number
    completed?: boolean
    success?: boolean
    error?: string | null
  }
  progressView?: {
    phaseStatus?: Record<string, string>
    [key: string]: unknown
  }
  execution?: { phase?: string; [key: string]: unknown }
  tasks?: { completed?: number; total?: number; remaining?: number; live?: boolean }
  resultReady?: boolean
  readyToRedirect?: boolean
  result?: Record<string, unknown> | null
  output?: Record<string, unknown>
  monitoring?: Record<string, unknown>
  [key: string]: unknown
}

export async function startExecution(
  payload: StartExecutionPayload,
  files?: File[],
): Promise<StartExecutionResult> {
  if (files && files.length) {
    const form = new FormData()
    form.append('submission', JSON.stringify(payload))
    for (const file of files) form.append('files', file)
    const { data } = await getApi().post<StartExecutionResult>('/api/executions', form)
    return data
  }
  const { data } = await getApi().post<StartExecutionResult>('/api/executions', payload)
  return data
}

export async function getSessionState(sessionId: string): Promise<SessionState> {
  const { data } = await getApi().get<SessionState>(
    `/api/executions/${encodeURIComponent(sessionId)}/state`,
  )
  return data ?? {}
}

export async function stopExecution(sessionId: string): Promise<{ ok: boolean; [k: string]: unknown }> {
  const { data } = await getApi().post(`/api/executions/${encodeURIComponent(sessionId)}/stop`)
  return data
}

export async function getResult(sessionId: string): Promise<SessionState> {
  const { data } = await getApi().get<SessionState>(
    `/api/executions/${encodeURIComponent(sessionId)}/result`,
  )
  return data ?? {}
}

export async function requestExport(
  sessionId: string,
  outputType: 'excel' | 'pptx',
): Promise<{ ok: boolean; filename?: string; [k: string]: unknown }> {
  const { data } = await getApi().post('/api/exports', { sessionId, outputType })
  return data
}

export async function uploadResultToSharePoint(
  sessionId: string,
): Promise<{ ok: boolean; [k: string]: unknown }> {
  const { data } = await getApi().post(
    `/api/executions/${encodeURIComponent(sessionId)}/sharepoint`,
  )
  return data
}

/** Same-origin download URL for a generated Excel/PPTX file. */
export function fileDownloadUrl(filename: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  return `${base}/api/files/excel/${encodeURIComponent(filename)}`
}

/** SSE endpoint for live progress (falls back to polling getSessionState). */
export function progressEventsUrl(sessionId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  return `${base}/api/executions/${encodeURIComponent(sessionId)}/events`
}
