import { createRouter, createWebHistory } from 'vue-router'
import ChatApp from './components/ChatApp.vue'
import { isAuthenticated } from './utils/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('./views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/confirm',
    name: 'confirm',
    component: () => import('./views/Confirm.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'chat',
    component: ChatApp,
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('./views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard to check authentication
router.beforeEach((to, _from, next) => {
  const requiresAuth = to.meta.requiresAuth !== false // Default to true

  if (requiresAuth && !isAuthenticated()) {
    // Redirect to login if not authenticated
    next({ name: 'login' })
  } else if (to.name === 'login' && isAuthenticated()) {
    // Redirect to chat if already authenticated and trying to access login
    next({ name: 'chat' })
  } else {
    next()
  }
})
