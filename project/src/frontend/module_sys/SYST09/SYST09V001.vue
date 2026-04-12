<template>
  <div class="app-container">
    <AppPageTitle title="단위 관리 (SYST09)" />
    <AppCard style="margin-bottom: 16px">
      <div class="app-grid">
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px">단위 코드</label>
          <AppInput v-model="search.unit" placeholder="예: EA, KG" @keyup.enter="fetchData" />
        </div>
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px">단위명</label>
          <AppInput v-model="search.unitNm" placeholder="검색" @keyup.enter="fetchData" />
        </div>
        <div class="app-grid-item" style="display: flex; align-items: flex-end; gap: 8px">
          <AppButton type="primary" @click="fetchData">검색</AppButton>
          <AppButton type="secondary" @click="router.push('/sys/syst09/new')">신규 등록</AppButton>
        </div>
      </div>
    </AppCard>
    <AppCard>
      <AppTable :columns="cols" :data="list" @row-click="(r) => router.push(`/sys/syst09/${r.id}`)">
        <template #baseUnitYn="{ value }">
          <span :class="value === 1 ? 'badge-warning' : ''">{{ value === 1 ? 'Y' : 'N' }}</span>
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
import { getUnitList } from '../api/unitApi.js'

const router = useRouter()
const search = ref({ unit: '', unitNm: '' })
const list = ref([]),
  page = ref(1),
  size = ref(10),
  total = ref(0)
const cols = [
  { key: 'dispOrd', label: '순서' },
  { key: 'unit', label: '단위' },
  { key: 'unitNm', label: '명칭' },
  { key: 'baseUnitYn', label: '기본단위 여부' },
  { key: 'baseUnit', label: '기준 단위' },
  { key: 'convRate', label: '변환율' },
]

const fetchData = async () => {
  const res = await getUnitList({ page: page.value, size: size.value, ...search.value })
  list.value = res.data
  total.value = res.total
}
onMounted(fetchData)
</script>
