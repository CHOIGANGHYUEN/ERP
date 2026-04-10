import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '@/frontend/common/layouts/DefaultLayout.vue'
import AuthLayout from '@/frontend/common/layouts/AuthLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      component: AuthLayout,
      children: [
        {
          path: '',
          name: 'login',
          component: () => import('@/frontend/views/LoginView.vue'),
        },
      ],
    },
    {
      path: '/',
      component: DefaultLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/frontend/views/HomeView.vue'),
        },
        {
          path: 'sys',
          name: 'sys',
          component: () => import('@/frontend/module_sys/SYST00/SYST00V001.vue'),
        },
        {
          path: 'sys/users',
          name: 'sys-users',
          component: () => import('@/frontend/module_sys/SYST01/SYST01V001.vue'),
        },
        {
          path: 'sys/roles',
          name: 'sys-roles',
          component: () => import('@/frontend/module_sys/SYST02/SYST02V001.vue'),
        },
        {
          path: 'sys/roles/:id',
          name: 'sys-role-detail',
          component: () => import('@/frontend/module_sys/SYST02/SYST02V002.vue'),
        },
        {
          path: 'sys/menus',
          name: 'sys-menus',
          component: () => import('@/frontend/module_sys/SYST03/SYST03V001.vue'),
        },
        {
          path: 'sys/menus/:id',
          name: 'sys-menu-detail',
          component: () => import('@/frontend/module_sys/SYST03/SYST03V002.vue'),
        },
        {
          path: 'sys/codes',
          name: 'sys-codes',
          component: () => import('@/frontend/module_sys/SYST04/SYST04V001.vue'),
        },
        {
          path: 'sys/settings',
          name: 'sys-settings',
          component: () => import('@/frontend/module_sys/SYST05/SYST05V001.vue'),
        },
        {
          path: 'sys/settings/:id',
          name: 'sys-setting-detail',
          component: () => import('@/frontend/module_sys/SYST05/SYST05V002.vue'),
        },
        {
          path: 'sys/tables',
          name: 'sys-tables',
          component: () => import('@/frontend/module_sys/SYST06/SYST06V001.vue'),
        },
        {
          path: 'sys/tables/:tablen',
          name: 'sys-table-detail',
          component: () => import('@/frontend/module_sys/SYST06/SYST06V002.vue'),
        },
        // Future routes like /fi, /hr will go here
      ],
    },
  ],
})

// Basic authentication guard
router.beforeEach((to, from) => {
  const isAuthenticated = !!localStorage.getItem('user') // Check local storage for user info
  if (to.meta.requiresAuth && !isAuthenticated) {
    return '/login'
  } else if (to.path === '/login' && isAuthenticated) {
    return '/'
  }
  return true
})

export default router
