<template>
  <div class="app-container">
    <AppPageTitle title="ERP Home" />

    <AppGrid>
      <!-- Hero / Welcome Banner -->
      <div class="app-grid-item" style="grid-column: 1 / -1">
        <div class="hero-banner">
          <div class="hero-content">
            <h1 class="hero-title">환영합니다, {{ userName }}님!</h1>
            <p class="hero-subtitle">
              <strong>{{ sysCompany }}</strong
              >의 <strong>{{ sysTitle }}</strong
              >에 오신 것을 환영합니다. 원하시는 모듈을 선택하여 업무를 시작하세요.
            </p>
          </div>
          <div class="hero-action">
            <AppButton type="secondary" @click="goToSettings">내 정보 / 시스템 설정</AppButton>
          </div>
        </div>
      </div>

      <div class="app-grid-item" style="grid-column: 1 / -1; margin-top: 16px">
        <h3 style="color: var(--app-text-color); margin-bottom: 16px">
          🗂️ 사용 가능한 모듈 (Active Modules)
        </h3>
      </div>

      <!-- Active Modules Quick Links -->
      <template v-for="mod in activeModules" :key="mod.id">
        <div class="app-grid-item">
          <AppCard class="module-card" @click="router.push(mod.path)">
            <div class="module-icon">{{ mod.icon }}</div>
            <div class="module-info">
              <h3 class="module-name">{{ mod.name }}</h3>
              <p class="module-desc">{{ mod.desc }}</p>
            </div>
          </AppCard>
        </div>
      </template>

      <div v-if="activeModules.length === 0" class="app-grid-item" style="grid-column: 1 / -1">
        <AppCard class="empty-state"
          >활성화된 모듈이 없습니다. 시스템 설정(MOD_*)을 확인해주세요.</AppCard
        >
      </div>
    </AppGrid>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppGrid from '@/frontend/common/components/AppGrid.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import { useConfigStore } from '@/frontend/module_sys/SYST05/configStore'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'

const router = useRouter()
const configStore = useConfigStore()
const user = ref(null)

onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    user.value = JSON.parse(userData)
  }
})

const userName = computed(() => {
  if (!user.value) return '관리자'
  return user.value.name || user.value.userId || '관리자'
})

const sysCompany = computed(() => configStore.getConfigValue('SYS_COMPANY', '운영 회사명'))
const sysTitle = computed(() => configStore.getConfigValue('SYS_TITLE', 'ERP System'))

const activeModules = computed(() => {
  const modules = []
  if (configStore.getConfigValue('MOD_SYS', 'Y') === 'Y') {
    modules.push({
      id: 'SYS',
      name: '시스템 관리 (SYS)',
      desc: '사용자, 권한, 공통코드, 명세서 설정',
      path: '/sys/syst00',
      icon: '⚙️',
    })
  }
  if (configStore.getConfigValue('MOD_FI', 'Y') === 'Y') {
    modules.push({
      id: 'FI',
      name: '재무/회계 (FI)',
      desc: '전표, 계정과목, 장부 관리',
      path: '/fi',
      icon: '📈',
    })
  }
  if (configStore.getConfigValue('MOD_HR', 'Y') === 'Y') {
    modules.push({
      id: 'HR',
      name: '인사/급여 (HR)',
      desc: '사원 정보, 조직도, 급여 계산',
      path: '/hr',
      icon: '👥',
    })
  }
  return modules
})

const goToSettings = () => {
  router.push('/sys/syst05')
}
</script>

<style scoped>
.hero-banner {
  background: linear-gradient(135deg, var(--app-primary-color), #3b82f6);
  border-radius: var(--app-border-radius);
  padding: 32px 40px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--app-shadow-md);
  animation: fadeInUp 0.5s ease-out backwards;
}
.hero-title {
  margin: 0 0 12px 0;
  font-size: 2rem;
  font-weight: 700;
}
.hero-subtitle {
  margin: 0;
  font-size: 1.05rem;
  opacity: 0.9;
  line-height: 1.5;
}
.hero-action .btn {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: transparent;
  color: white;
}
.hero-action .btn:hover {
  background-color: white;
  color: var(--app-primary-color);
}

.module-card {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  height: 100%;
  padding: 24px;
}
.module-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--app-shadow-lg);
  border-color: var(--app-primary-color);
}
.module-icon {
  font-size: 2.5rem;
}
.module-info {
  flex: 1;
}
.module-name {
  margin: 0 0 8px 0;
  color: var(--app-text-color);
  font-size: 1.15rem;
}
.module-desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--app-secondary-color);
  line-height: 1.4;
  word-break: keep-all;
}

@media (max-width: 768px) {
  .hero-banner {
    flex-direction: column;
    text-align: center;
    gap: 24px;
    padding: 24px;
  }
}
</style>
