<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import {
  fileDownloadUrl,
  getResult,
  requestExport,
  uploadResultToSharePoint,
  type SessionState,
} from '../services/executions'
import { notify } from '../services/notyf'

const route = useRoute()
const router = useRouter()
const sessionId = computed(() => String(route.params.sessionId || route.query.sessionId || ''))

const state = ref<SessionState>({})
const loading = ref(true)
const busy = ref<'' | 'excel' | 'pptx' | 'sp'>('')

const excelFilename = computed(() => String(state.value.output?.generatedExcelFilename ?? ''))
const monitoring = computed(() => (state.value.monitoring ?? {}) as Record<string, unknown>)

onMounted(async () => {
  if (!sessionId.value) {
    router.replace({ name: 'entry' })
    return
  }
  try {
    state.value = await getResult(sessionId.value)
  } finally {
    loading.value = false
  }
})

async function downloadExcel() {
  busy.value = 'excel'
  try {
    let filename = excelFilename.value
    if (!filename) {
      const r = await requestExport(sessionId.value, 'excel')
      filename = String(r.filename ?? '')
    }
    if (filename) window.open(fileDownloadUrl(filename), '_blank')
    else notify.error('No hay Excel disponible')
  } catch {
    notify.error('No se pudo descargar el Excel')
  } finally {
    busy.value = ''
  }
}

async function exportTemplate() {
  busy.value = 'pptx'
  try {
    const r = await requestExport(sessionId.value, 'pptx')
    const filename = String(r.filename ?? '')
    if (filename) window.open(fileDownloadUrl(filename), '_blank')
    notify.success('Plantilla generada')
  } catch {
    notify.error('No se pudo inyectar en la plantilla')
  } finally {
    busy.value = ''
  }
}

async function uploadSharePoint() {
  busy.value = 'sp'
  try {
    await uploadResultToSharePoint(sessionId.value)
    notify.success('Resultado subido a SharePoint')
  } catch {
    notify.error('No se pudo subir a SharePoint')
  } finally {
    busy.value = ''
  }
}

const summary = computed(() => {
  const m = monitoring.value
  const rows: Array<{ label: string; value: string }> = []
  if (m.duration) rows.push({ label: 'Duración', value: `${m.duration}s` })
  if (m.tokensUsed) rows.push({ label: 'Tokens', value: String(m.tokensUsed) })
  if (m.tasksTotal) rows.push({ label: 'Tareas', value: `${m.tasksCompleted ?? 0}/${m.tasksTotal}` })
  if (m.modelSelect) rows.push({ label: 'Modelo', value: String(m.modelSelect) })
  return rows
})

const btn =
  'flex items-center justify-center rounded-xl px-4 py-3 font-extrabold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <div>
    <PageHeader eyebrow="Resultado" title="Resultado de ejecución" description="El agente ha completado el análisis. Descarga el informe o lanza una nueva ejecución." />

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">Cargando resultado…</div>

    <template v-else>
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-end justify-between">
          <div class="text-4xl font-extrabold text-slate-900 dark:text-white">100<span class="text-xl text-slate-400">%</span></div>
          <span class="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600 dark:text-green-400">Ejecución completada</span>
        </div>
        <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div class="h-full w-full rounded-full bg-gradient-to-r from-[#0b2f55] to-[#1e6fd1]"></div>
        </div>
        <p class="mt-4 rounded-xl border border-cyan-500/15 bg-cyan-50/60 px-4 py-3 text-sm text-slate-700 dark:bg-cyan-500/5 dark:text-slate-300">
          El fichero <code class="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono">respuestas.json</code> ha sido generado y está listo para transformar y descargar.
        </p>
        <div v-if="summary.length" class="mt-4 grid gap-3 sm:grid-cols-4">
          <div v-for="row in summary" :key="row.label" class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div class="text-xs uppercase tracking-wide text-slate-400">{{ row.label }}</div>
            <div class="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{{ row.value }}</div>
          </div>
        </div>
      </section>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" :disabled="busy !== ''" class="bg-gradient-to-br from-[#1a6b3a] to-[#27ae60]" :class="btn" @click="downloadExcel">
          {{ busy === 'excel' ? 'Generando…' : '⬇ Descargar Excel' }}
        </button>
        <button type="button" :disabled="busy !== ''" class="bg-gradient-to-br from-[#0b2f55] to-[#1e6fd1]" :class="btn" @click="exportTemplate">
          {{ busy === 'pptx' ? 'Generando…' : '📄 Inyectar en plantilla' }}
        </button>
        <button type="button" :disabled="busy !== ''" class="bg-gradient-to-br from-[#036c70] to-[#038387]" :class="btn" @click="uploadSharePoint">
          {{ busy === 'sp' ? 'Subiendo…' : '☁ Subir a SharePoint' }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-slate-300 px-4 py-3 font-extrabold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="router.push({ name: 'start' })"
        >
          Nueva ejecución
        </button>
      </div>
    </template>
  </div>
</template>
