import { createRouter, createWebHashHistory } from 'vue-router'
import { state, loadSession } from './lib/store.js'

// Each screen is its own chunk, loaded on first visit.
const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
  routes: [
    { path: '/login', component: () => import('./views/Login.vue'), meta: { public: true } },
    { path: '/', component: () => import('./views/Overview.vue') },
    { path: '/fixos', component: () => import('./views/FixedBills.vue') },
    { path: '/individual', component: () => import('./views/Individual.vue') },
    { path: '/acerto', component: () => import('./views/Settlement.vue') },
    { path: '/ajuda', component: () => import('./views/Help.vue') },
    { path: '/feedback', component: () => import('./views/Feedback.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  await loadSession()
  const loggedIn = state.session && state.household
  if (!to.meta.public && !loggedIn) return '/login'
  if (to.path === '/login' && loggedIn) return '/'
})

export default router
