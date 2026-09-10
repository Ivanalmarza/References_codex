<script setup lang="ts">
withDefaults(defineProps<{ message?: string; compact?: boolean }>(), {
  message: 'Cargando...',
  compact: false,
})
</script>

<template>
  <div class="grid place-items-center" :class="compact ? 'min-h-24' : 'min-h-[50vh]'">
    <div class="text-center">
      <span class="mx-auto block h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400"></span>
      <p class="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{{ message }}</p>
    </div>
  </div>
</template>
