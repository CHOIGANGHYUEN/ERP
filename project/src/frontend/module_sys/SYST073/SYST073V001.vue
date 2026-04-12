<template>
  <div class="app-container">
    <AppPageTitle title="유저 활동 로그 (User Activity Logs)" />

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
          <label style="display: block; margin-bottom: 4px; font-weight: 600">메뉴 ID</label>
          <AppInput
            v-model="searchQuery.menuId"
            placeholder="예: SYST01"
            @keyup.enter="fetchLogs"
          />
        </div>
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px; font-weight: 600">로그 일자</label>
          <AppInput type="date" v-model="searchQuery.logDt" @keyup.enter="fetchLogs" />
        </div>
        <div class="app-grid-item" style="display: flex; align-items: flex-end">
          <AppButton type="primary" @click="fetchLogs">검색</AppButton>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <AppTable :columns="tableColumns" :data="logs">
        <template #logAt="{ value }">
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
import { getUserLogs } from '../api/logUserApi.js'
import { formatDateTime } from '@/frontend/common/utils/formatters.js'

const logs = ref([])
const currentPage = ref(1)
const totalItems = ref(0)
const limit = ref(20)

const searchQuery = ref({
  userId: '',
  menuId: '',
  logDt: '',
})

const tableColumns = [
  { key: 'id', label: '번호' },
  { key: 'userId', label: '사용자 ID' },
  { key: 'menuId', label: '메뉴 ID' },
  { key: 'logAt', label: '발생 일시' },
  { key: 'logged', label: '로그 내용' },
  { key: 'params', label: '파라미터' },
  { key: 'request', label: '요청 정보' },
]

const fetchLogs = async () => {
  try {
    const params = { page: currentPage.value, size: limit.value, ...searchQuery.value }
    const data = await getUserLogs(params)
    logs.value = data.data || []
    totalItems.value = data.total || 0
  } catch (error) {
    console.error('Error fetching user logs:', error)
  }
}

const onPageChange = (page) => {
  currentPage.value = page
  fetchLogs()
}

onMounted(() => fetchLogs())
</script>
