import { createRouter, createWebHashHistory } from 'vue-router'
import { state, loadSession } from './lib/store.js'
import Login from './views/Login.vue'
import Overview from './views/Overview.vue'
import FixedBills from './views/FixedBills.vue'
import Individual from './views/Individual.vue'
import Settlement from './views/Settlement.vue'
import Help from './views/Help.vue'

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
  routes: [
    { path: '/login', component: Login, meta: { public: true } },
    { path: '/', component: Overview },
    { path: '/fixos', component: FixedBills },
    { path: '/individual', component: Individual },
    { path: '/acerto', component: Settlement },
    { path: '/ajuda', component: Help },
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
