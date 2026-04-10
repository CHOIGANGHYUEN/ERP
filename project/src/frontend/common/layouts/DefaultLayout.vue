<template>
  <div class="app-container">
    <AppHeader>
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
        <h2 style="margin: 0; color: var(--app-primary-color)">ERP System</h2>
        <div class="user-profile" style="display: flex; align-items: center; gap: 16px">
          <span>Welcome, {{ userName }}</span>
          <AppButton
            type="secondary"
            @click="handleLogout"
            style="padding: 4px 8px; font-size: 14px"
            >Logout</AppButton
          >
        </div>
      </div>
    </AppHeader>
    <div class="app-body">
      <AppSidebar />
      <main class="app-content">
        <router-view></router-view>
      </main>
    </div>
    <AppFooter>
      <p style="margin: 0; color: var(--app-secondary-color); font-size: 0.875rem">
        &copy; 2026 ERP System Project
      </p>
    </AppFooter>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'
import AppButton from '../components/AppButton.vue'
import AppSidebar from '../components/AppSidebar.vue'

const router = useRouter()
const userName = ref('User')

onMounted(() => {
  const user = JSON.parse(localStorage.getItem('user'))
  if (user && user.name) {
    userName.value = user.name
  }
})

const handleLogout = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('user')
    router.push('/login')
  } catch (error) {
    console.error('Logout failed', error)
  }
}
</script>

<style scoped></style>
