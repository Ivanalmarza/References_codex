import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark'
const STORAGE_KEY = 'references-codex-theme'

function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('light')

  function initializeTheme(): void {
    const stored = localStorage.getItem(STORAGE_KEY)
    mode.value = stored === 'dark' ? 'dark' : 'light'
    applyTheme(mode.value)
  }

  function setMode(value: ThemeMode): void {
    mode.value = value
    localStorage.setItem(STORAGE_KEY, value)
    applyTheme(value)
  }

  function toggleMode(): void {
    setMode(mode.value === 'dark' ? 'light' : 'dark')
  }

  return {
    mode,
    isDark: computed(() => mode.value === 'dark'),
    initializeTheme,
    toggleMode,
  }
})
