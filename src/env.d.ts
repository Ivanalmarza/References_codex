/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local/dev fallback only. Production uses window.AXET_CONFIG.flowsBaseUrl. */
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEV_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface AxetRuntimeUser {
  sub?: string
  email?: string
  name?: string
  oktaId?: string
  roles?: string[]
  [key: string]: unknown
}

interface AxetRuntimeConfig {
  appId?: string
  basePath?: string
  deploymentBasePath?: string
  flowsBaseUrl?: string
  sseUrl?: string
  postUrl?: string
  mode?: 'http' | 'sdk' | string
  authEnabled?: boolean
  user?: AxetRuntimeUser | null
}

interface Window {
  AXET_CONFIG?: AxetRuntimeConfig
}
