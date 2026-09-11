import axios, { type AxiosError, type AxiosInstance } from 'axios'
import type { ApiProblem } from '../types/api'

let apiInstance: AxiosInstance | null = null

function normalizeApiBaseUrl(value: string | undefined): string {
  const raw = String(value || '/references-api/').trim() || '/references-api/'
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw) || raw.startsWith('//')) {
    throw new Error(`VITE_API_BASE_URL debe ser same-origin. Valor no permitido: ${raw}`)
  }
  const base = raw.startsWith('/') || raw.startsWith('.') ? raw : `/${raw}`
  return base.endsWith('/') ? base : `${base}/`
}

export function createApi(): AxiosInstance {
  if (apiInstance) return apiInstance

  apiInstance = axios.create({
    baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
    withCredentials: true,
    timeout: 45_000,
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  })

  // If axet-spa-app serves index.html for an API URL by mistake, fail loudly
  // instead of letting Vue access fields such as data.settings on HTML text.
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
