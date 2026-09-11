<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProgressPhases from '../components/ProgressPhases.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingPanel from '../components/LoadingPanel.vue'
import { getProblemMessage } from '../services/api'
import { getExecutionStatus, stopExecution } from '../services/referenceApi'
import { notify } from '../services/notyf'
import { useAppStore } from '../stores/app'
import { formatBytes, formatDate, sourceLabel } from '../utils/format'
import type { ExecutionStatusResponse, SourceSummaryEntry } from '../types/api'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const status = ref<ExecutionStatusResponse | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const stopping = ref(false)
const error = ref<string | null>(null)
let timer: number | null = null
let redirected = false

const sessionId = computed(() => String(route.params.sessionId || ''))
const session = computed(() => status.value?.session || null)
const sourceEntries = computed(() => Object.entries(status.value?.sourceSummary || {}) as Array<[string, SourceSummaryEntry]>)
const uploadsOnly = computed(() => {
  const sources = session.value?.selectedSources || []
  return sources.length === 1 && sources[0] === 'uploads'
})
const uploadedFiles = computed(() => status.value?.sourceSummary?.uploads?.files || [])
const executionTitle = computed(() => {
  const current = session.value
  if (!current) return 'Generación de referencia'
  if (current.opportunityTitle) return current.opportunityTitle
  if (uploadsOnly.value) {
    if (uploadedFiles.value.length === 1) return uploadedFiles.value[0]?.name || 'Archivos propios'
    if (uploadedFiles.value.length > 1) return String(uploadedFiles.value.length) + ' archivos propios'
    return 'Archivos propios'
  }
  return current.project || 'Generación de referencia'
})
const uploadConfigLabel = computed(() => {
  const names = uploadedFiles.value.map((file) => file.name).filter(Boolean)
  return names.length ? names.join(', ') : 'Archivos propios'
})
const progressWidth = computed(() => `${Math.max(0, Math.min(100, session.value?.progress || 0))}%`)
const lastLogLines = computed(() => {
  const tail = status.value?.logs?.tail || ''
  return tail.split(/\r?\n/).filter(Boolean).slice(-120).join('\n')
})

function clearTimer(): void {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
}

function schedule(): void {
  clearTimer()
  if (!status.value?.session?.terminal) {
    timer = window.setTimeout(() => void load(false), 3000)
  }
}

async function load(showSpinner = true): Promise<void> {
  if (!sessionId.value) {
    error.value = 'No se ha recibido un identificador de sesión válido.'
    loading.value = false
    return
  }

  if (showSpinner && !status.value) loading.value = true
  refreshing.value = Boolean(status.value)
  try {
    const response = await getExecutionStatus(sessionId.value)
    status.value = response
    appStore.setActiveSession(response.session.terminal ? null : response.session)
    error.value = null

    if (response.session.ready && !redirected) {
      redirected = true
      clearTimer()
      await router.replace(`/results/${encodeURIComponent(sessionId.value)}`)
      return
    }
    schedule()
  } catch (reason) {
    error.value = getProblemMessage(reason, 'No se ha podido consultar el estado de la ejecución.')
    schedule()
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function requestStop(): Promise<void> {
  if (!session.value?.canStop || stopping.value) return
  const accepted = window.confirm('Se solicitará la parada del proceso actual y no se lanzarán más batches. ¿Continuar?')
  if (!accepted) return

  stopping.value = true
  try {
    await stopExecution(sessionId.value)
    notify.warning('Se ha solicitado la parada de la ejecución.')
    await load(false)
  } catch (reason) {
    notify.error(getProblemMessage(reason, 'No se ha podido detener la ejecución.'))
  } finally {
    stopping.value = false
  }
}

onMounted(() => void load())
onBeforeUnmount(clearTimer)
</script>

<template>
  <div class="page-shell space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="eyebrow">Seguimiento</p>
        <h1 class="page-title mt-2">Ejecución de la referencia</h1>
        <p class="page-description">Consulta el progreso de la generación. Puedes abandonar esta página y recuperar la ejecución desde Inicio.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" :disabled="refreshing" @click="load(false)">
          <svg viewBox="0 0 24 24" class="h-4 w-4" :class="{ 'animate-spin': refreshing }" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6v5h-5M4 18v-5h5" /><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" /></svg>
          Actualizar
        </button>
        <button v-if="session?.canStop" class="btn-danger" :disabled="stopping" @click="requestStop">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          {{ stopping ? 'Deteniendo...' : 'Detener ejecución' }}
        </button>
      </div>
    </header>

    <LoadingPanel v-if="loading" message="Cargando el estado de la ejecución..." />

    <div v-else-if="error && !status" class="surface-card max-w-3xl">
      <p class="error-banner">{{ error }}</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <button class="btn-primary" @click="load">Reintentar</button>
        <RouterLink to="/" class="btn-secondary no-underline">Volver a Inicio</RouterLink>
      </div>
    </div>

    <template v-else-if="status && session">
      <div v-if="error" class="warning-banner">La última actualización falló: {{ error }}. Se conservaron los datos anteriores.</div>
      <div v-if="status.runtime.stale" class="warning-banner">No se detecta actividad reciente desde hace {{ status.runtime.staleMinutes }} minuto(s). Puedes revisar el log o detener la ejecución.</div>
      <div v-if="session.stopped" class="warning-banner"><strong>Ejecución detenida.</strong> No se lanzarán nuevos batches. Las tareas ya completadas se conservan.</div>
      <div v-if="session.stopped" class="flex flex-wrap gap-3">
        <RouterLink to="/new" class="btn-secondary min-h-14 min-w-44 px-6 text-base no-underline">Nueva ejecución</RouterLink>
        <RouterLink :to="`/results/${session.sessionId}`" class="btn-primary min-h-14 min-w-44 px-6 text-base no-underline">Abrir detalle final</RouterLink>
      </div>
      <div v-if="session.failed" class="error-banner"><strong>La ejecución terminó con error.</strong> {{ session.error || status.runtime.error || 'Consulta el log para ver el detalle.' }}</div>

      <section class="surface-card">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-3">
              <StatusBadge :status="session.status" :ready="session.ready" :failed="session.failed" :stopped="session.stopped" />
              <span class="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ session.sessionId }}</span>
            </div>
            <h2 class="mt-4 max-w-full break-words text-2xl font-black text-slate-950 dark:text-white" style="overflow-wrap:anywhere">{{ executionTitle }}</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Actualizado {{ formatDate(status.updatedAt || session.updatedAt) }}</p>
          </div>
          <div class="text-right">
            <p class="text-4xl font-black tracking-tight text-[#0b2f55] dark:text-blue-300">{{ session.progress }}%</p>
            <p class="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{{ session.tasks.completed }}/{{ session.tasks.total || '—' }} tareas</p>
          </div>
        </div>

        <div class="mt-6 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div class="h-full rounded-full bg-gradient-to-r from-[#0b2f55] via-blue-600 to-cyan-400 transition-all duration-500" :style="{ width: progressWidth }"></div>
        </div>
        <p class="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{{ status.runtime.status }}</p>

        <div class="mt-7 border-t border-slate-200 pt-6 dark:border-slate-700">
          <ProgressPhases :phases="status.phases" :status="status.phaseStatus" />
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-3">
        <article class="surface-card-flat p-5 lg:col-span-2">
          <p class="eyebrow">Configuración</p>
          <dl class="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Fuentes</dt><dd class="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{{ session.selectedSources.map(sourceLabel).join(' + ') || sourceLabel(session.sourceType) }}</dd></div>
            <div><dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Plantilla</dt><dd class="mt-1 break-words text-sm font-bold text-slate-800 dark:text-slate-100">{{ session.template || 'Pendiente' }}</dd></div>
            <div v-if="!uploadsOnly"><dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Unidad</dt><dd class="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{{ session.unit || '—' }}</dd></div>
            <div v-if="!uploadsOnly"><dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Proyecto</dt><dd class="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{{ session.project || '—' }}</dd></div>
            <div v-if="uploadsOnly"><dt class="text-xs font-bold uppercase tracking-wide text-slate-400">{{ uploadedFiles.length === 1 ? 'Archivo' : 'Archivos' }}</dt><dd class="mt-1 break-words text-sm font-bold text-slate-800 dark:text-slate-100">{{ uploadConfigLabel }}</dd></div>
            <div><dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Modelo</dt><dd class="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{{ session.model || 'Default global' }}</dd></div>
            <div><dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Reasoning</dt><dd class="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{{ session.reasoning || 'Default global' }}</dd></div>
          </dl>
        </article>

        <article class="surface-card-flat p-5">
          <p class="eyebrow">Tareas</p>
          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><p class="text-2xl font-black text-emerald-700 dark:text-emerald-300">{{ session.tasks.completed }}</p><p class="text-[11px] font-bold text-emerald-700/70 dark:text-emerald-300/70">Hechas</p></div>
            <div class="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30"><p class="text-2xl font-black text-blue-700 dark:text-blue-300">{{ session.tasks.remaining }}</p><p class="text-[11px] font-bold text-blue-700/70 dark:text-blue-300/70">Pendientes</p></div>
            <div class="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p class="text-2xl font-black text-slate-700 dark:text-slate-200">{{ session.tasks.batch || '—' }}</p><p class="text-[11px] font-bold text-slate-500">Batch</p></div>
          </div>
        </article>
      </section>

      <section class="surface-card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><p class="eyebrow">Fuentes utilizadas</p><h2 class="section-title mt-1">Documentos utilizados en la referencia</h2></div>
        </div>
        <div class="mt-5 grid gap-4 md:grid-cols-3">
          <article v-for="([source, entry]) in sourceEntries" :key="source" class="rounded-2xl border p-4" :class="entry.active ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50/50 opacity-65 dark:border-slate-700 dark:bg-slate-950/40'">
            <div class="flex items-center justify-between gap-2"><h3 class="font-extrabold text-slate-900 dark:text-white">{{ sourceLabel(source) }}</h3><span class="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{{ entry.fileCount }}</span></div>
            <ul v-if="entry.files.length" class="mt-3 space-y-2">
              <li v-for="file in entry.files.slice(0, 6)" :key="file.name" class="flex justify-between gap-2 text-xs text-slate-600 dark:text-slate-300"><span class="truncate">{{ file.name }}</span><span class="shrink-0 text-slate-400">{{ formatBytes(file.size) }}</span></li>
            </ul>
            <p v-else class="mt-3 text-xs text-slate-500">{{ entry.active ? 'Todavía sin ficheros registrados.' : 'Fuente no activada.' }}</p>
            <p v-if="entry.errors.length" class="mt-3 text-xs font-semibold text-red-600">{{ entry.errors.length }} error(es)</p>
          </article>
        </div>
      </section>

      <section class="surface-card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><p class="eyebrow">Log en vivo</p><h2 class="section-title mt-1">Últimas líneas de la ejecución</h2></div>
          <RouterLink :to="{ name: 'logs', query: { sessionId } }" class="btn-secondary no-underline">Abrir visor completo</RouterLink>
        </div>
        <pre class="mt-5 max-h-[36rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-200">{{ lastLogLines || 'El log todavía no contiene información.' }}</pre>
      </section>

      <div v-if="session.terminal && !session.stopped" class="flex flex-wrap justify-end gap-3">
        <RouterLink to="/new" class="btn-secondary no-underline">Nueva ejecución</RouterLink>
        <RouterLink :to="`/results/${session.sessionId}`" class="btn-primary no-underline">{{ session.ready ? 'Abrir resultados' : 'Abrir detalle final' }}</RouterLink>
      </div>
    </template>
  </div>
</template>
