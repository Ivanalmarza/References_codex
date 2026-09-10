import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useExampleStore = defineStore('example', () => {
  const interactions = ref(0)
  const interactionLabel = computed(() => `Interaction ${interactions.value}`)
  function recordInteraction() {
    interactions.value += 1
  }
  return { interactions, interactionLabel, recordInteraction }
})
