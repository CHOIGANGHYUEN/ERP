<script setup>
import { onMounted, watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useConfigStore } from '@/frontend/module_sys/SYST05/configStore'

const configStore = useConfigStore()

onMounted(async () => {
  await configStore.fetchConfigs()
})

// 전역 설정값(테마, 폰트, 타이틀 등)을 감지하여 실시간으로 브라우저(DOM)에 적용합니다.
watchEffect(() => {
  if (configStore.isLoaded) {
    // 1. 브라우저 탭 타이틀 변경 (SYS_TITLE)
    document.title = configStore.getConfigValue('SYS_TITLE', 'ERP System')

    // 2. 기본 폰트 크기 변경 (THEME_FONT_SIZE)
    const fontSize = configStore.getConfigValue('THEME_FONT_SIZE', '15px')
    document.documentElement.style.setProperty('--app-font-size-base', fontSize)

    // 3. 기본 포인트 색상 변경 (THEME_COLOR)
    const themeColor = configStore.getConfigValue('THEME_COLOR', 'blue')
    const colorMap = {
      blue: '#007bff',
      green: '#10b981',
      red: '#ef4444',
      purple: '#8b5cf6',
      dark: '#334155',
    }
    if (colorMap[themeColor]) {
      document.documentElement.style.setProperty('--app-primary-color', colorMap[themeColor])
    }

    // 4. 다크 모드 클래스 토글 (THEME_MODE)
    if (configStore.getConfigValue('THEME_MODE', 'light') === 'dark') {
      document.body.classList.add('theme-dark')
    } else {
      document.body.classList.remove('theme-dark')
    }
  }
})
</script>

<template>
  <RouterView />
</template>

<style>
/* Global styles are handled by common/main.css */
</style>
