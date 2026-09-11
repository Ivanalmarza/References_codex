import axios, { type AxiosResponse } from 'axios'
import { getApi, getDeploymentBasePath } from './api'
import type {
  AppUser,
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

/**
 * Refresh/verify the OIDC session using the SPA deploymentBasePath.
 * Falls back to the injected user if the refresh endpoint is temporarily unavailable.
 */
export async function getCurrentUser(): Promise<AppUser> {
  const injected = getInjectedUser()
  const deploymentBasePath = getDeploymentBasePath()
  const url = deploymentBasePath ? `${deploymentBasePath}/_auth/user` : '/_auth/user'

  try {
    const response = await axios.get(url, {
      withCredentials: true,
      timeout: 20_000,
      headers: { Accept: 'application/json' },
    })
    const raw = response.data?.user || response.data?.data || response.data || {}
    const resolved = toAppUser(raw)
    if (resolved) return resolved
  } catch (error) {
    if (injected) return injected
    throw error
  }

  if (injected) return injected
  throw new Error('AUTH_USER_EMPTY')
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
  const encoded = value.match(/filename\\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try { return decodeURIComponent(encoded) } catch { /* continue */ }
  }
  const quoted = value.match(/filename=\"([^\"]+)\"/i)?.[1]
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
