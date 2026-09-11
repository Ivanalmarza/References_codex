<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingPanel from '../components/LoadingPanel.vue'
import ResultDataTree from '../components/ResultDataTree.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { getProblemMessage } from '../services/api'
import {
  exportExcel,
  exportTemplate,
  getExecutionResults,
  getExecutionStatus,
  publishToSharePoint,
  releaseExecution,
  saveBlobResponse,
} from '../services/referenceApi'
import { notify } from '../services/notyf'
import { useAppStore } from '../stores/app'
import {
  formatBytes,
  formatDate,
  formatDurationSeconds,
  outputFormatLabel,
  sourceLabel,
} from '../utils/format'
import type { ExecutionResultsResponse, ExecutionStatusResponse } from '../types/api'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const results = ref<ExecutionResultsResponse | null>(null)
const executionStatus = ref<ExecutionStatusResponse | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const busyAction = ref<'excel' | 'template' | 'sharepoint' | 'new' | null>(null)
const sharePointResponse = ref<Record<string, unknown> | null>(null)

const sessionId = computed(() => String(route.params.sessionId || ''))
const session = computed(() => results.value?.session || null)
const isAdmin = computed(() =>
  (appStore.user?.roles || []).some((role) =>
    /(^|_)SUPER_ADMIN$|(^|_)ADMIN$/i.test(String(role)),
  ),
)
const successful = computed(() => Boolean(results.value?.success && session.value?.ready))
const resultUploadsOnly = computed(() => {
  const sources = results.value?.context.selectedSources || session.value?.selectedSources || []
  return sources.length === 1 && sources[0] === 'uploads'
})
const resultUploadedFiles = computed(() => executionStatus.value?.sourceSummary?.uploads?.files || [])
const stopped = computed(() => Boolean(results.value?.stopped || session.value?.stopped))
const failed = computed(() => Boolean(results.value?.failed || session.value?.failed))
const hasAnswers = computed(() => {
  const answers = results.value?.answers
  if (!answers || typeof answers !== 'object') return false
  return Array.isArray(answers) ? answers.length > 0 : Object.keys(answers).length > 0
})
const canGenerate = computed(() => successful.value && hasAnswers.value)
const selectedSourcesText = computed(() =>
  (results.value?.context.selectedSources || []).map(sourceLabel).join(' + ') ||
  sourceLabel(session.value?.sourceType || ''),
)
const metrics = computed(() => {
  const result = results.value?.result || {}
  const monitoring = results.value?.monitoring || {}
  return {
    duration: result.elapsed_seconds ?? monitoring.duration ?? monitoring.totalElapsed,
    commands: result.commands ?? monitoring.commandsExecuted ?? monitoring.totalCommands,
    tokens: result.tokens ?? monitoring.tokensUsed ?? monitoring.totalTokens,
    tasksCompleted: monitoring.tasksCompleted ?? session.value?.tasks.completed,
    tasksTotal: monitoring.tasksTotal ?? session.value?.tasks.total,
  }
})
const heroClasses = computed(() => {
  if (successful.value) return 'from-emerald-700 via-emerald-600 to-cyan-600 shadow-emerald-950/15'
  if (stopped.value) return 'from-amber-700 via-orange-600 to-amber-500 shadow-amber-950/15'
  if (failed.value) return 'from-red-800 via-red-700 to-rose-600 shadow-red-950/15'
  return 'from-slate-800 via-slate-700 to-slate-600 shadow-slate-950/15'
})
const finalLabel = computed(() => {
  if (successful.value) return 'Finalizado'
  if (stopped.value) return 'Detenido'
  if (failed.value) return 'Finalizado con error'
  return 'Estado final'
})
const finalTitle = computed(() => {
  if (session.value?.opportunityTitle) return session.value.opportunityTitle

  if (resultUploadsOnly.value) {
    if (resultUploadedFiles.value.length === 1) {
      return resultUploadedFiles.value[0]?.name || 'Archivos propios'
    }
    if (resultUploadedFiles.value.length > 1) {
      return `${resultUploadedFiles.value.length} archivos propios`
    }
    return 'Archivos propios'
  }

  const project = session.value?.project
  if (project && project !== 'uploads' && project !== 'mixed') return project

  if (successful.value) return 'Generación completada'
  if (stopped.value) return 'Ejecución detenida'
  if (failed.value) return 'Ejecución con error'
  return 'Detalle de la ejecución'
})
const finalDescription = computed(() => {
  if (successful.value) return 'Las respuestas están listas para generar y distribuir los entregables.'
  if (stopped.value) return 'La ejecución se detuvo por solicitud del usuario. Puedes revisar el estado, el reporte y los artefactos conservados.'
  if (failed.value) return session.value?.error || 'La ejecución terminó con error. Revisa el reporte y el log para localizar la causa.'
  return 'La sesión ha terminado sin un resultado exportable confirmado.'
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [response, statusResponse] = await Promise.all([
      getExecutionResults(sessionId.value),
      getExecutionStatus(sessionId.value).catch(() => null),
    ])
    results.value = response
    executionStatus.value = statusResponse
    if (response.session.terminal) appStore.setActiveSession(null)
  } catch (reason) {
    error.value = getProblemMessage(reason, 'No se ha podido cargar el detalle final de la ejecución.')
  } finally {
    loading.value = false
  }
}

function requireExportableResult(): boolean {
  if (canGenerate.value) return true
  notify.warning('Esta sesión no tiene un resultado completado y exportable.')
  return false
}

async function downloadExcel(): Promise<void> {
  if (!requireExportableResult()) return
  busyAction.value = 'excel'
  try {
    const response = await exportExcel(sessionId.value)
    saveBlobResponse(response, `referencias-${sessionId.value.slice(0, 8)}.xlsx`)
    notify.success('Excel preparado para descarga.')
  } catch (reason) {
    notify.error(getProblemMessage(reason, 'No se ha podido generar el Excel.'))
  } finally {
    busyAction.value = null
  }
}

async function downloadTemplate(): Promise<void> {
  if (!requireExportableResult()) return
  busyAction.value = 'template'
  try {
    const response = await exportTemplate(sessionId.value)
    const extension = results.value?.selection.outputType?.toLowerCase() || 'docx'
    saveBlobResponse(response, `referencias-${sessionId.value.slice(0, 8)}.${extension}`)
    notify.success('Documento preparado para descarga.')
  } catch (reason) {
    notify.error(getProblemMessage(reason, 'No se ha podido generar el documento.'))
  } finally {
    busyAction.value = null
  }
}

async function sendToSharePoint(): Promise<void> {
  if (!requireExportableResult()) return
  busyAction.value = 'sharepoint'
  sharePointResponse.value = null
  try {
    sharePointResponse.value = await publishToSharePoint(sessionId.value)
    notify.success('La operación de SharePoint ha finalizado.')
  } catch (reason) {
    notify.error(getProblemMessage(reason, 'No se ha podido publicar en SharePoint.'))
  } finally {
    busyAction.value = null
  }
}

async function createAnother(): Promise<void> {
  busyAction.value = 'new'
  try {
    await releaseExecution(sessionId.value).catch(() => undefined)
    await appStore.refreshBootstrap().catch(() => undefined)
    await router.push('/new')
  } finally {
    busyAction.value = null
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="page-shell space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="eyebrow">Detalle final</p>
        <h1 class="page-title mt-2">Resultado de la ejecución</h1>
        <p class="page-description">Consulta las respuestas, métricas, archivos generados y el reporte final. Los entregables se habilitan cuando la ejecución finaliza correctamente.</p>
      </div>
      <button class="btn-secondary" :disabled="loading" @click="load">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6v5h-5M4 18v-5h5" /><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" /></svg>
        Actualizar
      </button>
    </header>

    <LoadingPanel v-if="loading" message="Recuperando estado, respuestas y artefactos..." />

    <section v-else-if="error" class="surface-card max-w-3xl">
      <p class="error-banner">{{ error }}</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <button class="btn-primary" @click="load">Reintentar</button>
        <RouterLink :to="`/execution/${sessionId}`" class="btn-secondary no-underline">Volver al seguimiento</RouterLink>
      </div>
    </section>

    <template v-else-if="results && session">
      <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br px-6 py-7 text-white shadow-2xl sm:px-8" :class="heroClasses">
        <div class="absolute -right-12 -top-20 h-60 w-60 rounded-full border-[40px] border-white/10"></div>
        <div class="relative flex flex-wrap items-start justify-between gap-6">
          <div class="min-w-0 max-w-3xl flex-1">
            <StatusBadge :status="session.status" :ready="successful" :failed="failed" :stopped="stopped" />
            <h2 class="mt-4 max-w-full break-words text-3xl font-black tracking-tight" style="overflow-wrap:anywhere">{{ finalTitle }}</h2>
            <p class="mt-2 text-sm leading-6 text-white/85">{{ finalDescription }}</p>
            <p class="mt-3 text-sm font-semibold text-white/85">{{ selectedSourcesText }} · {{ results.selection.template || session.template || 'Sin plantilla' }}</p>
            <p class="mt-2 font-mono text-xs text-white/70">{{ session.sessionId }}</p>
          </div>
          <div class="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-right backdrop-blur">
            <p class="text-xs font-black uppercase tracking-wider text-white/75">{{ finalLabel }}</p>
            <p class="mt-2 text-sm font-bold">{{ formatDate(session.updatedAt) }}</p>
          </div>
        </div>
      </section>

      <div v-if="stopped" class="warning-banner">
        <strong>Ejecución detenida.</strong> No se generarán nuevos batches. El contenido y los archivos ya persistidos siguen disponibles para consulta.
      </div>
      <div v-else-if="failed" class="error-banner">
        <strong>La ejecución terminó con error.</strong> {{ session.error || 'Consulta el reporte y el log para obtener el detalle.' }}
      </div>
      <div v-else-if="!successful" class="warning-banner">
        La sesión es terminal, pero FLOWS no ha confirmado un resultado correcto y exportable.
      </div>

      <section class="surface-card">
        <p class="eyebrow">Acciones</p>
        <h2 class="section-title mt-1">{{ canGenerate ? 'Generar y distribuir entregables' : 'Acciones de la sesión' }}</h2>
        <p v-if="!canGenerate" class="mt-2 text-sm text-slate-500 dark:text-slate-400">Excel, documento y SharePoint permanecen deshabilitados hasta disponer de <code>respuestas.json</code> y estado de éxito.</p>
        <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button class="btn-secondary min-h-24 !justify-start !px-5 text-left" :disabled="busyAction !== null || !canGenerate" @click="downloadExcel">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6zM15 3v5h5M9 12l6 5M15 12l-6 5" /></svg></span>
            <span><strong class="block">{{ busyAction === 'excel' ? 'Generando...' : 'Descargar Excel' }}</strong><small class="mt-1 block font-medium text-slate-500">Respuestas y trazabilidad</small></span>
          </button>
          <button class="btn-secondary min-h-24 !justify-start !px-5 text-left" :disabled="busyAction !== null || !canGenerate" @click="downloadTemplate">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6zM15 3v5h5M9 12h7M9 16h7" /></svg></span>
            <span><strong class="block">{{ busyAction === 'template' ? 'Generando...' : `Descargar ${results.selection.outputType?.toUpperCase() || 'documento'}` }}</strong><small class="mt-1 block font-medium text-slate-500">Plantilla seleccionada</small></span>
          </button>
          <button class="btn-secondary min-h-24 !justify-start !px-5 text-left" :disabled="busyAction !== null || !canGenerate" @click="sendToSharePoint">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16v12H4zM8 4h8v3M8 12h8M12 8v8" /></svg></span>
            <span><strong class="block">{{ busyAction === 'sharepoint' ? 'Publicando...' : 'Enviar a SharePoint' }}</strong><small class="mt-1 block font-medium text-slate-500">Rama actual de FLOWS</small></span>
          </button>
          <button class="btn-primary min-h-24 !justify-start !px-5 text-left" :disabled="busyAction !== null" @click="createAnother">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg></span>
            <span><strong class="block">Nueva referencia</strong><small class="mt-1 block font-medium text-blue-100">Liberar esta sesión</small></span>
          </button>
        </div>
        <div v-if="sharePointResponse" class="info-banner mt-5">
          <strong>Respuesta de SharePoint:</strong>
          <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs">{{ JSON.stringify(sharePointResponse, null, 2) }}</pre>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article class="surface-card-flat p-4"><p class="text-xs font-black uppercase tracking-wide text-slate-400">Duración</p><p class="mt-2 text-xl font-black text-slate-900 dark:text-white">{{ formatDurationSeconds(metrics.duration) }}</p></article>
        <article class="surface-card-flat p-4"><p class="text-xs font-black uppercase tracking-wide text-slate-400">Comandos</p><p class="mt-2 text-xl font-black text-slate-900 dark:text-white">{{ metrics.commands ?? '—' }}</p></article>
        <article class="surface-card-flat p-4"><p class="text-xs font-black uppercase tracking-wide text-slate-400">Tokens</p><p class="mt-2 text-xl font-black text-slate-900 dark:text-white">{{ Number(metrics.tokens || 0).toLocaleString('es-ES') || '—' }}</p></article>
        <article class="surface-card-flat p-4"><p class="text-xs font-black uppercase tracking-wide text-slate-400">Tareas</p><p class="mt-2 text-xl font-black text-slate-900 dark:text-white">{{ metrics.tasksCompleted ?? '—' }}/{{ metrics.tasksTotal ?? '—' }}</p></article>
        <article class="surface-card-flat p-4"><p class="text-xs font-black uppercase tracking-wide text-slate-400">Formato</p><p class="mt-2 text-xl font-black text-slate-900 dark:text-white">{{ outputFormatLabel(results.selection.sectorOutputFormat) }}</p></article>
      </section>

      <section class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <article class="surface-card">
          <p class="eyebrow">Respuestas</p>
          <h2 class="section-title mt-1">Contenido generado</h2>
          <div v-if="hasAnswers" class="mt-5"><ResultDataTree :value="results.answers" /></div>
          <div v-else class="warning-banner mt-5">No se ha generado o no se ha podido leer <code>respuestas.json</code>. Revisa el reporte de ejecución y el log.</div>
        </article>

        <aside class="space-y-5">
          <article class="surface-card-flat p-5">
            <p class="eyebrow">Selección</p>
            <dl class="mt-4 space-y-3 text-sm">
              <div><dt class="font-bold text-slate-400">Plantilla</dt><dd class="mt-1 break-words font-extrabold text-slate-800 dark:text-slate-100">{{ results.selection.template || '—' }}</dd></div>
              <div><dt class="font-bold text-slate-400">Modelo</dt><dd class="mt-1 font-extrabold text-slate-800 dark:text-slate-100">{{ results.selection.model || 'Default global' }}</dd></div>
              <div><dt class="font-bold text-slate-400">Reasoning</dt><dd class="mt-1 font-extrabold text-slate-800 dark:text-slate-100">{{ results.selection.reasoning || 'Default global' }}</dd></div>
              <div><dt class="font-bold text-slate-400">Idioma</dt><dd class="mt-1 font-extrabold text-slate-800 dark:text-slate-100">{{ results.context.outputLanguage || '—' }}</dd></div>
            </dl>
          </article>

          <article class="surface-card-flat p-5">
            <p class="eyebrow">Artefactos</p>
            <ul v-if="results.files.length" class="mt-4 space-y-3">
              <li v-for="file in results.files" :key="file.name" class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p class="break-all text-sm font-extrabold text-slate-800 dark:text-slate-100">{{ file.name }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ file.kind.toUpperCase() }} · {{ file.size === null ? 'Tamaño no disponible' : formatBytes(file.size) }}</p>
              </li>
            </ul>
            <p v-else class="mt-4 text-sm text-slate-500">Sin artefactos registrados.</p>
          </article>

          <RouterLink v-if="isAdmin" :to="{ name: 'logs', query: { sessionId } }" class="btn-secondary w-full no-underline">Abrir log de la sesión</RouterLink>
        </aside>
      </section>

      <section v-if="results.context.instruction" class="surface-card">
        <p class="eyebrow">Instrucción específica</p>
        <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{{ results.context.instruction }}</p>
      </section>

      <section v-if="results.report" class="surface-card">
        <p class="eyebrow">Reporte de ejecución</p>
        <h2 class="section-title mt-1">EXECUTION_REPORT.md</h2>
        <pre class="mt-5 max-h-[48rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-5 text-xs leading-6 text-slate-200">{{ results.report }}</pre>
      </section>
    </template>
  </div>
</template>
