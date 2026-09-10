import { ref, watch, type Ref } from 'vue'

export function useStorage<T>(key: string, defaultValue: T): Ref<T> {
  const storedValue = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
  const value = ref<T>(storedValue ? (JSON.parse(storedValue) as T) : defaultValue) as Ref<T>

  if (typeof window !== 'undefined') {
    watch(value, (nextValue) => window.localStorage.setItem(key, JSON.stringify(nextValue)), {
      deep: true,
    })
  }

  return value
}
