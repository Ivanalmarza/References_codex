import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

const DEFAULT_TITLE = 'Codex References Generator'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'entry',
          component: () => import('../views/EntryRouterView.vue'),
          meta: { title: 'Recuperar sesión' },
        },
        {
          path: 'welcome',
          name: 'welcome',
          component: () => import('../views/WelcomeView.vue'),
          meta: { title: 'Welcome' },
        },
        {
          path: 'start',
          name: 'start',
          component: () => import('../views/CodeGeneratorView.vue'),
          meta: { title: 'Iniciar generador' },
        },
        {
          path: 'session',
          name: 'session',
          component: () => import('../views/SessionChoiceView.vue'),
          meta: { title: 'Recuperar sesión' },
        },
        {
          path: 'starting',
          name: 'starting',
          component: () => import('../views/CodexStartingView.vue'),
          meta: { title: 'Iniciando Codex' },
        },
        {
          path: 'progress/:sessionId?',
          name: 'progress',
          component: () => import('../views/ProgressView.vue'),
          meta: { title: 'Progreso de la ejecución' },
        },
        {
          path: 'result/:sessionId?',
          name: 'result',
          component: () => import('../views/ResultView.vue'),
          meta: { title: 'Resultado' },
        },
        {
          path: 'stopped',
          name: 'stopped',
          component: () => import('../views/StoppedView.vue'),
          meta: { title: 'Ejecución detenida' },
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('../views/LogViewerView.vue'),
          meta: { title: 'Log viewer' },
        },
        {
          path: 'admin/opportunities',
          name: 'opportunities',
          component: () => import('../views/OpportunitiesView.vue'),
          meta: { title: 'Oportunidades MANA' },
        },
        {
          path: 'admin/opportunities/check',
          name: 'opportunity-check',
          component: () => import('../views/OpportunityCheckView.vue'),
          meta: { title: 'Resultado comprobación PDF/CSV' },
        },
        {
          path: 'admin/opportunities/delete',
          name: 'opportunity-delete',
          component: () => import('../views/OpportunityDeleteView.vue'),
          meta: { title: 'Eliminar documento' },
        },
        {
          path: 'admin/files',
          name: 'admin-files',
          component: () => import('../views/AdminFilesView.vue'),
          meta: { title: 'Admin files' },
        },
        {
          path: 'admin/users',
          name: 'users',
          component: () => import('../views/UserSearchView.vue'),
          meta: { title: 'User Okta search' },
        },
        {
          path: 'admin/users/:id',
          name: 'user-details',
          component: () => import('../views/UserDetailsView.vue'),
          meta: { title: 'Detalle de usuario' },
        },
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: () => import('../views/NotFoundView.vue'),
          meta: { title: 'Página no encontrada' },
        },
      ],
    },
  ],
})

router.afterEach((to) => {
  void nextTick(() => {
    document.title = String(to.meta.title || DEFAULT_TITLE)
  })
})

export default router
