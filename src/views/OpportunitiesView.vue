<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { getSelectors, type Selectors } from '../services/selectors'
import { listDocs, uploadDocs, deleteDoc, type OpportunityDoc } from '../services/opportunities'
import { notify } from '../services/notyf'

const router = useRouter()
const selectors = ref<Selectors | null>(null)
const unidad = ref('')
const oportunidad = ref('')
const docs = ref<OpportunityDoc[]>([])
const files = ref<File[]>([])
const loadingDocs = ref(false)
const uploading = ref(false)

const canOperate = computed(() => Boolean(unidad.value && oportunidad.value))

onMounted(async () => {
  selectors.value = await getSelectors()
})

watch(unidad, async (u) => {
  oportunidad.value = ''
  docs.value = []
  if (!u || !selectors.value) return
  const next = await getSelectors({ unidadOportunidad: u })
  selectors.value = { ...selectors.value, oportunidades: next.oportunidades }
})

watch(oportunidad, () => {
  if (canOperate.value) void loadDocs()
})

async function loadDocs() {
  if (!canOperate.value) return
  loadingDocs.value = true
  try {
    docs.value = await listDocs({ unidad: unidad.value, oportunidad: oportunidad.value })
  } finally {
    loadingDocs.value = false
  }
}

function onFilesChange(event: Event) {
  const input = event.target as HTMLInputElement
  files.value = input.files ? Array.from(input.files) : []
}

async function upload() {
  if (!canOperate.value || !files.value.length) return
  uploading.value = true
  try {
    const form = new FormData()
    form.append('unidad', unidad.value)
    form.append('oportunidad', oportunidad.value)
    for (const file of files.value) form.append('files', file)
    await uploadDocs(form)
    notify.success('Documentos subidos')
    files.value = []
    await loadDocs()
  } catch {
    notify.error('No se pudieron subir los documentos')
  } finally {
    uploading.value = false
  }
}

async function remove(doc: OpportunityDoc) {
  try {
    await deleteDoc(doc.id)
    notify.success('Documento eliminado')
    await loadDocs()
  } catch {
    notify.error('No se pudo eliminar el documento')
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
      eyebrow="SharePoint · Mana"
      title="Oportunidades MANA"
      description="Sube, comprueba o elimina los documentos de una oportunidad en SharePoint."
    />

    <section :class="card">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label :class="label">Unidad</label>
          <select v-model="unidad" :class="control">
            <option value="" disabled>Seleccionar unidad</option>
            <option v-for="o in selectors?.unidadesOportunidad" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div>
          <label :class="label">Oportunidad</label>
          <select v-model="oportunidad" :class="control" :disabled="!unidad">
            <option value="" disabled>Buscar oportunidad</option>
            <option v-for="o in selectors?.oportunidades" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
      </div>

      <div v-if="canOperate" class="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400"
          @click="router.push({ name: 'opportunity-check', query: { unidad, oportunidad } })"
        >
          Comprobar documentos
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="router.push({ name: 'opportunity-delete', query: { unidad, oportunidad } })"
        >
          Gestionar eliminación
        </button>
      </div>
    </section>

    <section v-if="canOperate" :class="[card, 'mt-4']">
      <h3 class="text-base font-semibold text-slate-900 dark:text-white">Subir documentos</h3>
      <input type="file" multiple class="mt-3 block w-full text-sm text-slate-600 dark:text-slate-300" @change="onFilesChange" />
      <button
        type="button"
        :disabled="!files.length || uploading"
        class="mt-4 rounded-lg bg-gradient-to-br from-[#036c70] to-[#038387] px-5 py-2.5 font-bold text-white transition hover:opacity-95 disabled:opacity-50"
        @click="upload"
      >
        {{ uploading ? 'Subiendo…' : 'Subir documento(s)' }}
      </button>
    </section>

    <section v-if="canOperate" :class="[card, 'mt-4']">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Documentos en la oportunidad</h3>
        <button type="button" class="text-sm text-cyan-600 hover:underline dark:text-cyan-400" @click="loadDocs">Refrescar</button>
      </div>
      <p v-if="loadingDocs" class="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      <p v-else-if="!docs.length" class="text-sm text-slate-500 dark:text-slate-400">No hay documentos.</p>
      <table v-else class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
          <tr>
            <th class="py-2">Nombre</th>
            <th class="py-2">Modificado</th>
            <th class="py-2 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in docs" :key="doc.id" class="border-b border-slate-100 dark:border-slate-800">
            <td class="py-2 text-slate-800 dark:text-slate-200">{{ doc.name }}</td>
            <td class="py-2 text-slate-500 dark:text-slate-400">{{ doc.modified || '—' }}</td>
            <td class="py-2 text-right">
              <button type="button" class="text-sm font-semibold text-red-600 hover:underline dark:text-red-400" @click="remove(doc)">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
