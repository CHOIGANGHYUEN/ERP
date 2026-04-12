<template>
  <div class="app-container">
    <AppPageTitle title="로그인 이력 조회 (Login History)" />

    <AppCard style="margin-bottom: 16px">
      <div class="app-grid">
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px; font-weight: 600">사용자 ID</label>
          <AppInput
            v-model="searchQuery.userId"
            placeholder="예: user@example.com"
            @keyup.enter="fetchLogs"
          />
        </div>
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px; font-weight: 600">로그인 일자</label>
          <AppInput type="date" v-model="searchQuery.loginDt" @keyup.enter="fetchLogs" />
        </div>
        <div class="app-grid-item" style="display: flex; align-items: flex-end">
          <AppButton type="primary" @click="fetchLogs">검색</AppButton>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <AppTable :columns="tableColumns" :data="logs">
        <template #loginAt="{ value }">
          {{ value ? new Date(value).toLocaleString() : '' }}
        </template>
        <template #logged="{ value }">
          <span :class="getLogBadgeClass(value)">{{ value }}</span>
        </template>
      </AppTable>
      <AppPagination
        v-if="totalItems > 0"
        :current-page="currentPage"
        :total-items="totalItems"
        :items-per-page="limit"
        @page-change="onPageChange"
      />
    </AppCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import AppTable from '@/frontend/common/components/AppTable.vue'
import AppPagination from '@/frontend/common/components/AppPagination.vue'
import { getLoginLogs } from '../api/logLoginUserApi.js'

const logs = ref([])
const currentPage = ref(1)
const totalItems = ref(0)
const limit = ref(20)

const searchQuery = ref({
  userId: '',
  loginDt: '',
})

const tableColumns = [
  { key: 'id', label: '번호' },
  { key: 'loginDt', label: '로그인 일자' },
  { key: 'userId', label: '사용자 ID' },
  { key: 'loginAt', label: '시도 일시' },
  { key: 'logged', label: '로그 상태' },
]

const fetchLogs = async () => {
  try {
    const params = {
      page: currentPage.value,
      size: limit.value,
      ...searchQuery.value,
    }
    const data = await getLoginLogs(params)
    logs.value = data.data || []
    totalItems.value = data.total || 0
  } catch (error) {
    console.error('Error fetching login logs:', error)
  }
}

const onPageChange = (page) => {
  currentPage.value = page
  fetchLogs()
}

const getLogBadgeClass = (status) => {
  if (status && status.includes('SUCCESS')) return 'badge-success'
  if (status && status.includes('FAIL')) return 'badge-danger'
  if (status && status.includes('BLOCKED')) return 'badge-warning'
  return ''
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.badge-success {
  color: var(--app-success-color, #10b981);
  font-weight: 600;
}
.badge-danger {
  color: var(--app-danger-color, #ef4444);
  font-weight: 600;
}
.badge-warning {
  color: #f59e0b;
  font-weight: 600;
}
</style>
