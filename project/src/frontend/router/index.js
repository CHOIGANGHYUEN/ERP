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
          redirect: '/sys/syst00',
        },
        {
          path: 'sys/syst00',
          name: 'sys-syst00',
          component: () => import('@/frontend/module_sys/SYST00/SYST00V001.vue'),
        },
        {
          path: 'sys/syst01',
          name: 'sys-syst01',
          component: () => import('@/frontend/module_sys/SYST01/SYST01V001.vue'),
        },
        {
          path: 'sys/syst01/:id',
          name: 'sys-syst01-detail',
          component: () => import('@/frontend/module_sys/SYST01/SYST01V002.vue'),
        },
        {
          path: 'sys/syst02',
          name: 'sys-syst02',
          component: () => import('@/frontend/module_sys/SYST02/SYST02V001.vue'),
        },
        {
          path: 'sys/syst02/:id',
          name: 'sys-syst02-detail',
          component: () => import('@/frontend/module_sys/SYST02/SYST02V002.vue'),
        },
        {
          path: 'sys/syst03',
          name: 'sys-syst03',
          component: () => import('@/frontend/module_sys/SYST03/SYST03V001.vue'),
        },
        {
          path: 'sys/syst03/:id',
          name: 'sys-syst03-detail',
          component: () => import('@/frontend/module_sys/SYST03/SYST03V002.vue'),
        },
        {
          path: 'sys/syst04',
          name: 'sys-syst04',
          component: () => import('@/frontend/module_sys/SYST04/SYST04V001.vue'),
        },
        {
          path: 'sys/syst04/:id',
          name: 'sys-syst04-detail',
          component: () => import('@/frontend/module_sys/SYST04/SYST04V002.vue'),
        },
        {
          path: 'sys/syst05',
          name: 'sys-syst05',
          component: () => import('@/frontend/module_sys/SYST05/SYST05V001.vue'),
        },
        {
          path: 'sys/syst05/:id',
          name: 'sys-syst05-detail',
          component: () => import('@/frontend/module_sys/SYST05/SYST05V002.vue'),
        },
        {
          path: 'sys/syst05/:id/delete',
          name: 'sys-syst05-delete',
          component: () => import('@/frontend/module_sys/SYST05/SYST05V003.vue'),
        },
        {
          path: 'sys/syst06',
          name: 'sys-syst06',
          component: () => import('@/frontend/module_sys/SYST06/SYST06V001.vue'),
        },
        {
          path: 'sys/syst06/:tablen',
          name: 'sys-syst06-detail',
          component: () => import('@/frontend/module_sys/SYST06/SYST06V002.vue'),
        },
        {
          path: 'sys/syst07',
          name: 'sys-syst07',
          component: () => import('@/frontend/module_sys/SYST07/SYST07V001.vue'),
        },
        {
          path: 'sys/syst071',
          name: 'sys-syst071',
          component: () => import('@/frontend/module_sys/SYST071/SYST071V001.vue'),
        },
        {
          path: 'sys/syst072',
          name: 'sys-syst072',
          component: () => import('@/frontend/module_sys/SYST072/SYST072V001.vue'),
        },
        {
          path: 'sys/syst073',
          name: 'sys-syst073',
          component: () => import('@/frontend/module_sys/SYST073/SYST073V001.vue'),
        },
        {
          path: 'sys/syst08',
          name: 'sys-syst08',
          component: () => import('@/frontend/module_sys/SYST08/SYST08V001.vue'),
        },
        {
          path: 'sys/syst08/:id',
          name: 'sys-syst08-detail',
          component: () => import('@/frontend/module_sys/SYST08/SYST08V002.vue'),
        },
        {
          path: 'sys/syst09',
          name: 'sys-syst09',
          component: () => import('@/frontend/module_sys/SYST09/SYST09V001.vue'),
        },
        {
          path: 'sys/syst09/:id',
          name: 'sys-syst09-detail',
          component: () => import('@/frontend/module_sys/SYST09/SYST09V002.vue'),
        },
        // Future routes like /fi, /hr will go here
      ],
    },
  ],
})

// Basic authentication guard
router.beforeEach((to, from) => {
  // URL 경로에서 메뉴 ID(예: SYST01)를 추출하여 로컬 스토리지에 저장 (API 요청 시 사용)
  const menuMatch = to.path.match(/\/sys\/(syst\d+)/i)
  if (menuMatch) {
    localStorage.setItem('currentMenuId', menuMatch[1].toUpperCase())
  } else {
    localStorage.removeItem('currentMenuId')
  }

  const isAuthenticated = !!localStorage.getItem('user') // Check local storage for user info
  if (to.meta.requiresAuth && !isAuthenticated) {
    return '/login'
  } else if (to.path === '/login' && isAuthenticated) {
    return '/'
  }
  return true
})

export default router
