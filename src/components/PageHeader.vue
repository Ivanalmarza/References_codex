<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string; description?: string }>()
</script>

<template>
  <div class="mb-8">
    <p
      v-if="eyebrow"
      class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400"
    >
      {{ eyebrow }}
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{{ title }}</h1>
      <slot name="actions" />
    </div>
    <p v-if="description" class="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
      {{ description }}
    </p>
    <slot />
  </div>
</template>
