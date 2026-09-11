<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingPanel from '../components/LoadingPanel.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { getLogTail, listLogs } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import { notify } from '../services/notyf'
import type { SessionSummary } from '../types/api'

const sessions = ref<SessionSummary[]>([])
const selectedId = ref('')
const tail = ref('')
const loadingList = ref(true)
const loadingLog = ref(false)
const autoRefresh = ref(false)
const error = ref<string | null>(null)
let timer: number | null = null

const selected = computed(() => sessions.value.find((item) => item.sessionId === selectedId.value) || null)

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

function formatBytes(value: number | undefined): string {
  if (!value) return 'Sin log'
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 ** 2).toFixed(1)} MB`
}

async function loadSessions(): Promise<void> {
  loadingList.value = true
  error.value = null
  try {
    const response = await listLogs()
    if (!response || response.ok !== true || !Array.isArray(response.sessions)) {
      throw new Error('LOGS_INVALID_RESPONSE')
    }
    sessions.value = response.sessions
    if (!selectedId.value && sessions.value.length) selectedId.value = sessions.value[0]?.sessionId || ''
    if (selectedId.value) await loadTail()
  } catch (reason) {
    error.value = getProblemMessage(reason, 'No se han podido listar las ejecuciones.')
  } finally {
    loadingList.value = false
  }
}

async function loadTail(): Promise<void> {
  if (!selectedId.value || loadingLog.value) return
  loadingLog.value = true
  try {
    const response = await getLogTail(selectedId.value, 600)
    if (!response || response.ok !== true) throw new Error('LOG_TAIL_INVALID_RESPONSE')
    tail.value = response.tail || ''
  } catch (reason) {
    notify.error(getProblemMessage(reason, 'No se ha podido cargar el log.'))
  } finally {
    loadingLog.value = false
  }
}

function toggleAutoRefresh(): void {
  autoRefresh.value = !autoRefresh.value
  if (timer !== null) window.clearInterval(timer)
  timer = null
  if (autoRefresh.value) timer = window.setInterval(() => void loadTail(), 3000)
}

onMounted(() => void loadSessions())
onBeforeUnmount(() => { if (timer !== null) window.clearInterval(timer) })
</script>

<template>
  <div class="page-shell space-y-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="eyebrow">Observabilidad</p>
        <h1 class="page-title mt-2">Ejecuciones y logs</h1>
        <p class="page-description">Consulta las sesiones que te pertenecen y el final de su log unificado. Los administradores pueden visualizar el ámbito autorizado por FLOWS.</p>
      </div>
      <button class="btn-secondary" :disabled="loadingList" @click="loadSessions">Actualizar lista</button>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>
    <LoadingPanel v-if="loadingList && !sessions.length" message="Buscando ejecuciones..." />

    <div v-else class="grid gap-6 xl:grid-cols-[23rem_1fr]">
      <section class="surface-card !p-0">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div class="flex items-center justify-between"><h2 class="section-title">Sesiones</h2><span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ sessions.length }}</span></div>
        </div>
        <div v-if="sessions.length" class="max-h-[68vh] overflow-auto p-2">
          <button
            v-for="item in sessions"
            :key="item.sessionId"
            type="button"
            class="w-full rounded-xl p-3 text-left transition"
            :class="selectedId === item.sessionId ? 'bg-blue-50 dark:bg-blue-950/35' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'"
            @click="selectedId = item.sessionId; loadTail()"
          >
            <div class="flex items-center justify-between gap-2">
              <StatusBadge :status="item.status" :ready="item.ready" :failed="item.failed" :stopped="item.stopped" />
              <span class="text-[11px] font-semibold text-slate-400">{{ item.progress }}%</span>
            </div>
            <p class="mt-2 truncate text-sm font-extrabold text-slate-900 dark:text-white">{{ item.opportunityTitle || item.project || 'Ejecución' }}</p>
            <p class="mt-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{{ item.sessionId }}</p>
            <div class="mt-2 flex justify-between text-[11px] text-slate-400"><span>{{ formatDate(item.updatedAt) }}</span><span>{{ formatBytes(item.logSize) }}</span></div>
          </button>
        </div>
        <EmptyState v-else class="m-4" title="Sin ejecuciones" description="Todavía no hay sesiones disponibles para este usuario." />
      </section>

      <section class="surface-card min-w-0">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow">Log de sesión</p>
            <h2 class="section-title mt-1">{{ selected?.opportunityTitle || selected?.project || 'Selecciona una ejecución' }}</h2>
            <p v-if="selected" class="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{{ selected.sessionId }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-secondary" :disabled="!selectedId || loadingLog" @click="loadTail">{{ loadingLog ? 'Cargando...' : 'Actualizar log' }}</button>
            <button class="btn-secondary" :disabled="!selectedId" @click="toggleAutoRefresh">{{ autoRefresh ? 'Detener autoactualización' : 'Autoactualizar' }}</button>
          </div>
        </div>

        <div v-if="selectedId" class="mt-5 min-h-[30rem] max-h-[68vh] overflow-auto rounded-xl bg-[#07111f] p-4 shadow-inner">
          <pre v-if="tail" class="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">{{ tail }}</pre>
          <p v-else class="font-mono text-xs text-slate-500">No hay líneas de log para esta sesión.</p>
        </div>
        <EmptyState v-else class="mt-5" title="Selecciona una sesión" description="El log unificado aparecerá aquí." />

        <div v-if="selected" class="mt-4 flex flex-wrap gap-2">
          <RouterLink :to="selected.ready || selected.terminal ? `/results/${selected.sessionId}` : `/execution/${selected.sessionId}`" class="btn-primary no-underline">{{ selected.ready ? 'Abrir resultados' : selected.terminal ? 'Abrir detalle final' : 'Abrir progreso' }}</RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
