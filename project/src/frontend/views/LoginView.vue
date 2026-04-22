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
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppCard from '@/frontend/common/components/AppCard.vue'

const router = useRouter()

onMounted(() => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    console.error('Google Client ID is missing.')
    return
  }

  // Google SDK가 비동기로 로드되므로, window.google 객체가 생성될 때까지 폴링(기다림)합니다.
  const checkGoogleLoaded = setInterval(() => {
    if (window.google) {
      clearInterval(checkGoogleLoaded)
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'redirect', // 핵심: 팝업 대신 리다이렉트 사용
        login_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI, // .env에서 로드
      })
      window.google.accounts.id.renderButton(document.getElementById('google-login-btn'), {
        theme: 'outline',
        size: 'large',
        width: 360,
      })
    }
  }, 100)
})
</script>
