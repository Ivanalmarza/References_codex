<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { createUser, getUser, updateUser, deleteUser, getRoles } from '../services/users'
import type { Option } from '../services/types'
import { notify } from '../services/notyf'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id || ''))
const isNew = computed(() => id.value === 'new' || !id.value)

const loading = ref(true)
const saving = ref(false)
const roleOptions = ref<Option[]>([])

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  login: '',
  status: 'ACTIVE',
  roles: [] as string[],
})

onMounted(async () => {
  try {
    roleOptions.value = await getRoles()
    if (!isNew.value) {
      const user = await getUser(id.value)
      form.firstName = user.firstName ?? ''
      form.lastName = user.lastName ?? ''
      form.email = user.email ?? ''
      form.login = user.login ?? ''
      form.status = user.status ?? 'ACTIVE'
      form.roles = Array.isArray(user.roles) ? user.roles : []
    }
  } catch {
    notify.error('No se pudo cargar el usuario')
  } finally {
    loading.value = false
  }
})

function toggleRole(value: string) {
  const idx = form.roles.indexOf(value)
  if (idx >= 0) form.roles.splice(idx, 1)
  else form.roles.push(value)
}

async function save() {
  saving.value = true
  try {
    if (isNew.value) await createUser({ ...form })
    else await updateUser(id.value, { ...form })
    notify.success('Usuario guardado')
    router.push({ name: 'users' })
  } catch {
    notify.error('No se pudo guardar el usuario')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (isNew.value) return
  if (!window.confirm('¿Eliminar este usuario?')) return
  try {
    await deleteUser(id.value)
    notify.success('Usuario eliminado')
    router.push({ name: 'users' })
  } catch {
    notify.error('No se pudo eliminar el usuario')
  }
}

const control =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const label = 'block text-sm font-medium text-slate-700 dark:text-slate-200'
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Okta"
      :title="isNew ? 'Nuevo usuario' : 'Editar usuario'"
      description="Datos del usuario y roles asignados."
    />

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">Cargando…</div>

    <form v-else class="max-w-2xl space-y-6" @submit.prevent="save">
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label :class="label">Nombre</label>
            <input v-model="form.firstName" type="text" :class="control" />
          </div>
          <div>
            <label :class="label">Apellidos</label>
            <input v-model="form.lastName" type="text" :class="control" />
          </div>
          <div>
            <label :class="label">Email</label>
            <input v-model="form.email" type="email" required :class="control" />
          </div>
          <div>
            <label :class="label">Login</label>
            <input v-model="form.login" type="text" :class="control" />
          </div>
          <div>
            <label :class="label">Estado</label>
            <select v-model="form.status" :class="control">
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DEPROVISIONED">DEPROVISIONED</option>
            </select>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Roles</h3>
        <p v-if="!roleOptions.length" class="mt-2 text-sm text-slate-500 dark:text-slate-400">No hay roles disponibles.</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <label
            v-for="role in roleOptions"
            :key="role.value"
            class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
            :class="form.roles.includes(role.value)
              ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300'
              : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'"
          >
            <input type="checkbox" class="h-4 w-4 accent-cyan-500" :checked="form.roles.includes(role.value)" @change="toggleRole(role.value)" />
            {{ role.label }}
          </label>
        </div>
      </section>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-xl bg-gradient-to-br from-[#0b2f55] to-[#1e6fd1] px-6 py-2.5 font-extrabold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="router.push({ name: 'users' })"
        >
          Cancelar
        </button>
        <button
          v-if="!isNew"
          type="button"
          class="ml-auto rounded-xl border border-red-300 px-5 py-2.5 font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
          @click="remove"
        >
          Eliminar
        </button>
      </div>
    </form>
  </div>
</template>
