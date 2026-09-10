import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '../composable/useStorage'

export type ThemeMode = 'light' | 'dark'

const applyThemeMode = (mode: ThemeMode): void => {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
}

export const useThemeStore = defineStore('theme', () => {
  const mode = useStorage<ThemeMode>('theme_mode', 'light')

  const setMode = (value: ThemeMode): void => {
    mode.value = value
    applyThemeMode(value)
  }

  const toggleMode = (): void => {
    setMode(mode.value === 'dark' ? 'light' : 'dark')
  }

  const initializeTheme = (): void => {
    applyThemeMode(mode.value)
  }

  return {
    mode,
    isDark: computed((): boolean => mode.value === 'dark'),
    setMode,
    toggleMode,
    initializeTheme,
  } as const
})
