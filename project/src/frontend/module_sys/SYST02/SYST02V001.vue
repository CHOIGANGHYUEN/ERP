<template>
  <div>
    <AppPageTitle title="권한 관리 (Role Management)" />
    <AppCard style="margin-bottom: 16px">
      <div style="display: flex; gap: 8px; align-items: center">
        <AppInput
          v-model="searchQuery"
          placeholder="권한ID 또는 설명 검색"
          style="width: 300px"
          @keyup.enter="fetchRoles"
        />
        <AppButton type="primary" @click="fetchRoles">검색</AppButton>
        <AppButton type="secondary" @click="goToCreate">신규 등록</AppButton>
      </div>
    </AppCard>

    <AppCard>
      <AppTable :columns="tableColumns" :data="roles" @row-click="(row) => goToDetail(row.roleId)">
        <template #useYn="{ value }">
          {{ value === 1 ? 'Y' : 'N' }}
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
import { getRoles } from '@/frontend/module_sys/api/roleApi.js'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import AppTable from '@/frontend/common/components/AppTable.vue'
import AppPagination from '@/frontend/common/components/AppPagination.vue'

const router = useRouter()
const roles = ref([])
const searchQuery = ref('')
const currentPage = ref(1)
const totalItems = ref(0)
const limit = ref(10)

const tableColumns = [
  { key: 'roleId', label: '권한 ID' },
  { key: 'description', label: '설명' },
  { key: 'useYn', label: '사용 여부' },
]

const fetchRoles = async () => {
  try {
    const data = await getRoles({
      page: currentPage.value,
      limit: limit.value,
      search: searchQuery.value,
    })
    roles.value = data.data
    totalItems.value = data.total
  } catch (error) {
    console.error('Error fetching roles:', error)
  }
}

const onPageChange = (page) => {
  currentPage.value = page
  fetchRoles()
}

const goToDetail = (id) => {
  router.push(`/sys/syst02/${id}`)
}

const goToCreate = () => {
  router.push(`/sys/syst02/new`)
}

onMounted(() => {
  fetchRoles()
})
</script>
