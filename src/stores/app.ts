import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getAuthSession, getBootstrap, getInjectedUser, selectAxetProject } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import type { AppUser, AxetAuthSession, AxetProject, BootstrapResponse, SessionSummary } from '../types/api'

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
  const sessionReady = ref(false)
  const initialized = ref(false)
  const loading = ref(false)
  const selectingProject = ref(false)
  const error = ref<string | null>(null)
  const projectError = ref<string | null>(null)
  const bootstrap = ref<BootstrapResponse | null>(null)
  const user = ref<AppUser | null>(null)
  const axetProjects = ref<AxetProject[]>([])
  const axetProject = ref<AxetProject | null>(null)

  const activeSession = computed<SessionSummary | null>(() => bootstrap.value?.active || null)
  const options = computed(() => bootstrap.value?.options || null)
  const needsProjectSelection = computed(() =>
    sessionReady.value && !axetProject.value && axetProjects.value.length > 0 && !error.value,
  )

  function applyAuthSession(session: AxetAuthSession): void {
    const applicationRoles = user.value?.roles || []
    if (session.user) {
      user.value = {
        ...session.user,
        roles: applicationRoles.length ? applicationRoles : (session.user.roles || []),
      }
    }
    axetProjects.value = session.axetProjects
    axetProject.value = session.axetProject
  }

  async function loadBootstrap(): Promise<void> {
    const data = await getBootstrap()
    if (!data || data.ok !== true || !data.options) throw new Error('BOOTSTRAP_INVALID_RESPONSE')

    bootstrap.value = data
    const resolvedUser = bootstrapUser(data)
    if (resolvedUser) {
      user.value = {
        ...resolvedUser,
        roles: resolvedUser.roles?.length ? resolvedUser.roles : (user.value?.roles || []),
      }
    }
    initialized.value = true
  }

  async function initialize(force = false): Promise<void> {
    if (initialized.value && !force) return
    if (sessionReady.value && needsProjectSelection.value && !force) return

    loading.value = true
    error.value = null
    projectError.value = null
    if (force) initialized.value = false

    const injected = getInjectedUser()
    if (injected) user.value = injected

    try {
      const session = await getAuthSession()
      sessionReady.value = true
      applyAuthSession(session)

      if (!session.authenticated || !session.user) {
        throw new Error('No se ha podido resolver el usuario autenticado.')
      }

      if (!session.axetProject) {
        if (session.axetProjects.length > 0) return
        throw new Error('No tienes proyectos aXet disponibles para esta aplicación.')
      }

      await loadBootstrap()
    } catch (reason) {
      sessionReady.value = true
      const runtimeAuthEnabled = window.AXET_CONFIG?.authEnabled
      error.value = runtimeAuthEnabled === false
        ? 'El nodo SPA está sirviendo la aplicación sin OIDC/Okta habilitado.'
        : getProblemMessage(reason, 'No se ha podido cargar la aplicación.')
    } finally {
      loading.value = false
    }
  }

  async function selectProject(projectId: string): Promise<void> {
    if (selectingProject.value) return

    const allowed = axetProjects.value.some((project) => project.id === projectId)
    if (!allowed) {
      projectError.value = 'El proyecto seleccionado no está disponible para tu usuario.'
      return
    }

    selectingProject.value = true
    projectError.value = null
    error.value = null

    try {
      const session = await selectAxetProject(projectId)
      applyAuthSession(session)

      loading.value = true
      await loadBootstrap()
    } catch (reason) {
      projectError.value = getProblemMessage(reason, 'No se ha podido seleccionar el proyecto.')
    } finally {
      loading.value = false
      selectingProject.value = false
    }
  }

  async function refreshBootstrap(): Promise<void> {
    if (!axetProject.value) return
    await loadBootstrap()
  }

  function setActiveSession(session: SessionSummary | null): void {
    if (bootstrap.value) bootstrap.value.active = session
  }

  return {
    sessionReady,
    initialized,
    loading,
    selectingProject,
    error,
    projectError,
    bootstrap,
    user,
    axetProjects,
    axetProject,
    activeSession,
    options,
    needsProjectSelection,
    initialize,
    selectProject,
    refreshBootstrap,
    setActiveSession,
  }
})
