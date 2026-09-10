import axios, { type AxiosError, type AxiosInstance } from 'axios'
import type { ApiProblem } from '../types/api'

let apiInstance: AxiosInstance | null = null

function normalizeRelativeBaseUrl(value: string | undefined): string {
  const raw = String(value || './api/').trim() || './api/'

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw) || raw.startsWith('//') || raw.startsWith('/')) {
    throw new Error(`VITE_API_BASE_URL debe ser relativa, por ejemplo "./api/". Valor: ${raw}`)
  }

  const relative = raw.startsWith('.') ? raw : `./${raw}`
  return relative.endsWith('/') ? relative : `${relative}/`
}

export function createApi(): AxiosInstance {
  if (apiInstance) return apiInstance

  apiInstance = axios.create({
    baseURL: normalizeRelativeBaseUrl(import.meta.env.VITE_API_BASE_URL),
    withCredentials: true,
    timeout: 45_000,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  return apiInstance
}

export function getApi(): AxiosInstance {
  return apiInstance || createApi()
}

export function getProblemMessage(error: unknown, fallback = 'La operación no se ha podido completar.'): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiProblem>
    return (
      axiosError.response?.data?.message ||
      axiosError.response?.data?.error ||
      axiosError.message ||
      fallback
    )
  }

  return error instanceof Error ? error.message : fallback
}

export default getApi()
