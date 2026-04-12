<template>
  <div class="app-container">
    <AppPageTitle title="공장/사업장 관리 (SYST08)" />
    <AppCard style="margin-bottom: 16px">
      <div class="app-grid">
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px">회사 코드</label>
          <AppInput v-model="search.company" placeholder="검색" @keyup.enter="fetchData" />
        </div>
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px">공장 코드</label>
          <AppInput v-model="search.plant" placeholder="검색" @keyup.enter="fetchData" />
        </div>
        <div class="app-grid-item" style="display: flex; align-items: flex-end; gap: 8px">
          <AppButton type="primary" @click="fetchData">검색</AppButton>
          <AppButton type="secondary" @click="router.push('/sys/syst08/new')">신규 등록</AppButton>
        </div>
      </div>
    </AppCard>
    <AppCard>
      <AppTable :columns="cols" :data="list" @row-click="(r) => router.push(`/sys/syst08/${r.id}`)">
        <template #useYn="{ value }">
          <span :class="value === 1 ? 'badge-success' : 'badge-danger'">{{
            value === 1 ? 'Y' : 'N'
          }}</span>
        </template>
      </AppTable>
      <AppPagination
        v-if="total > 0"
        :current-page="page"
        :total-items="total"
        :items-per-page="size"
        @page-change="
          (p) => {
            page = p
            fetchData()
          }
        "
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
import { getPlantList } from '../api/plantApi.js'

const router = useRouter()
const search = ref({ company: '', plant: '' })
const list = ref([]),
  page = ref(1),
  size = ref(10),
  total = ref(0)
const cols = [
  { key: 'company', label: '회사 코드' },
  { key: 'plant', label: '공장 코드' },
  { key: 'regNo', label: '사업자번호' },
  { key: 'useYn', label: '사용 여부' },
]

const fetchData = async () => {
  const res = await getPlantList({ page: page.value, size: size.value, ...search.value })
  list.value = res.data
  total.value = res.total
}
onMounted(fetchData)
</script>
