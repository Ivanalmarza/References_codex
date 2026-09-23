import axios, { type AxiosResponse } from 'axios'
import { getApi, getDeploymentBasePath } from './api'
import type {
  AppUser,
  AxetAuthSession,
  AxetProject,
  BootstrapResponse,
  ExecutionAcceptedResponse,
  ExecutionRequest,
  ExecutionResultsResponse,
  ExecutionStatusResponse,
  LogSessionResponse,
  LogTailResponse,
  ManaActionResponse,
  OpportunitySearchParams,
  OpportunitySearchResponse,
  UploadToken,
} from '../types/api'

const api = getApi()

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim()
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  return text(value)
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function initials(value: string): string {
  const chunks = value.split(/\s+/).filter(Boolean)
  if (!chunks.length) return 'U'
  return chunks.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function toAppUser(rawValue: unknown): AppUser | null {
  const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, unknown> : {}
  const displayName = text(raw.userName || raw.displayName || raw.name || raw.fullName || raw.login || raw.email)
  const email = text(raw.email || raw.login || raw.preferred_username || raw.username)
  const login = text(raw.login || raw.preferred_username || raw.username || email || raw.sub || raw.oktaId || displayName)
  const stableId = text(raw.axetUserId || raw.userId || raw.oktaId || raw.sub || raw.id)

  if (!displayName && !email && !login && !stableId) return null

  const resolvedDisplayName = displayName || email || login || stableId
  const resolvedLogin = login || email || stableId || resolvedDisplayName

  return {
    login: resolvedLogin,
    displayName: resolvedDisplayName,
    email,
    initials: initials(resolvedDisplayName || resolvedLogin),
    axetUserId: stableId || null,
    roles: stringArray(raw.userRoles || raw.roles),
  }
}

/** Initial render source recommended by the aXet SPA App manual. */
export function getInjectedUser(): AppUser | null {
  if (typeof window === 'undefined') return null
  return toAppUser(window.AXET_CONFIG?.user || null)
}

function toAxetProject(value: unknown): AxetProject | null {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const id = text(raw.id || raw.projectId || raw.projectCode)
  const displayName = text(raw.displayName || raw.name || raw.projectName || id)
  if (!id) return null
  return { id, displayName: displayName || id }
}

function authEndpoint(path: 'user' | 'project'): string {
  const deploymentBasePath = getDeploymentBasePath()
  return deploymentBasePath ? `${deploymentBasePath}/_auth/${path}` : `/_auth/${path}`
}

/**
 * Returns the current aXet OIDC session, including the projects assigned to the
 * authenticated user and the project currently selected in the server session.
 */
export async function getAuthSession(timeoutMs = 10_000): Promise<AxetAuthSession> {
  const response = await axios.get(authEndpoint('user'), {
    withCredentials: true,
    timeout: timeoutMs,
    headers: { Accept: 'application/json' },
  })

  const raw = response.data?.data || response.data || {}
  const rawUser = raw.user || raw
  const user = toAppUser(rawUser)
  const axetProjects = Array.isArray(raw.axetProjects)
    ? raw.axetProjects.map(toAxetProject).filter((item): item is AxetProject => Boolean(item))
    : []
  const axetProject = toAxetProject(raw.axetProject)

  return {
    authenticated: raw.authenticated !== false && Boolean(user),
    user,
    axetUserId: text(raw.axetUserId || rawUser.axetUserId) || user?.axetUserId || null,
    axetProjects,
    axetProject,
  }
}

/** Compatibility helper for callers that only need the authenticated identity. */
export async function getCurrentUser(timeoutMs = 10_000): Promise<AppUser> {
  try {
    const session = await getAuthSession(timeoutMs)
    if (session.user) return session.user
  } catch (error) {
    const injected = getInjectedUser()
    if (injected) return injected
    throw error
  }

  const injected = getInjectedUser()
  if (injected) return injected
  throw new Error('AUTH_USER_EMPTY')
}

interface ProjectSelectionForm {
  url: string
  csrf: string
}

async function getProjectSelectionForm(timeoutMs = 10_000): Promise<ProjectSelectionForm> {
  const url = authEndpoint('project')
  const response = await axios.get<string>(url, {
    withCredentials: true,
    timeout: timeoutMs,
    headers: { Accept: 'text/html' },
    responseType: 'text',
  })

  const html = String(response.data || '')
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const form = doc.querySelector('form')
  const csrf = (form?.querySelector('input[name="_csrf"]') as HTMLInputElement | null)?.value?.trim() || ''
  const action = form?.getAttribute('action')?.trim() || url

  if (!csrf) throw new Error('AXET_PROJECT_CSRF_NOT_FOUND')

  return {
    url: new URL(action, window.location.origin).toString(),
    csrf,
  }
}

/**
 * Selects one of the projects returned by /_auth/user using the native
 * axet-spa-app project endpoint. The server session remains the source of truth.
 */
export async function selectAxetProject(projectId: string, timeoutMs = 15_000): Promise<AxetAuthSession> {
  const normalizedProjectId = text(projectId)
  if (!normalizedProjectId) throw new Error('AXET_PROJECT_ID_REQUIRED')

  const form = await getProjectSelectionForm(timeoutMs)
  const body = new URLSearchParams()
  body.set('_csrf', form.csrf)
  body.set('projectId', normalizedProjectId)

  await axios.post(form.url, body.toString(), {
    withCredentials: true,
    timeout: timeoutMs,
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  })

  const session = await getAuthSession(timeoutMs)
  if (session.axetProject?.id !== normalizedProjectId) {
    throw new Error('AXET_PROJECT_SELECTION_NOT_APPLIED')
  }
  return session
}

export async function getBootstrap(): Promise<BootstrapResponse> {
  const { data } = await api.get<BootstrapResponse>('bootstrap')
  return data
}

export async function searchOpportunities(
  params: OpportunitySearchParams,
): Promise<OpportunitySearchResponse> {
  const { data } = await api.get<OpportunitySearchResponse>('opportunities', { params })
  return data
}

export async function createUpload(
  file: { name: string; type: string; size: number; data: string },
  scope: string,
): Promise<UploadToken> {
  const { data } = await api.post<{ ok: boolean; upload: UploadToken }>('uploads', {
    ...file,
    scope,
  }, { timeout: 10 * 60_000 })
  return data.upload
}

export async function removeUpload(uploadId: string): Promise<void> {
  await api.delete(`uploads/${encodeURIComponent(uploadId)}`)
}

export async function startExecution(
  request: ExecutionRequest,
): Promise<ExecutionAcceptedResponse> {
  const { data } = await api.post<ExecutionAcceptedResponse>('executions', request, {
    timeout: 90_000,
  })
  return data
}

export async function getActiveExecution(): Promise<{ ok: boolean; active: ExecutionStatusResponse['session'] | null }> {
  const { data } = await api.get<{ ok: boolean; active: ExecutionStatusResponse['session'] | null }>(
    'executions/active',
  )
  return data
}

export async function getExecutionStatus(sessionId: string): Promise<ExecutionStatusResponse> {
  const { data } = await api.get<ExecutionStatusResponse>(
    `executions/${encodeURIComponent(sessionId)}`,
  )
  return data
}

export async function stopExecution(sessionId: string): Promise<void> {
  await api.post(`executions/${encodeURIComponent(sessionId)}/stop`)
}

export async function releaseExecution(sessionId: string, force = false): Promise<void> {
  await api.post(`executions/${encodeURIComponent(sessionId)}/release`, { force })
}

export async function getExecutionResults(sessionId: string): Promise<ExecutionResultsResponse> {
  const { data } = await api.get<ExecutionResultsResponse>(
    `executions/${encodeURIComponent(sessionId)}/results`,
  )
  return data
}

export async function listLogs(): Promise<LogSessionResponse> {
  const { data } = await api.get<LogSessionResponse>('logs')
  return data
}

export async function getLogTail(sessionId: string, lines = 320): Promise<LogTailResponse> {
  const { data } = await api.get<LogTailResponse>('logs', {
    params: { sessionId, lines },
  })
  return data
}

export async function exportExcel(sessionId: string): Promise<AxiosResponse<Blob>> {
  return api.post(`executions/${encodeURIComponent(sessionId)}/export/excel`, {}, {
    responseType: 'blob',
    timeout: 10 * 60_000,
  })
}

export async function exportTemplate(sessionId: string): Promise<AxiosResponse<Blob>> {
  return api.post(`executions/${encodeURIComponent(sessionId)}/export/template`, {}, {
    responseType: 'blob',
    timeout: 10 * 60_000,
  })
}

export async function publishToSharePoint(sessionId: string): Promise<Record<string, unknown>> {
  const { data } = await api.post<Record<string, unknown>>(
    `executions/${encodeURIComponent(sessionId)}/sharepoint`,
    {},
    { timeout: 10 * 60_000 },
  )
  return data
}

export async function runManaAction(payload: Record<string, unknown>): Promise<ManaActionResponse> {
  const { data } = await api.post<ManaActionResponse>('mana/actions', payload, {
    timeout: 10 * 60_000,
  })
  return data
}

function filenameFromDisposition(disposition: string | undefined, fallback: string): string {
  const value = disposition || ''
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try { return decodeURIComponent(encoded) } catch { /* continue */ }
  }
  const quoted = value.match(/filename="([^"]+)"/i)?.[1]
  return quoted || fallback
}

export function saveBlobResponse(response: AxiosResponse<Blob>, fallbackName: string): void {
  const fileName = filenameFromDisposition(response.headers['content-disposition'], fallbackName)
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
