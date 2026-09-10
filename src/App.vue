<script setup lang="ts">
import { onBeforeMount } from 'vue'
import { useThemeStore } from './stores/theme'

const themeStore = useThemeStore()

onBeforeMount(() => {
  themeStore.initializeTheme()
})
</script>

<template>
  <RouterView />
</template>
