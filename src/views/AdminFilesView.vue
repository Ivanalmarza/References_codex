<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { getAreas, getProjects, getFiles, uploadFile, type SpFolder, type SpFile } from '../services/adminFiles'
import { notify } from '../services/notyf'

const areas = ref<SpFolder[]>([])
const projects = ref<SpFolder[]>([])
const filesList = ref<SpFile[]>([])
const area = ref('')
const project = ref('')
const toUpload = ref<File[]>([])
const loading = ref({ areas: true, projects: false, files: false })
const uploading = ref(false)

const canBrowse = computed(() => Boolean(area.value && project.value))

onMounted(async () => {
  try {
    areas.value = await getAreas()
  } finally {
    loading.value.areas = false
  }
})

watch(area, async (a) => {
  project.value = ''
  projects.value = []
  filesList.value = []
  if (!a) return
  loading.value.projects = true
  try {
    projects.value = await getProjects(a)
  } finally {
    loading.value.projects = false
  }
})

watch(project, () => {
  if (canBrowse.value) void loadFiles()
})

async function loadFiles() {
  if (!canBrowse.value) return
  loading.value.files = true
  try {
    filesList.value = await getFiles(area.value, project.value)
  } finally {
    loading.value.files = false
  }
}

function onFilesChange(event: Event) {
  const input = event.target as HTMLInputElement
  toUpload.value = input.files ? Array.from(input.files) : []
}

async function upload() {
  if (!canBrowse.value || !toUpload.value.length) return
  uploading.value = true
  try {
    const form = new FormData()
    form.append('area', area.value)
    form.append('project', project.value)
    for (const file of toUpload.value) form.append('files', file)
    await uploadFile(form)
    notify.success('Fichero(s) subido(s)')
    toUpload.value = []
    await loadFiles()
  } catch {
    notify.error('No se pudo subir el fichero')
  } finally {
    uploading.value = false
  }
}

const control =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const label = 'block text-sm font-medium text-slate-700 dark:text-slate-200'
const card = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'
</script>

<template>
  <div>
    <PageHeader
      eyebrow="SharePoint"
      title="Admin files"
      description="Navega por áreas y proyectos de SharePoint, consulta y sube ficheros."
    />

    <section :class="card">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label :class="label">Área</label>
          <select v-model="area" :class="control" :disabled="loading.areas">
            <option value="" disabled>{{ loading.areas ? 'Cargando…' : 'Seleccionar área' }}</option>
            <option v-for="a in areas" :key="a.id || a.name" :value="a.name">{{ a.name }}</option>
          </select>
        </div>
        <div>
          <label :class="label">Proyecto</label>
          <select v-model="project" :class="control" :disabled="!area || loading.projects">
            <option value="" disabled>{{ loading.projects ? 'Cargando…' : 'Seleccionar proyecto' }}</option>
            <option v-for="p in projects" :key="p.id || p.name" :value="p.name">{{ p.name }}</option>
          </select>
        </div>
      </div>
    </section>

    <section v-if="canBrowse" :class="[card, 'mt-4']">
      <h3 class="text-base font-semibold text-slate-900 dark:text-white">Subir fichero</h3>
      <input type="file" multiple class="mt-3 block w-full text-sm text-slate-600 dark:text-slate-300" @change="onFilesChange" />
      <button
        type="button"
        :disabled="!toUpload.length || uploading"
        class="mt-4 rounded-lg bg-gradient-to-br from-[#036c70] to-[#038387] px-5 py-2.5 font-bold text-white transition hover:opacity-95 disabled:opacity-50"
        @click="upload"
      >
        {{ uploading ? 'Subiendo…' : 'Subir' }}
      </button>
    </section>

    <section v-if="canBrowse" :class="[card, 'mt-4']">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Ficheros</h3>
        <button type="button" class="text-sm text-cyan-600 hover:underline dark:text-cyan-400" @click="loadFiles">Refrescar</button>
      </div>
      <p v-if="loading.files" class="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      <p v-else-if="!filesList.length" class="text-sm text-slate-500 dark:text-slate-400">No hay ficheros.</p>
      <table v-else class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
          <tr>
            <th class="py-2">Nombre</th>
            <th class="py-2">Modificado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="file in filesList" :key="file.id || file.name" class="border-b border-slate-100 dark:border-slate-800">
            <td class="py-2 text-slate-800 dark:text-slate-200">
              <a v-if="file.webUrl" :href="file.webUrl" target="_blank" rel="noopener" class="text-cyan-600 hover:underline dark:text-cyan-400">{{ file.name }}</a>
              <span v-else>{{ file.name }}</span>
            </td>
            <td class="py-2 text-slate-500 dark:text-slate-400">{{ file.modified || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
