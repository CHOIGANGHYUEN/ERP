<template>
  <div class="app-container">
    <div class="app-page-title">테이블 명세서 관리 (SYST06V001)</div>

    <!-- Search Area -->
    <div class="app-card" style="margin-bottom: var(--app-spacing-md)">
      <div class="app-grid">
        <div class="app-grid-item">
          <label>모듈명</label>
          <input
            type="text"
            v-model="searchQuery.module"
            class="app-input"
            placeholder="모듈명 입력"
          />
        </div>
        <div class="app-grid-item">
          <label>테이블 물리명</label>
          <input
            type="text"
            v-model="searchQuery.tablen"
            class="app-input"
            placeholder="테이블 물리명 입력"
          />
        </div>
        <div class="app-grid-item">
          <label>테이블 논리명</label>
          <input
            type="text"
            v-model="searchQuery.tableNm"
            class="app-input"
            placeholder="테이블 논리명 입력"
          />
        </div>
        <div
          class="app-grid-item"
          style="display: flex; align-items: flex-end; justify-content: flex-end"
        >
          <button class="btn btn-primary" @click="searchTables">조회</button>
          <button class="btn btn-secondary" style="margin-left: 8px" @click="goToDetail('new')">
            신규 등록
          </button>
        </div>
      </div>
    </div>

    <!-- Data Grid -->
    <div class="app-card">
      <table class="app-table">
        <thead>
          <tr>
            <th>모듈명</th>
            <th>테이블 물리명</th>
            <th>테이블 논리명</th>
            <th>설명</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="table in tables"
            :key="table.tablen"
            @click="goToDetail(table.tablen)"
            style="cursor: pointer"
          >
            <td>{{ table.module }}</td>
            <td>{{ table.tablen }}</td>
            <td>{{ table.tableNm }}</td>
            <td>{{ table.description }}</td>
          </tr>
          <tr v-if="tables.length === 0">
            <td colspan="4" style="text-align: center; padding: 20px">조회된 데이터가 없습니다.</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div
        style="
          margin-top: 16px;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
        "
      >
        <button
          class="btn btn-secondary"
          :disabled="currentPage === 1"
          @click="changePage(currentPage - 1)"
        >
          이전
        </button>
        <span>{{ currentPage }} / {{ totalPages }}</span>
        <button
          class="btn btn-secondary"
          :disabled="currentPage === totalPages"
          @click="changePage(currentPage + 1)"
        >
          다음
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getTableList } from '../api/tableSpecApi.js'

const router = useRouter()

const searchQuery = ref({
  module: '',
  tablen: '',
  tableNm: '',
})

const tables = ref([])
const currentPage = ref(1)
const totalPages = ref(1)
const pageSize = ref(10)

const searchTables = async () => {
  try {
    const result = await getTableList({
      module: searchQuery.value.module,
      tablen: searchQuery.value.tablen,
      tableNm: searchQuery.value.tableNm,
      page: currentPage.value,
      size: pageSize.value,
    })

    tables.value = result.data || []
    totalPages.value = Math.max(1, Math.ceil((result.total || 0) / pageSize.value))
  } catch (error) {
    console.error('Error fetching tables:', error)
    alert('조회 중 오류가 발생했습니다.')
  }
}

const goToDetail = (tablen) => {
  router.push(`/sys/syst06/${tablen}`)
}

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    searchTables()
  }
}

onMounted(() => {
  searchTables()
})
</script>
