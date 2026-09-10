<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const legacy = computed(() => store.bootstrap?.app.legacy || {
  adminFilesAvailable: false,
  oktaUserSearchAvailable: false,
})

const capabilities = computed(() => [
  {
    title: 'Ejecuciones y logs',
    description: 'Consulta las sesiones propias y, para roles administradores, el conjunto de sesiones disponibles en el almacenamiento de FLOWS.',
    available: true,
    route: '/logs',
    label: 'Abrir logs',
  },
  {
    title: 'Oportunidades MANA',
    description: 'Subida, comprobación y eliminación de documentos en la carpeta SharePoint asociada a una oportunidad.',
    available: true,
    route: '/mana',
    label: 'Abrir MANA',
  },
  {
    title: 'Administrador de archivos',
    description: 'El menú del flujo original referencia un formulario con este nombre, pero el nodo correspondiente no está incluido en la exportación recibida.',
    available: legacy.value.adminFilesAvailable,
    route: '',
    label: 'No disponible',
  },
  {
    title: 'Búsqueda de usuarios Okta',
    description: 'El menú del flujo original referencia esta utilidad, pero su formulario y su lógica no están presentes en la exportación recibida.',
    available: legacy.value.oktaUserSearchAvailable,
    route: '',
    label: 'No disponible',
  },
])
</script>

<template>
  <div class="page-shell space-y-6">
    <header>
      <p class="eyebrow">Administración</p>
      <h1 class="page-title mt-2">Herramientas operativas</h1>
      <p class="page-description">
        Accesos administrativos migrados al nuevo frontend. Las utilidades ausentes en el JSON de origen se muestran explícitamente, sin inventar comportamiento de backend.
      </p>
    </header>

    <section class="grid gap-4 md:grid-cols-2">
      <article
        v-for="item in capabilities"
        :key="item.title"
        class="surface-card-flat flex min-h-56 flex-col p-6"
      >
        <div class="flex items-start justify-between gap-4">
          <span class="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 5h16v14H4zM8 9h8M8 13h5" />
            </svg>
          </span>
          <span
            class="rounded-full px-3 py-1.5 text-xs font-bold"
            :class="item.available
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'"
          >
            {{ item.available ? 'Disponible' : 'Nodo no incluido' }}
          </span>
        </div>

        <h2 class="mt-5 text-lg font-black text-slate-900 dark:text-white">{{ item.title }}</h2>
        <p class="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{{ item.description }}</p>

        <RouterLink
          v-if="item.available && item.route"
          :to="item.route"
          class="btn-secondary mt-5 w-fit no-underline"
        >
          {{ item.label }}
        </RouterLink>
        <span v-else class="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
          Requiere incorporar el nodo original
        </span>
      </article>
    </section>

    <section class="surface-card">
      <p class="eyebrow">Seguridad</p>
      <h2 class="section-title mt-1">Identidad y permisos</h2>
      <p class="mt-3 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        El navegador obtiene la identidad desde <code>/_auth/user</code>. Cada endpoint de FLOWS vuelve a resolver el usuario desde el contexto autenticado de la petición; el frontend no puede elegir ni suplantar la clave de usuario utilizada por las sesiones.
      </p>
    </section>
  </div>
</template>
