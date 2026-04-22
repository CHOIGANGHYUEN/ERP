<template>
  <header class="app-header">
    <div class="logo">
      <!-- Store에서 가져온 시스템 명칭을 동적으로 바인딩합니다. -->
      <h2>{{ sysTitle }}</h2>
    </div>

    <div class="user-info" v-if="user">
      <span class="user-name">{{ user.name || user.email }} 님</span>
      <button class="btn btn-secondary" @click="logout">로그아웃</button>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/frontend/module_sys/SYST05/configStore'

const router = useRouter()
const configStore = useConfigStore()

// DB에서 캐싱된 'SYS_TITLE' 값을 가져오며, 없을 경우 'ERP System'을 기본값으로 사용합니다.
const sysTitle = computed(() => configStore.getConfigValue('SYS_TITLE', 'ERP System'))

const user = ref(null)

const fetchUserProfile = async () => {
  try {
    const res = await fetch('/api/auth/me')
    if (res.ok) {
      const data = await res.json()
      user.value = data.user
      localStorage.setItem('user', JSON.stringify(data.user))
    }
  } catch (error) {
    console.error('Failed to fetch user profile:', error)
  }
}

onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    user.value = JSON.parse(userData)
  } else {
    // localStorage에 정보가 없으면 백엔드에서 세션 정보를 확인합니다.
    fetchUserProfile()
  }
})

const logout = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('user')
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>

<style scoped>
.logo h2 {
  margin: 0;
  color: var(--app-primary-color);
  font-size: 1.5rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-md);
}

.user-name {
  font-weight: 500;
  color: var(--app-text-color);
}
</style>
