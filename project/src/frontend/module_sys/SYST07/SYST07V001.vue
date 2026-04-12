<template>
  <div class="app-container">
    <AppPageTitle title="시스템 로그 대시보드 (Logs & Audit)" />

    <!-- 1. 로그 바로가기 퀵메뉴 영역 -->
    <div class="section-header">
      <h3 class="section-title">📡 로그 메뉴 바로가기</h3>
      <p class="section-subtitle">시스템의 보안 및 활동 내역을 추적하는 메뉴입니다.</p>
    </div>

    <AppGrid style="margin-bottom: 40px">
      <div v-for="link in shortcuts" :key="link.path" class="app-grid-item">
        <AppCard class="shortcut-card" @click="goTo(link.path)">
          <div class="shortcut-icon">{{ link.icon }}</div>
          <h4 class="shortcut-name">{{ link.name }}</h4>
          <p class="shortcut-desc">{{ link.desc }}</p>
        </AppCard>
      </div>
    </AppGrid>

    <!-- 2. 로그 누적 통계 영역 -->
    <div class="section-header">
      <h3 class="section-title">📊 로그 누적 통계</h3>
      <p class="section-subtitle">현재 데이터베이스에 저장된 각종 로그의 누적 건수입니다.</p>
    </div>

    <AppGrid>
      <div class="app-grid-item">
        <AppCard class="stat-card">
          <div class="stat-title">총 로그인 시도 이력</div>
          <div class="stat-value">{{ stats.logins }} <span class="stat-unit">건</span></div>
        </AppCard>
      </div>
      <div class="app-grid-item">
        <AppCard class="stat-card">
          <div class="stat-title">테이블 스키마 변경 이력</div>
          <div class="stat-value">{{ stats.tableHistory }} <span class="stat-unit">건</span></div>
        </AppCard>
      </div>
      <div class="app-grid-item">
        <AppCard class="stat-card">
          <div class="stat-title">유저 API 활동 이력</div>
          <div class="stat-value">{{ stats.apiLogs }} <span class="stat-unit">건</span></div>
        </AppCard>
      </div>
    </AppGrid>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppGrid from '@/frontend/common/components/AppGrid.vue'

import { getLoginLogs } from '../api/logLoginUserApi.js'
import { getTableHistoryLogs } from '../api/logTableHistoryApi.js'
import { getUserLogs } from '../api/logUserApi.js'

const router = useRouter()

const stats = ref({
  logins: 0,
  tableHistory: 0,
  apiLogs: 0,
})

const shortcuts = [
  {
    name: '로그인 이력 조회',
    desc: '접속 성공, 실패, 봇 차단 등 접근 제어 모니터링',
    path: '/sys/syst071',
    icon: '🛡️',
  },
  {
    name: '테이블 변경 이력',
    desc: '데이터베이스 컬럼 및 인덱스 변경/삭제 히스토리',
    path: '/sys/syst072',
    icon: '🗃️',
  },
  {
    name: '유저 활동 로그',
    desc: '모든 사용자의 HTTP(API) 요청 상세 로그 추적',
    path: '/sys/syst073',
    icon: '📡',
  },
]

const goTo = (path) => {
  router.push(path)
}

onMounted(async () => {
  try {
    const [loginRes, tableRes, apiRes] = await Promise.all([
      getLoginLogs({ page: 1, size: 1 }),
      getTableHistoryLogs({ page: 1, size: 1 }),
      getUserLogs({ page: 1, size: 1 }),
    ])
    stats.value.logins = loginRes.total || 0
    stats.value.tableHistory = tableRes.total || 0
    stats.value.apiLogs = apiRes.total || 0
  } catch (e) {
    console.error('Failed to load log stats', e)
  }
})
</script>

<style scoped>
.section-header {
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--app-border-color);
}
.section-title {
  margin: 0 0 4px 0;
  color: var(--app-text-color);
  font-size: 1.25rem;
}
.section-subtitle {
  margin: 0;
  color: var(--app-secondary-color);
  font-size: 0.9rem;
}

/* Shortcut Cards */
.shortcut-card {
  cursor: pointer;
  text-align: center;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.shortcut-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--app-shadow-md);
  border-color: var(--app-primary-color);
}
.shortcut-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}
.shortcut-name {
  margin: 0 0 8px 0;
  color: var(--app-text-color);
  font-size: 1.1rem;
}
.shortcut-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--app-secondary-color);
  line-height: 1.4;
  word-break: keep-all;
}

/* Stats Cards */
.stat-card {
  text-align: center;
  padding: 24px 16px;
}
.stat-title {
  font-size: 0.95rem;
  color: var(--app-secondary-color);
  margin-bottom: 8px;
  font-weight: 600;
}
.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--app-primary-color);
}
.stat-unit {
  font-size: 1rem;
  color: var(--app-text-color);
  font-weight: 500;
  margin-left: 4px;
}
</style>
