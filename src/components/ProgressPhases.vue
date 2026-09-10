<script setup lang="ts">
import { computed } from 'vue'
import type { PhaseDefinition, PhaseState } from '../types/api'

const props = defineProps<{
  phases: PhaseDefinition[]
  status: Record<string, PhaseState>
}>()

const normalizedPhases = computed(() => {
  if (props.phases?.length) return props.phases
  return [
    { id: 'docs', label: 'Preparando fuentes' },
    { id: 'config', label: 'Configurando Codex' },
    { id: 'execute', label: 'Ejecutando Codex' },
    { id: 'changes', label: 'Aplicando cambios' },
    { id: 'report', label: 'Generando reportes' },
  ]
})

function stateFor(id: string): string {
  return String(props.status?.[id] || 'pending').toLowerCase()
}

function circleClass(id: string): string {
  const state = stateFor(id)
  if (state === 'done' || state === 'completed') return 'border-emerald-500 bg-emerald-500 text-white'
  if (state === 'error' || state === 'failed') return 'border-red-500 bg-red-500 text-white'
  if (state === 'current' || state === 'running' || state === 'active') return 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950'
  return 'border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500'
}
</script>

<template>
  <ol class="grid gap-3 md:grid-cols-5">
    <li v-for="(phase, index) in normalizedPhases" :key="phase.id" class="relative">
      <div class="flex items-center gap-3 md:flex-col md:items-start">
        <div class="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-xs font-black transition" :class="circleClass(phase.id)">
          <svg v-if="['done', 'completed'].includes(stateFor(phase.id))" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 4 4L19 6" /></svg>
          <svg v-else-if="['error', 'failed'].includes(stateFor(phase.id))" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 7v6M12 17h.01" /></svg>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <div>
          <p class="text-sm font-extrabold text-slate-800 dark:text-slate-100">{{ phase.label }}</p>
          <p class="mt-0.5 text-xs capitalize text-slate-500 dark:text-slate-400">{{ stateFor(phase.id) }}</p>
        </div>
      </div>
    </li>
  </ol>
</template>
