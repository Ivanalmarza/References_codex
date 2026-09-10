<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { getLogs, type LogEntry } from '../services/logs'

const sessionId = ref('')
const logs = ref<LogEntry[]>([])
const loading = ref(false)
const auto = ref(true)
let timer: number | undefined

async function load() {
  loading.value = true
  try {
    logs.value = await getLogs(sessionId.value || undefined)
  } finally {
    loading.value = false
  }
}

function levelClass(level?: string): string {
  const l = String(level || '').toLowerCase()
  if (l === 'error') return 'text-red-400'
  if (l === 'warn' || l === 'warning') return 'text-amber-400'
  if (l === 'success') return 'text-green-400'
  return 'text-slate-300'
}

onMounted(() => {
  void load()
  timer = window.setInterval(() => {
    if (auto.value) void load()
  }, 4000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div>
    <PageHeader eyebrow="Diagnóstico" title="Log viewer" description="Consulta los logs de una sesión de ejecución." />

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <input
        v-model="sessionId"
        type="text"
        placeholder="sessionId (opcional)"
        class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        @keyup.enter="load"
      />
      <button
        type="button"
        class="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400"
        @click="load"
      >
        {{ loading ? 'Cargando…' : 'Cargar' }}
      </button>
      <label class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <input v-model="auto" type="checkbox" class="h-4 w-4 accent-cyan-500" /> Auto-refresco
      </label>
    </div>

    <div class="max-h-[65vh] overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed">
      <p v-if="!logs.length" class="text-slate-500">Sin logs para mostrar.</p>
      <div v-for="(entry, i) in logs" :key="i" class="whitespace-pre-wrap">
        <span class="text-slate-500">{{ entry.ts || '' }}</span>
        <span v-if="entry.phase" class="text-cyan-400"> [{{ entry.phase }}]</span>
        <span :class="levelClass(entry.level)"> {{ entry.message }}</span>
      </div>
    </div>
  </div>
</template>
