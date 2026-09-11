<script setup lang="ts">
import { ref } from 'vue'
import { createUpload, removeUpload } from '../services/referenceApi'
import { getProblemMessage } from '../services/api'
import { notify } from '../services/notyf'
import type { UploadToken } from '../types/api'

const props = withDefaults(defineProps<{
  modelValue: UploadToken[]
  scope?: string
  accept?: string
  maxFiles?: number
}>(), {
  scope: 'execution',
  accept: '.pdf,.csv,.docx,.pptx,.xlsx,.xls,.txt,.md,.zip',
  maxFiles: 20,
})

const emit = defineEmits<{
  'update:modelValue': [value: UploadToken[]]
}>()

const busy = ref(false)
const dragActive = ref(false)
const activeName = ref('')
const input = ref<HTMLInputElement | null>(null)
const maxBytes = 250 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('No se ha podido leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

async function addFiles(list: FileList | File[]): Promise<void> {
  const files = Array.from(list)
  if (!files.length) return
  if (props.modelValue.length + files.length > props.maxFiles) {
    notify.warning(`Máximo ${props.maxFiles} archivos.`)
    return
  }

  busy.value = true
  try {
    const next = [...props.modelValue]
    for (const file of files) {
      if (file.size > maxBytes) {
        notify.error(`${file.name}: supera el límite de 250 MB.`)
        continue
      }
      activeName.value = file.name
      const data = await readAsDataUrl(file)
      const token = await createUpload({ name: file.name, type: file.type, size: file.size, data }, props.scope)
      next.push(token)
      emit('update:modelValue', [...next])
    }
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se ha podido subir el archivo.'))
  } finally {
    busy.value = false
    activeName.value = ''
    if (input.value) input.value.value = ''
  }
}

async function remove(item: UploadToken): Promise<void> {
  try {
    await removeUpload(item.uploadId)
    emit('update:modelValue', props.modelValue.filter((candidate) => candidate.uploadId !== item.uploadId))
  } catch (error) {
    notify.error(getProblemMessage(error, 'No se ha podido eliminar el archivo temporal.'))
  }
}

function onDrop(event: DragEvent): void {
  dragActive.value = false
  if (event.dataTransfer?.files) void addFiles(event.dataTransfer.files)
}
</script>

<template>
  <div>
    <label
      class="group grid min-h-36 place-items-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition"
      :class="dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:bg-blue-950/20'"
      @dragenter.prevent="dragActive = true"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="onDrop"
    >
      <input ref="input" type="file" class="sr-only" multiple :accept="accept" :disabled="busy" @change="($event) => addFiles(($event.target as HTMLInputElement).files || [])" />
      <div>
        <span class="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5M5 14v5h14v-5" /></svg>
        </span>
        <p class="mt-3 text-sm font-extrabold text-slate-800 dark:text-slate-100">{{ busy ? `Subiendo ${activeName}...` : 'Arrastra archivos o pulsa para seleccionarlos' }}</p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Tamaño máximo recomendado: 250 MB por archivo. Los archivos se suben de forma secuencial.</p>
      </div>
    </label>

    <ul v-if="modelValue.length" class="mt-3 space-y-2">
      <li v-for="item in modelValue" :key="item.uploadId" class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div class="min-w-0">
          <p class="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{{ item.name }}</p>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{{ formatBytes(item.size) }}</p>
        </div>
        <button type="button" class="btn-ghost !h-9 !w-9 !p-0 text-red-600 dark:text-red-300" aria-label="Eliminar archivo" :disabled="busy" @click="remove(item)">
          <svg viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
        </button>
      </li>
    </ul>
  </div>
</template>
