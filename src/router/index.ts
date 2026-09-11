import { nextTick } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { getInjectedUser } from '../services/referenceApi'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Inicio' } },
    { path: '/new', name: 'new-execution', component: () => import('../views/NewExecutionView.vue'), meta: { title: 'Nueva referencia' } },
    { path: '/execution/:sessionId', name: 'execution', component: () => import('../views/ExecutionView.vue'), meta: { title: 'Ejecución' } },
    { path: '/results/:sessionId', name: 'results', component: () => import('../views/ResultsView.vue'), meta: { title: 'Resultados' } },
    { path: '/logs', name: 'logs', component: () => import('../views/LogsView.vue'), meta: { title: 'Ejecuciones y logs', adminOnly: true } },
    { path: '/mana', name: 'mana', component: () => import('../views/ManaView.vue'), meta: { title: 'Oportunidades MANA', adminOnly: true } },
    { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { title: 'Administración', adminOnly: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Página no encontrada' } },
  ],
})

function hasAdminRole(): boolean {
  const roles = getInjectedUser()?.roles || []
  return roles.some((role) =>
    /(^|_)SUPER_ADMIN$|(^|_)ADMIN$/i.test(String(role)),
  )
}

router.beforeEach((to) => {
  if (to.meta.adminOnly === true && !hasAdminRole()) {
    return { name: 'dashboard' }
  }
  return true
})

router.afterEach((to) => {
  void nextTick(() => {
    document.title = `${String(to.meta.title || 'References Generator')} | NTT DATA`
  })
})

export default router
