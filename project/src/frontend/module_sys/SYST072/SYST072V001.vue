<template>
  <div class="app-container">
    <AppPageTitle title="테이블 변경 이력 (Table History Logs)" />

    <AppCard style="margin-bottom: 16px">
      <div class="app-grid">
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px; font-weight: 600">테이블 물리명</label>
          <AppInput
            v-model="searchQuery.tablen"
            placeholder="예: sysUser"
            @keyup.enter="fetchLogs"
          />
        </div>
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px; font-weight: 600">작업 유형</label>
          <select v-model="searchQuery.actionType" class="app-input">
            <option value="">전체 (ALL)</option>
            <option value="INSERT">생성 (INSERT)</option>
            <option value="UPDATE">수정 (UPDATE)</option>
            <option value="DELETE">삭제 (DELETE)</option>
          </select>
        </div>
        <div class="app-grid-item" style="display: flex; align-items: flex-end">
          <AppButton type="primary" @click="fetchLogs">검색</AppButton>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <AppTable :columns="tableColumns" :data="logs">
        <template #actionType="{ value }">
          <span :class="getActionBadgeClass(value)">{{ value }}</span>
        </template>
        <template #createdAt="{ value }">
          {{ formatDateTime(value) }}
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
import { getTableHistoryLogs } from '../api/logTableHistoryApi.js'
import { formatDateTime } from '@/frontend/common/utils/formatters.js'

const logs = ref([])
const currentPage = ref(1)
const totalItems = ref(0)
const limit = ref(20)

const searchQuery = ref({
  tablen: '',
  actionType: '',
})

const tableColumns = [
  { key: 'id', label: '번호' },
  { key: 'tablen', label: '테이블명' },
  { key: 'actionType', label: '작업' },
  { key: 'targetType', label: '대상 유형' },
  { key: 'targetName', label: '대상명' },
  { key: 'createdBy', label: '수행자' },
  { key: 'createdAt', label: '발생 일시' },
]

const fetchLogs = async () => {
  try {
    const params = {
      page: currentPage.value,
      size: limit.value,
      ...searchQuery.value,
    }
    const data = await getTableHistoryLogs(params)
    logs.value = data.data || []
    totalItems.value = data.total || 0
  } catch (error) {
    console.error('Error fetching table history logs:', error)
  }
}

const onPageChange = (page) => {
  currentPage.value = page
  fetchLogs()
}

const getActionBadgeClass = (action) => {
  if (action === 'INSERT') return 'badge-success'
  if (action === 'UPDATE') return 'badge-warning'
  if (action === 'DELETE') return 'badge-danger'
  return ''
}

onMounted(() => {
  fetchLogs()
})
</script>
