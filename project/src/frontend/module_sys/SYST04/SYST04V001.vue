<template>
  <div class="app-container">
    <AppPageTitle title="공통 코드 관리 (Common Code Management)" />

    <AppCard style="margin-bottom: 16px">
      <div class="app-grid">
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px; font-weight: 600">카테고리 코드</label>
          <AppInput
            v-model="searchQuery.categoryCode"
            placeholder="예: SYS"
            @keyup.enter="fetchCodes"
          />
        </div>
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px; font-weight: 600">그룹 코드</label>
          <AppInput
            v-model="searchQuery.groupCode"
            placeholder="그룹 코드"
            @keyup.enter="fetchCodes"
          />
        </div>
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px; font-weight: 600">설명</label>
          <AppInput
            v-model="searchQuery.description"
            placeholder="설명"
            @keyup.enter="fetchCodes"
          />
        </div>
        <div class="app-grid-item" style="display: flex; align-items: flex-end; gap: 8px">
          <AppButton type="primary" @click="fetchCodes">검색</AppButton>
          <AppButton type="secondary" @click="goToCreate">신규 등록</AppButton>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <AppTable :columns="tableColumns" :data="codes" @row-click="goToDetail">
        <template #useYn="{ value }">
          <span :class="value === 1 ? 'badge-success' : 'badge-danger'">
            {{ value === 1 ? 'Y' : 'N' }}
          </span>
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
import { useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import AppTable from '@/frontend/common/components/AppTable.vue'
import AppPagination from '@/frontend/common/components/AppPagination.vue'
import { getCodeHeads } from '../api/codeApi.js'

const router = useRouter()
const codes = ref([])
const currentPage = ref(1)
const totalItems = ref(0)
const limit = ref(10)

const searchQuery = ref({
  categoryCode: '',
  groupCode: '',
  description: '',
})

const tableColumns = [
  { key: 'categoryCode', label: '카테고리' },
  { key: 'groupCode', label: '그룹 코드' },
  { key: 'description', label: '설명' },
  { key: 'useYn', label: '사용여부' },
]

const fetchCodes = async () => {
  try {
    const params = {
      page: currentPage.value,
      size: limit.value,
    }
    Object.entries(searchQuery.value).forEach(([key, value]) => {
      if (value) params[key] = value
    })

    const data = await getCodeHeads(params)
    codes.value = data.data || []
    totalItems.value = data.total || 0
  } catch (error) {
    console.error('Error fetching code heads:', error)
    alert('조회 중 오류가 발생했습니다. 백엔드 상태를 확인해주세요.')
  }
}

const goToDetail = (code) => {
  router.push({
    path: '/sys/syst04/detail',
    query: { categoryCode: code.categoryCode, groupCode: code.groupCode },
  })
}

const goToCreate = () => {
  router.push('/sys/syst04/new')
}

const onPageChange = (page) => {
  currentPage.value = page
  fetchCodes()
}

onMounted(() => {
  fetchCodes()
})
</script>
