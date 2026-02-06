import { createRouter, createWebHistory } from 'vue-router'
import ChatApp from './components/ChatApp.vue'

const routes = [
  {
    path: '/',
    name: 'chat',
    component: ChatApp,
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('./views/Dashboard.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
