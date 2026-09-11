<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { getApi, getProblemMessage } from '../services/api'
import { createUpload, saveBlobResponse } from '../services/referenceApi'
import { notify } from '../services/notyf'

const api = getApi()

type Choice = { label: string; value: string }
type ResourceItem = { label: string; value: string; type?: string }
type AdminBootstrap = {
  ok: boolean
  settings: { model: string; reasoning: string; modelOptions: string[]; reasoningOptions: string[] }
  files: ResourceItem[]
  logs: ResourceItem[]
  prettyLog: string
  cache?: { builtAt?: string | null; buildReason?: string | null; stats?: Record<string, unknown> | null }
}
type AdminUser = { recordId: string; userId: string; userName: string; userMail: string; roles: string[] }
type UsersResponse = { ok: boolean; items: AdminUser[]; pagination: { page: number; size: number; total: number } }

type UserEditor = AdminUser & { isNew: boolean }

const activeTab = ref<'files' | 'users'>('files')
const loadingAdmin = ref(true)
const admin = ref<AdminBootstrap | null>(null)
const adminError = ref<string | null>(null)
const model = ref('')
const reasoning = ref('')
const selectedFile = ref('')
const selectedLog = ref('')
const uploadDestination = ref('')
const uploading = ref(false)
const actionBusy = ref('')
const actionMessage = ref('')

const users = ref<AdminUser[]>([])
const roles = ref<Choice[]>([])
const usersLoading = ref(false)
const userEditor = ref<UserEditor | null>(null)
const filters = reactive({ userId: '', userName: '', userMail: '', roles: [] as string[], page: 1, size: 20, total: 0 })

const totalPages = computed(() => Math.max(1, Math.ceil(filters.total / filters.size)))

function asMessage(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const obj = value as Record<string, unknown>
  return String(obj.message || obj.status || '')
}

async function loadAdmin(): Promise<void> {
  loadingAdmin.value = true
  adminError.value = null
  try {
    const { data } = await api.get<AdminBootstrap>('admin/bootstrap')
    if (!data || data.ok !== true || !data.settings || !Array.isArray(data.files) || !Array.isArray(data.logs)) {
      throw new Error('ADMIN_BOOTSTRAP_INVALID_RESPONSE')
    }
    admin.value = data
    model.value = data.settings.model
    reasoning.value = data.settings.reasoning
    if (!selectedFile.value && data.files.length) selectedFile.value = data.files[0]?.value || ''
    if (!selectedLog.value && data.logs.length) selectedLog.value = data.logs[0]?.value || ''
  } catch (error) {
    admin.value = null
    adminError.value = getProblemMessage(error, 'No se ha podido cargar la administración.')
    notify.error(adminError.value)
  } finally {
    loadingAdmin.value = false
  }
}

async function runAction(action: string, payload: Record<string, unknown> = {}, confirmation = ''): Promise<void> {
  if (confirmation && !window.confirm(confirmation)) return
  actionBusy.value = action
  actionMessage.value = ''
  try {
    const { data } = await api.post<Record<string, unknown>>('admin/actions', { action, ...payload }, { timeout: 10 * 60_000 })
    actionMessage.value = asMessage(data) || 'Operación enviada correctamente.'
    notify.success(actionMessage.value)
    if (['set-model', 'set-reasoning', 'delete-data', 'delete-processed', 'delete-workspace'].includes(action)) {
      await loadAdmin()
    }
  } catch (error) {
    const message = getProblemMessage(error, 'No se ha podido ejecutar la acción.')
    actionMessage.value = message
    notify.error(message)
  } finally {
    actionBusy.value = ''
  }
}

async function download(kind: 'file' | 'log', resourcePath: string): Promise<void> {
  if (!resourcePath) return
  try {
    const response = await api.get<Blob>('admin/download', {
      params: { kind, path: resourcePath },
      responseType: 'blob',
      timeout: 10 * 60_000,
    })
    saveBlobResponse(response, resourcePath.split(/[\\/]/).pop() || 'download.bin')
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se ha podido descargar el recurso.'))
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('No se ha podido leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

async function uploadAdminFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const data = await readAsDataUrl(file)
    const token = await createUpload({ name: file.name, type: file.type, size: file.size, data }, 'admin')
    await runAction('upload-file', { uploadId: token.uploadId, destination: uploadDestination.value })
    await loadAdmin()
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se ha podido cargar el archivo.'))
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function loadUsers(resetPage = false): Promise<void> {
  if (resetPage) filters.page = 1
  usersLoading.value = true
  try {
    const [{ data }, meta] = await Promise.all([
      api.get<UsersResponse>('admin/users', {
        params: {
          userId: filters.userId,
          userName: filters.userName,
          userMail: filters.userMail,
          roles: filters.roles.join(','),
          page: filters.page,
          size: filters.size,
        },
      }),
      roles.value.length ? Promise.resolve(null) : api.get<{ ok: boolean; roles: Choice[] }>('admin/users/meta'),
    ])
    users.value = data.items || []
    filters.total = Number(data.pagination?.total || users.value.length)
    if (meta) roles.value = meta.data.roles || []
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se han podido cargar los usuarios.'))
  } finally {
    usersLoading.value = false
  }
}

async function openUser(user?: AdminUser): Promise<void> {
  if (!user) {
    userEditor.value = { recordId: '', userId: '', userName: '', userMail: '', roles: ['ROLE_USER'], isNew: true }
    return
  }
  try {
    const { data } = await api.get<{ ok: boolean; user: AdminUser }>(`admin/users/${encodeURIComponent(user.recordId)}`)
    userEditor.value = { ...data.user, roles: [...(data.user.roles || [])], isNew: false }
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se ha podido abrir el usuario.'))
  }
}

async function saveUser(): Promise<void> {
  const editor = userEditor.value
  if (!editor) return
  if (!editor.userId.trim()) {
    notify.warning('User Id es obligatorio.')
    return
  }
  try {
    const body = { userId: editor.userId.trim(), userName: editor.userName.trim(), userMail: editor.userMail.trim(), roles: editor.roles }
    if (editor.isNew) await api.post('admin/users', body)
    else await api.put(`admin/users/${encodeURIComponent(editor.recordId)}`, body)
    notify.success(editor.isNew ? 'Usuario creado.' : 'Usuario actualizado.')
    userEditor.value = null
    await loadUsers()
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se ha podido guardar el usuario.'))
  }
}

async function deleteUser(user: AdminUser): Promise<void> {
  if (!window.confirm(`¿Eliminar el usuario ${user.userId}?`)) return
  try {
    await api.delete(`admin/users/${encodeURIComponent(user.recordId)}`)
    notify.success('Usuario eliminado.')
    await loadUsers()
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se ha podido eliminar el usuario.'))
  }
}

async function selectTab(tab: 'files' | 'users'): Promise<void> {
  activeTab.value = tab
  if (tab === 'users' && !users.value.length) await loadUsers(true)
}

onMounted(() => void loadAdmin())
</script>

<template>
  <div class="page-shell space-y-6">
    <header class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p class="eyebrow">Administración</p>
        <h1 class="page-title mt-2">Herramientas operativas</h1>
        <p class="page-description">Gestiona la configuraciÃ³n, los archivos, los procesos de mantenimiento y los usuarios de la aplicaciÃ³n.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink to="/logs" class="btn-secondary no-underline">Ejecuciones y logs</RouterLink>
        <RouterLink to="/mana" class="btn-secondary no-underline">Oportunidades MANA</RouterLink>
      </div>
    </header>

    <div class="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
      <button class="btn flex-1" :class="activeTab === 'files' ? 'btn-primary' : 'btn-ghost'" @click="selectTab('files')">Admin files</button>
      <button class="btn flex-1" :class="activeTab === 'users' ? 'btn-primary' : 'btn-ghost'" @click="selectTab('users')">Usuarios Okta</button>
    </div>

    <template v-if="activeTab === 'files'">
      <div v-if="adminError" class="error-banner">{{ adminError }}</div>
      <div v-if="loadingAdmin" class="surface-card text-sm text-slate-500">Cargando configuración administrativa...</div>
      <template v-else-if="admin">
        <div v-if="actionMessage" class="success-banner">{{ actionMessage }}</div>

        <section class="grid gap-5 lg:grid-cols-2">
          <article class="surface-card">
            <p class="eyebrow">Modelo Codex</p>
            <h2 class="section-title mt-1">Modelo y reasoning global</h2>
            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label class="field-label">Modelo GPT</label>
                <select v-model="model" class="form-control">
                  <option v-for="item in admin.settings.modelOptions" :key="item" :value="item">{{ item }}</option>
                </select>
                <button class="btn-primary mt-3" :disabled="!!actionBusy" @click="runAction('set-model', { value: model })">Guardar modelo</button>
              </div>
              <div>
                <label class="field-label">Reasoning</label>
                <select v-model="reasoning" class="form-control">
                  <option v-for="item in admin.settings.reasoningOptions" :key="item" :value="item">{{ item }}</option>
                </select>
                <button class="btn-primary mt-3" :disabled="!!actionBusy" @click="runAction('set-reasoning', { value: reasoning })">Guardar reasoning</button>
              </div>
            </div>
          </article>

          <article class="surface-card">
            <p class="eyebrow">Internal storage</p>
            <h2 class="section-title mt-1">Descargar archivos y logs</h2>
            <div class="mt-5 space-y-4">
              <div>
                <label class="field-label">Internal Files</label>
                <div class="flex gap-2"><select v-model="selectedFile" class="form-control min-w-0 flex-1"><option v-for="item in admin.files" :key="item.value" :value="item.value">{{ item.label }}</option></select><button class="btn-secondary" @click="download('file', selectedFile)">Download</button></div>
              </div>
              <div>
                <label class="field-label">Logs</label>
                <div class="flex gap-2"><select v-model="selectedLog" class="form-control min-w-0 flex-1"><option v-for="item in admin.logs" :key="item.value" :value="item.value">{{ item.label }}</option></select><button class="btn-secondary" @click="download('log', selectedLog)">Download</button></div>
              </div>
            </div>
          </article>
        </section>

        <section class="surface-card">
          <p class="eyebrow">Carga administrativa</p>
          <h2 class="section-title mt-1">Upload a internal storage</h2>
          <div class="mt-5 grid gap-4 md:grid-cols-[1fr_1.2fr] md:items-end">
            <div><label class="field-label">Destination</label><input v-model="uploadDestination" class="form-control" placeholder="plantillas, mana_scripts, ..." /></div>
            <label class="btn-secondary w-fit cursor-pointer"><input type="file" class="sr-only" :disabled="uploading" @change="uploadAdminFile" />{{ uploading ? 'Subiendo...' : 'Seleccionar y subir archivo' }}</label>
          </div>
        </section>

        <section class="surface-card">
          <p class="eyebrow">Procesos</p>
          <h2 class="section-title mt-1">Sincronización y mantenimiento</h2>
          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button class="btn-secondary justify-start !bg-slate-50 hover:!bg-slate-100 dark:!bg-slate-900 dark:hover:!bg-slate-800" :disabled="!!actionBusy" @click="runAction('download-sharepoint')">Download from SP</button>
            <button class="btn-secondary justify-start !bg-slate-50 hover:!bg-slate-100 dark:!bg-slate-900 dark:hover:!bg-slate-800" :disabled="!!actionBusy" @click="runAction('download-new-project')">Download new project</button>
            <button class="btn-secondary justify-start !bg-slate-50 hover:!bg-slate-100 dark:!bg-slate-900 dark:hover:!bg-slate-800" :disabled="!!actionBusy" @click="runAction('refresh-mana')">Descarga New MANA</button>
            <button class="btn-secondary justify-start !bg-slate-50 hover:!bg-slate-100 dark:!bg-slate-900 dark:hover:!bg-slate-800" :disabled="!!actionBusy" @click="runAction('refresh-opportunities')">Cargar Oportunidades</button>
            <button class="btn-secondary justify-start !bg-slate-50 hover:!bg-slate-100 dark:!bg-slate-900 dark:hover:!bg-slate-800" :disabled="!!actionBusy" @click="runAction('refresh-units-projects')">Cargar Units/Projects</button>
            <button class="btn-secondary justify-start !bg-slate-50 hover:!bg-slate-100 dark:!bg-slate-900 dark:hover:!bg-slate-800" :disabled="!!actionBusy" @click="runAction('create-reference-base')">Crear Referencias Base</button>
            <button class="btn-secondary justify-start !bg-slate-50 hover:!bg-slate-100 dark:!bg-slate-900 dark:hover:!bg-slate-800" :disabled="!!actionBusy" @click="runAction('install-dependencies')">Instalar Dependencias</button>
            <button class="btn-secondary justify-start !bg-slate-50 hover:!bg-slate-100 dark:!bg-slate-900 dark:hover:!bg-slate-800" :disabled="!!actionBusy" @click="loadAdmin">Actualizar panel</button>
          </div>
          <p v-if="admin.cache?.builtAt" class="mt-4 text-xs text-slate-500">Última caché de selectores: {{ admin.cache.builtAt }} · {{ admin.cache.buildReason || 'sin motivo registrado' }}</p>
        </section>

        <section class="surface-card border-red-200 dark:border-red-950">
          <p class="eyebrow text-red-600">Borrado</p>
          <h2 class="section-title mt-1">Repositorios locales</h2>
          <p class="mt-2 text-sm text-slate-500">Elimina datos generados o espacios de trabajo almacenados localmente.</p>
          <div class="mt-5 flex flex-wrap gap-3">
            <button class="btn-secondary text-red-700" :disabled="!!actionBusy" @click="runAction('delete-data', {}, '¿Borrar todo el contenido de /data?')">Borrar /data</button>
            <button class="btn-secondary text-red-700" :disabled="!!actionBusy" @click="runAction('delete-processed', {}, '¿Borrar todo el contenido de /procesado?')">Borrar /procesado</button>
            <button class="btn-secondary text-red-700" :disabled="!!actionBusy" @click="runAction('delete-workspace', {}, '¿Borrar todo el contenido de /codex-workspace?')">Borrar /codex-workspace</button>
          </div>
        </section>

        <section class="surface-card min-w-0">
          <div class="flex items-center justify-between"><div><p class="eyebrow">Application log</p><h2 class="section-title mt-1">Últimas líneas</h2></div><button class="btn-secondary" @click="loadAdmin">Actualizar</button></div>
          <pre class="mt-5 max-h-[32rem] overflow-auto rounded-xl bg-[#07111f] p-4 font-mono text-xs leading-5 text-slate-300">{{ admin.prettyLog || 'Sin log disponible.' }}</pre>
        </section>
      </template>
    </template>

    <template v-else>
      <section class="surface-card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><p class="eyebrow">User Okta Entity</p><h2 class="section-title mt-1">Búsqueda de usuarios</h2><p class="mt-2 text-sm text-slate-500">Consulta la misma colección <code>deptapp-user-login-okta</code> usada por los formularios antiguos.</p></div>
          <button class="btn-primary" @click="openUser()">Nuevo usuario</button>
        </div>
        <form class="mt-5 grid gap-3 md:grid-cols-4" @submit.prevent="loadUsers(true)">
          <input v-model="filters.userId" class="form-control" placeholder="User Id" />
          <input v-model="filters.userName" class="form-control" placeholder="User Name" />
          <input v-model="filters.userMail" class="form-control" placeholder="User Mail" />
          <select v-model="filters.roles" class="form-control" multiple><option v-for="role in roles" :key="role.value" :value="role.value">{{ role.label }}</option></select>
          <button class="btn-primary md:col-span-1" :disabled="usersLoading">{{ usersLoading ? 'Buscando...' : 'Search' }}</button>
        </form>
      </section>

      <section class="surface-card !p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900"><tr><th class="px-5 py-3">User Id</th><th class="px-5 py-3">User Name</th><th class="px-5 py-3">User Mail</th><th class="px-5 py-3">Roles</th><th class="px-5 py-3 text-right">Acciones</th></tr></thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr v-for="user in users" :key="user.recordId || user.userId"><td class="px-5 py-3 font-bold">{{ user.userId }}</td><td class="px-5 py-3">{{ user.userName }}</td><td class="px-5 py-3">{{ user.userMail }}</td><td class="px-5 py-3"><span class="text-xs">{{ user.roles.join(', ') }}</span></td><td class="px-5 py-3"><div class="flex justify-end gap-2"><button class="btn-secondary" @click="openUser(user)">Edit</button><button class="btn-secondary text-red-700" @click="deleteUser(user)">Delete</button></div></td></tr>
              <tr v-if="!usersLoading && !users.length"><td colspan="5" class="px-5 py-10 text-center text-slate-500">No hay usuarios para los filtros indicados.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm dark:border-slate-800"><span>{{ filters.total }} resultado(s)</span><div class="flex items-center gap-2"><button class="btn-secondary" :disabled="filters.page <= 1" @click="filters.page--; loadUsers()">Anterior</button><span>{{ filters.page }} / {{ totalPages }}</span><button class="btn-secondary" :disabled="filters.page >= totalPages" @click="filters.page++; loadUsers()">Siguiente</button></div></div>
      </section>

      <div v-if="userEditor" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" @click.self="userEditor = null">
        <section class="surface-card w-full max-w-2xl">
          <div class="flex items-center justify-between"><div><p class="eyebrow">User Okta Details</p><h2 class="section-title mt-1">{{ userEditor.isNew ? 'Nuevo usuario' : 'Editar usuario' }}</h2></div><button class="btn-ghost" @click="userEditor = null">✕</button></div>
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <div><label class="field-label">User Id</label><input v-model="userEditor.userId" class="form-control" /></div>
            <div><label class="field-label">User Mail</label><input v-model="userEditor.userMail" class="form-control" /></div>
            <div><label class="field-label">User Name</label><input v-model="userEditor.userName" class="form-control" /></div>
            <div><label class="field-label">Roles</label><select v-model="userEditor.roles" class="form-control" multiple><option v-for="role in roles" :key="role.value" :value="role.value">{{ role.label }}</option></select></div>
          </div>
          <div class="mt-6 flex justify-end gap-3"><button class="btn-secondary" @click="userEditor = null">Cancel</button><button class="btn-primary" @click="saveUser">Save</button></div>
        </section>
      </div>
    </template>
  </div>
</template>
