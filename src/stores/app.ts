import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getBootstrap, getCurrentUser, getInjectedUser } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import type { AppUser, BootstrapResponse, SessionSummary } from '../types/api'

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

function bootstrapUser(data: BootstrapResponse): AppUser | null {
  if (!data.user?.login && !data.user?.displayName && !data.user?.email) return null
  const login = data.user.login || data.user.email || data.user.displayName || ''
  const displayName = data.user.displayName || data.user.email || login
  const email = data.user.email || (login.includes('@') ? login : '')
  return {
    login,
    displayName,
    email,
    initials: initials(displayName || login),
    axetUserId: data.user.axetUserId,
    roles: data.user.roles || [],
  }
}

export const useAppStore = defineStore('app', () => {
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const bootstrap = ref<BootstrapResponse | null>(null)
  const user = ref<AppUser | null>(null)

  const activeSession = computed<SessionSummary | null>(() => bootstrap.value?.active || null)
  const options = computed(() => bootstrap.value?.options || null)

  async function initialize(force = false): Promise<void> {
    if (initialized.value && !force) return
    loading.value = true
    error.value = null

    // The SPA node injects AXET_CONFIG before the Vue bundle loads.
    // Use it immediately for the header while the backend bootstrap is resolving.
    const injected = getInjectedUser()
    if (injected) user.value = injected

    const [bootstrapResult, currentUserResult] = await Promise.allSettled([
      getBootstrap(),
      getCurrentUser(),
    ])

    if (bootstrapResult.status === 'fulfilled') {
      const data = bootstrapResult.value
      if (!data || data.ok !== true || !data.options) {
        error.value = 'BOOTSTRAP_INVALID_RESPONSE'
      } else {
        bootstrap.value = data
        if (currentUserResult.status === 'fulfilled') {
          user.value = currentUserResult.value
        } else {
          user.value = bootstrapUser(data) || injected
        }
      }
    } else {
      const runtimeAuthEnabled = window.AXET_CONFIG?.authEnabled
      error.value = runtimeAuthEnabled === false
        ? 'El nodo SPA está sirviendo la aplicación sin OIDC/Okta habilitado.'
        : getProblemMessage(bootstrapResult.reason, 'No se ha podido cargar la aplicación.')
      if (currentUserResult.status === 'fulfilled') user.value = currentUserResult.value
    }

    if (!user.value && !error.value) {
      error.value = window.AXET_CONFIG?.authEnabled === false
        ? 'El nodo SPA está sirviendo la aplicación sin OIDC/Okta habilitado.'
        : 'No se ha podido resolver el usuario autenticado.'
    }

    initialized.value = true
    loading.value = false
  }

  async function refreshBootstrap(): Promise<void> {
    bootstrap.value = await getBootstrap()
  }

  function setActiveSession(session: SessionSummary | null): void {
    if (bootstrap.value) bootstrap.value.active = session
  }

  return {
    initialized,
    loading,
    error,
    bootstrap,
    user,
    activeSession,
    options,
    initialize,
    refreshBootstrap,
    setActiveSession,
  }
})
