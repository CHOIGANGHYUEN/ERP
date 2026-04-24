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
    // credentials: 'include'를 명시하여 쿠키를 서버로 전송합니다.
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      if (data.user) {
        user.value = data.user
        localStorage.setItem('user', JSON.stringify(data.user))
        console.log('[AppHeader] 유저 정보 로드 성공:', data.user.name)
      }
    } else {
      // 401 Unauthorized 등이 발생하면 로컬 스토리지 비우기
      user.value = null
      localStorage.removeItem('user')
    }
  } catch (error) {
    console.error('[AppHeader] 유저 정보 로드 실패:', error)
  }
}

onMounted(() => {
  // 리다이렉트 후에는 서버 세션이 확실하므로 항상 정보를 한 번 더 확인합니다.
  fetchUserProfile()
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
