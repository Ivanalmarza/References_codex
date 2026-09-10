<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: unknown
  depth?: number
  label?: string
}>(), {
  depth: 0,
  label: '',
})

const isArray = computed(() => Array.isArray(props.value))
const isObject = computed(() => Boolean(props.value) && typeof props.value === 'object' && !isArray.value)
const entries = computed(() => {
  if (isArray.value) return (props.value as unknown[]).map((value, index) => [String(index + 1), value] as const)
  if (isObject.value) return Object.entries(props.value as Record<string, unknown>)
  return []
})

function scalar(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

function displayKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())
}
</script>

<template>
  <div v-if="isObject || isArray" :class="depth ? 'space-y-2' : 'space-y-3'">
    <div
      v-for="([key, item], index) in entries"
      :key="`${key}-${index}`"
      class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <p class="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {{ isArray ? `Elemento ${key}` : displayKey(key) }}
      </p>
      <ResultDataTree v-if="item && typeof item === 'object'" :value="item" :depth="depth + 1" class="mt-2" />
      <p v-else class="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-100">
        {{ scalar(item) }}
      </p>
    </div>
  </div>
  <p v-else class="whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-100">
    {{ scalar(value) }}
  </p>
</template>
