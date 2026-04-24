<template>
  <AppCard style="width: 400px; text-align: center; margin: 0 auto">
    <h2 style="color: var(--app-primary-color); margin-bottom: 8px">ERP System</h2>
    <p style="margin-bottom: 32px; color: var(--app-secondary-color)">
      Sign in to access your dashboard.
    </p>

    <div
      id="google-login-btn"
      style="display: flex; justify-content: center; min-height: 40px"
    ></div>
  </AppCard>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppCard from '@/frontend/common/components/AppCard.vue'

const router = useRouter()

let checkGoogleLoaded = null

onMounted(() => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    console.error('Google Client ID is missing.')
    return
  }

  // 중복 초기화 방지를 위해 전역 플래그를 확인합니다.
  if (window._googleInitialized) {
    renderGoogleButton()
    return
  }

  // Google SDK가 비동기로 로드되므로, window.google 객체가 생성될 때까지 폴링합니다.
  checkGoogleLoaded = setInterval(() => {
    if (window.google) {
      clearInterval(checkGoogleLoaded)
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'redirect',
        login_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI,
      })
      window._googleInitialized = true
      renderGoogleButton()
    }
  }, 100)
})

const renderGoogleButton = () => {
  if (window.google && document.getElementById('google-login-btn')) {
    window.google.accounts.id.renderButton(document.getElementById('google-login-btn'), {
      theme: 'outline',
      size: 'large',
      width: 360,
    })
  }
}

onUnmounted(() => {
  if (checkGoogleLoaded) clearInterval(checkGoogleLoaded)
})
</script>
