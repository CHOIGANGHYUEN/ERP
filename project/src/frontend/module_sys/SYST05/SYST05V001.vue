<template>
  <div>
    <AppPageTitle title="시스템 설정 (System Settings)" />
    <AppCard style="margin-bottom: 16px">
      <div style="display: flex; gap: 8px; align-items: center">
        <AppInput
          v-model="searchQuery"
          placeholder="설정 ID 또는 명칭 검색"
          style="width: 300px"
          @keyup.enter="fetchConfigs"
        />
        <AppButton type="primary" @click="fetchConfigs">검색</AppButton>
        <AppButton type="secondary" @click="goToCreate">신규 등록</AppButton>
      </div>
    </AppCard>

    <AppCard>
      <AppTable>
        <thead>
          <tr>
            <th>설정 ID</th>
            <th>설정명</th>
            <th>설정값</th>
            <th>설명</th>
            <th>사용 여부</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="config in configs"
            :key="config.configId"
            @click="goToDetail(config.configId)"
            style="cursor: pointer"
          >
            <td>{{ config.configId }}</td>
            <td>{{ config.configName }}</td>
            <td>{{ config.configValue }}</td>
            <td>{{ config.description }}</td>
            <td>{{ config.useYn === 1 ? 'Y' : 'N' }}</td>
          </tr>
          <tr v-if="configs.length === 0">
            <td colspan="5" style="text-align: center">데이터가 없습니다.</td>
          </tr>
        </tbody>
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

const router = useRouter()
const configs = ref([])
const searchQuery = ref('')
const currentPage = ref(1)
const totalItems = ref(0)
const limit = ref(10)

const tableColumns = [
  { key: 'configId', label: '설정 ID' },
  { key: 'configName', label: '설정명' },
  { key: 'configValue', label: '설정값' },
  { key: 'description', label: '설명' },
  { key: 'useYn', label: '사용 여부' }
]

const fetchConfigs = async () => {
  try {
    const data = await getConfigs({
      page: currentPage.value,
      limit: limit.value,
      search: searchQuery.value
    })
    configs.value = data.data
    totalItems.value = data.total
  } catch (error) {
    console.error('Error fetching configs:', error)
  }
}

const onPageChange = (page) => {
  currentPage.value = page
  fetchConfigs()
}

const goToDetail = (id) => {
  router.push(`/sys/settings/${id}`)
}

const goToCreate = () => {
  router.push(`/sys/settings/new`)
}

onMounted(() => {
  fetchConfigs()
})
</script>
router.push(`/sys/settings/${id}`)
}

const goToCreate = () => {
  router.push(`/sys/settings/new`)
}

onMounted(() => {
  fetchConfigs()
})
</script>
