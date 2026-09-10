import axios, { type AxiosInstance } from 'axios'

let apiInstance: AxiosInstance | null = null

export function createApi(): AxiosInstance {
  if (apiInstance) {
    return apiInstance
  }

  // Empty baseURL => same-origin relative requests (e.g. "/api/...", "/_auth/...").
  // This lets the SPA talk to the Node-RED endpoints that serve it, both in dev
  // (through the Vite proxy) and in production (through the axet SPA node).
  // No forced Content-Type: axios sets application/json for objects and the
  // correct multipart boundary for FormData automatically.
  apiInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '',
    withCredentials: true,
  })

  // Add request and response interceptors here as the API grows.
  return apiInstance
}

export function getApi(): AxiosInstance {
  return apiInstance || createApi()
}

export default getApi()
