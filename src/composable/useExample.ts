import { computed, ref } from 'vue'

export function useExample() {
  const value = ref(0)
  const doubledValue = computed(() => value.value * 2)
  function increment() {
    value.value += 1
  }
  return { value, doubledValue, increment }
}
