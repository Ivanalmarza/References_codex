<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { searchUsers, deleteUser, type OktaUser } from '../services/users'
import { notify } from '../services/notyf'

const router = useRouter()
const q = ref('')
const users = ref<OktaUser[]>([])
const loading = ref(false)

async function search() {
  loading.value = true
  try {
    users.value = await searchUsers(q.value || undefined)
  } finally {
    loading.value = false
  }
}

function fullName(user: OktaUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.login || user.email || user.id
}

async function remove(user: OktaUser) {
  if (!window.confirm(`¿Eliminar al usuario ${fullName(user)}?`)) return
  try {
    await deleteUser(user.id)
    notify.success('Usuario eliminado')
    await search()
  } catch {
    notify.error('No se pudo eliminar el usuario')
  }
}

onMounted(search)
</script>

<template>
  <div>
    <PageHeader eyebrow="Okta" title="User Okta search" description="Busca, edita o elimina usuarios de Okta.">
      <template #actions>
        <button
          type="button"
          class="rounded-lg bg-gradient-to-br from-[#0b2f55] to-[#1e6fd1] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-95"
          @click="router.push({ name: 'user-details', params: { id: 'new' } })"
        >
          Nuevo usuario
        </button>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-wrap gap-3">
      <input
        v-model="q"
        type="text"
        placeholder="Buscar por nombre, login o email"
        class="w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        @keyup.enter="search"
      />
      <button
        type="button"
        class="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400"
        @click="search"
      >
        {{ loading ? 'Buscando…' : 'Buscar' }}
      </button>
    </div>

    <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
          <tr>
            <th class="px-4 py-2">Usuario</th>
            <th class="px-4 py-2">Email</th>
            <th class="px-4 py-2">Estado</th>
            <th class="px-4 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!users.length">
            <td colspan="4" class="px-4 py-6 text-center text-slate-500 dark:text-slate-400">Sin usuarios.</td>
          </tr>
          <tr v-for="user in users" :key="user.id" class="border-b border-slate-100 dark:border-slate-800">
            <td class="px-4 py-2 text-slate-800 dark:text-slate-200">{{ fullName(user) }}</td>
            <td class="px-4 py-2 text-slate-500 dark:text-slate-400">{{ user.email || '—' }}</td>
            <td class="px-4 py-2">
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {{ user.status || '—' }}
              </span>
            </td>
            <td class="px-4 py-2 text-right">
              <button type="button" class="mr-3 text-sm font-semibold text-cyan-600 hover:underline dark:text-cyan-400" @click="router.push({ name: 'user-details', params: { id: user.id } })">
                Editar
              </button>
              <button type="button" class="text-sm font-semibold text-red-600 hover:underline dark:text-red-400" @click="remove(user)">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
