<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string }>(), {
  description: '',
})
</script>

<template>
  <div class="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
    <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
      <slot name="icon">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 6.5h16M6 3.5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </slot>
    </div>
    <h3 class="mt-4 text-base font-extrabold text-slate-900 dark:text-white">{{ title }}</h3>
    <p v-if="description" class="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>
