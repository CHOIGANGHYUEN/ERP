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
        callback: handleCredentialResponse,
      })
      window.google.accounts.id.renderButton(document.getElementById('google-login-btn'), {
        theme: 'outline',
        size: 'large',
        width: '100%',
      })
    }
  }, 100)
})

const handleCredentialResponse = async (response) => {
  try {
    // 토큰을 Base64로 인코딩하여 백엔드로 전송 (향후 AES 등으로 확장 가능)
    const encryptedCredential = btoa(response.credential)

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential: encryptedCredential }),
    })
    const data = await res.json()
    if (res.ok) {
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/')
    } else {
      alert('Login failed: ' + data.message)
    }
  } catch (err) {
    console.error('Login error:', err)
    alert('An error occurred during login.')
  }
}
</script>
