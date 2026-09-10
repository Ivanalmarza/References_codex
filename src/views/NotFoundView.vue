<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const { t } = useI18n()
</script>

<template>
  <section class="mx-auto max-w-5xl px-6 py-24 text-center">
    <p class="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">404</p>
    <h1 class="mt-4 text-4xl font-bold text-slate-900 dark:text-white">{{ t('home.notFound') }}</h1>
    <RouterLink to="/" class="mt-8 inline-block text-cyan-400 hover:text-cyan-300">{{
      t('home.backHome')
    }}</RouterLink>
  </section>
</template>
