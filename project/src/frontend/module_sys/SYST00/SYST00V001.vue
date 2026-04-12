<template>
  <div class="app-container">
    <AppPageTitle title="시스템 대시보드 (System Overview)" />

    <!-- 1. 바로가기 퀵메뉴 영역 -->
    <div class="section-header">
      <h3 class="section-title">🚀 시스템 바로가기</h3>
      <p class="section-subtitle">시스템 관리에 필요한 주요 메뉴로 빠르게 이동하세요.</p>
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

    <!-- 2. 시스템 주요 통계 영역 -->
    <div class="section-header">
      <h3 class="section-title">📊 시스템 등록 통계</h3>
      <p class="section-subtitle">현재 시스템에 등록된 핵심 마스터 데이터 현황입니다.</p>
    </div>

    <AppGrid>
      <div class="app-grid-item">
        <AppCard class="stat-card">
          <div class="stat-title">등록된 사용자</div>
          <div class="stat-value">{{ stats.users }} <span class="stat-unit">명</span></div>
        </AppCard>
      </div>
      <div class="app-grid-item">
        <AppCard class="stat-card">
          <div class="stat-title">부여된 역할(Role)</div>
          <div class="stat-value">{{ stats.roles }} <span class="stat-unit">개</span></div>
        </AppCard>
      </div>
      <div class="app-grid-item">
        <AppCard class="stat-card">
          <div class="stat-title">활성화 메뉴</div>
          <div class="stat-value">{{ stats.menus }} <span class="stat-unit">개</span></div>
        </AppCard>
      </div>
      <div class="app-grid-item">
        <AppCard class="stat-card">
          <div class="stat-title">DB 테이블 명세</div>
          <div class="stat-value">{{ stats.tables }} <span class="stat-unit">개</span></div>
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

import { getUsers } from '../api/userApi.js'
import { getRoles } from '../api/roleApi.js'
import { getMenus } from '../api/menuApi.js'
import { getTableList } from '../api/tableSpecApi.js'

const router = useRouter()

const stats = ref({
  users: 0,
  roles: 0,
  menus: 0,
  tables: 0,
})

const shortcuts = [
  { name: '사용자 관리', desc: '시스템 접속 계정 조회 및 생성', path: '/sys/syst01', icon: '👤' },
  { name: '권한 관리', desc: '역할(Role) 부여 및 권한 할당', path: '/sys/syst02', icon: '🔑' },
  { name: '메뉴 관리', desc: '메뉴 계층 구조 추가/수정', path: '/sys/syst03', icon: '📁' },
  { name: '공통 코드 관리', desc: '시스템 전역 드롭다운 코드', path: '/sys/syst04', icon: '📝' },
  { name: '시스템 설정', desc: '테마, 보안 등 환경 변수 제어', path: '/sys/syst05', icon: '⚙️' },
  { name: '테이블 명세서', desc: '데이터베이스 스키마 설계', path: '/sys/syst06', icon: '🗄️' },
  { name: '시스템 로그', desc: '모든 로그/감사 이력 대시보드', path: '/sys/syst07', icon: '📡' },
]

const goTo = (path) => {
  router.push(path)
}

onMounted(async () => {
  try {
    const [userRes, roleRes, menuRes, tableRes] = await Promise.all([
      getUsers({ page: 1, size: 1 }),
      getRoles({ page: 1, limit: 1 }),
      getMenus({ page: 1, limit: 1 }),
      getTableList({ page: 1, size: 1 }),
    ])
    stats.value.users = userRes.total || 0
    stats.value.roles = roleRes.total || 0
    stats.value.menus = menuRes.total || 0
    stats.value.tables = tableRes.total || 0
  } catch (e) {
    console.error('Failed to load system stats', e)
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
