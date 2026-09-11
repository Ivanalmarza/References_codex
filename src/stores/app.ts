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

    // aXet SPA App injects AXET_CONFIG before Vue starts.
    // Use that identity immediately; do not block first render on /_auth/user.
    const injected = getInjectedUser()
    if (injected) user.value = injected

    try {
      // Bootstrap is the only request that blocks application initialization.
      // It provides selectors, active session and the backend-resolved identity.
      const data = await getBootstrap()

      if (!data || data.ok !== true || !data.options) {
        error.value = 'BOOTSTRAP_INVALID_RESPONSE'
      } else {
        bootstrap.value = data
        user.value = bootstrapUser(data) || injected || user.value
      }
    } catch (reason) {
      const runtimeAuthEnabled = window.AXET_CONFIG?.authEnabled
      error.value = runtimeAuthEnabled === false
        ? 'El nodo SPA está sirviendo la aplicación sin OIDC/Okta habilitado.'
        : getProblemMessage(reason, 'No se ha podido cargar la aplicación.')
    } finally {
      initialized.value = true
      loading.value = false
    }

    // Verify/refresh the OIDC identity in background. This request must never
    // keep the loading screen visible after bootstrap has completed.
    void getCurrentUser()
      .then((resolvedUser) => {
        user.value = resolvedUser
      })
      .catch(() => {
        // AXET_CONFIG/bootstrap already provide the identity. A transient
        // /_auth/user failure is not an application initialization failure.
      })

    if (!user.value && !error.value) {
      error.value = window.AXET_CONFIG?.authEnabled === false
        ? 'El nodo SPA está sirviendo la aplicación sin OIDC/Okta habilitado.'
        : 'No se ha podido resolver el usuario autenticado.'
    }
  }

  async function refreshBootstrap(): Promise<void> {
    const data = await getBootstrap()
    bootstrap.value = data

    const resolvedUser = bootstrapUser(data)
    if (resolvedUser) user.value = resolvedUser
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
