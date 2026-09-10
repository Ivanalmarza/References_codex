<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status?: string | null
  ready?: boolean
  failed?: boolean
  stopped?: boolean
}>()

const styleClass = computed(() => {
  if (props.failed) return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
  if (props.stopped) return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
  if (props.ready) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
  return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300'
})
</script>

<template>
  <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold" :class="styleClass">
    <span class="h-1.5 w-1.5 rounded-full bg-current" :class="{ 'animate-pulse': !ready && !failed && !stopped }"></span>
    {{ status || (ready ? 'Completado' : 'En ejecución') }}
  </span>
</template>
