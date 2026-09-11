import axios, { type AxiosError, type AxiosInstance } from 'axios'
import type { ApiProblem } from '../types/api'

let apiInstance: AxiosInstance | null = null

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizeFallbackBaseUrl(value: string | undefined): string {
  const raw = String(value || '/references-api/').trim() || '/references-api/'
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw) || raw.startsWith('//')) return raw.endsWith('/') ? raw : `${raw}/`
  const base = raw.startsWith('/') || raw.startsWith('.') ? raw : `/${raw}`
  return base.endsWith('/') ? base : `${base}/`
}

/**
 * aXet SPA App injects window.AXET_CONFIG into the served HTML.
 * In production, flowsBaseUrl is the authoritative prefix for Node-RED http-in endpoints.
 * This is important in Docker Cloud, where the flow is mounted below a dynamic /flows/cloud/<id> prefix.
 */
export function getApiBaseUrl(): string {
  const runtimeBase = typeof window !== 'undefined'
    ? String(window.AXET_CONFIG?.flowsBaseUrl || '').trim()
    : ''

  if (runtimeBase) return `${trimTrailingSlash(runtimeBase)}/references-api/`
  return normalizeFallbackBaseUrl(import.meta.env.VITE_API_BASE_URL)
}

export function getDeploymentBasePath(): string {
  if (typeof window === 'undefined') return ''
  return String(
    window.AXET_CONFIG?.deploymentBasePath ||
    window.AXET_CONFIG?.basePath ||
    '',
  ).trim().replace(/\/+$/, '')
}

export function createApi(): AxiosInstance {
  if (apiInstance) return apiInstance

  apiInstance = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: true,
    timeout: 45_000,
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  })

  apiInstance.interceptors.response.use((response) => {
    const contentType = String(response.headers?.['content-type'] || '').toLowerCase()
    if (contentType.includes('text/html') && response.config.responseType !== 'blob') {
      return Promise.reject(new Error(`API_ROUTE_RETURNED_HTML: ${response.config.url || ''}`))
    }
    return response
  })

  return apiInstance
}

export function getApi(): AxiosInstance {
  return apiInstance || createApi()
}

export function getProblemMessage(error: unknown, fallback = 'La operación no se ha podido completar.'): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiProblem>
    return axiosError.response?.data?.message || axiosError.response?.data?.error || axiosError.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}

export default getApi()
