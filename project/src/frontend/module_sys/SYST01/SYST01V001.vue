<template>
  <div class="app-container">
    <AppPageTitle title="사용자 관리 (User Management)" />

    <AppCard style="margin-bottom: 16px">
      <div class="search-area" style="display: flex; gap: 8px; align-items: center">
        <AppInput
          v-model="searchQuery"
          placeholder="사용자 ID 검색"
          style="width: 300px"
          @keyup.enter="fetchUsers"
        />
        <AppButton type="primary" @click="fetchUsers">검색</AppButton>
        <AppButton type="secondary" @click="goToCreate">신규 등록</AppButton>
      </div>
    </AppCard>

    <AppCard>
      <AppTable :columns="tableColumns" :data="users" @row-click="(row) => goToDetail(row.id)">
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
import { useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import AppTable from '@/frontend/common/components/AppTable.vue'
import AppPagination from '@/frontend/common/components/AppPagination.vue'
import { getUsers } from '../api/userApi.js'
import { formatDateTime } from '@/frontend/common/utils/formatters.js'

const router = useRouter()
const users = ref([])
const searchQuery = ref('')
const currentPage = ref(1)
const totalItems = ref(0)
const limit = ref(10)

const tableColumns = [
  { key: 'id', label: 'ID' },
  { key: 'userId', label: '사용자 ID' },
  { key: 'createdBy', label: '생성자' },
  { key: 'createdAt', label: '생성일시' },
]

const fetchUsers = async () => {
  try {
    const params = { page: currentPage.value, size: limit.value }
    if (searchQuery.value) {
      params.search = searchQuery.value
    }

    const data = await getUsers(params)
    users.value = data.data || []
    totalItems.value = data.total || 0
  } catch (error) {
    console.error('Error fetching users:', error)
    alert('조회 중 오류가 발생했습니다.')
  }
}

const goToDetail = (id) => {
  router.push(`/sys/syst01/${id}`)
}

const goToCreate = () => {
  router.push(`/sys/syst01/new`)
}

const onPageChange = (page) => {
  currentPage.value = page
  fetchUsers()
}

onMounted(() => {
  fetchUsers()
})
</script>
