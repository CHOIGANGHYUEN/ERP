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
          style="display: flex; align-items: flex-end; justify-content: flex-end; gap: 8px"
        >
          <button class="btn btn-primary" @click="searchTables">조회</button>
          <button class="btn btn-secondary" @click="goToDetail('new')">신규 등록</button>
          <button
            class="btn btn-secondary"
            @click="exportExcel"
            :disabled="selectedTables.size === 0 || isExporting"
            :title="selectedTables.size === 0 ? '내보낼 테이블을 선택하세요' : `선택된 ${selectedTables.size}개 테이블의 전체 스펙 내보내기`"
            style="position: relative"
          >
            <span v-if="isExporting">⏳ 처리 중...</span>
            <span v-else>📥 스펙 내보내기 ({{ selectedTables.size }})</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Data Grid -->
    <div class="app-card">
      <table class="app-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center">
              <!-- 전체 선택 체크박스 -->
              <input
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate.prop="isIndeterminate"
                @change="toggleAllSelection"
                title="전체 선택 / 해제"
                style="cursor: pointer; width: 16px; height: 16px"
              />
            </th>
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
            :class="{ 'row-selected': selectedTables.has(table.tablen) }"
          >
            <td style="text-align: center" @click.stop>
              <input
                type="checkbox"
                :checked="selectedTables.has(table.tablen)"
                @change="toggleSelection(table.tablen)"
                style="cursor: pointer; width: 16px; height: 16px"
              />
            </td>
            <td @click="goToDetail(table.tablen)" style="cursor: pointer">{{ table.module }}</td>
            <td @click="goToDetail(table.tablen)" style="cursor: pointer">{{ table.tablen }}</td>
            <td @click="goToDetail(table.tablen)" style="cursor: pointer">{{ table.tableNm }}</td>
            <td @click="goToDetail(table.tablen)" style="cursor: pointer">{{ table.description }}</td>
          </tr>
          <tr v-if="tables.length === 0">
            <td colspan="5" style="text-align: center; padding: 20px">조회된 데이터가 없습니다.</td>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getTableList, getTableDetail } from '../api/tableSpecApi.js'
import { exportMultiSheet } from '@/frontend/common/utils/excelExport.js'

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

// 선택된 테이블 tablen 목록 (Set으로 관리)
const selectedTables = ref(new Set())
const isExporting = ref(false)

// 전체 선택 여부 계산
const isAllSelected = computed(
  () => tables.value.length > 0 && tables.value.every((t) => selectedTables.value.has(t.tablen)),
)

// 부분 선택 여부 (indeterminate)
const isIndeterminate = computed(
  () =>
    tables.value.some((t) => selectedTables.value.has(t.tablen)) && !isAllSelected.value,
)

const toggleSelection = (tablen) => {
  const next = new Set(selectedTables.value)
  if (next.has(tablen)) {
    next.delete(tablen)
  } else {
    next.add(tablen)
  }
  selectedTables.value = next
}

const toggleAllSelection = () => {
  if (isAllSelected.value) {
    // 현재 페이지 전체 해제
    const next = new Set(selectedTables.value)
    tables.value.forEach((t) => next.delete(t.tablen))
    selectedTables.value = next
  } else {
    // 현재 페이지 전체 선택
    const next = new Set(selectedTables.value)
    tables.value.forEach((t) => next.add(t.tablen))
    selectedTables.value = next
  }
}

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

/**
 * 선택된 테이블들의 전체 스펙(기본정보 + 필드 + 인덱스)을
 * 테이블 1개당 1개의 시트로 묶어 XLSX로 내보냅니다.
 * 시트명 = 테이블 물리명 (최대 31자, Excel 시트명 제한)
 */
const exportExcel = async () => {
  if (selectedTables.value.size === 0) {
    alert('내보낼 테이블을 선택하세요.')
    return
  }

  isExporting.value = true

  try {
    const tablenList = Array.from(selectedTables.value)
    const sheets = []

    for (const tablen of tablenList) {
      const data = await getTableDetail(tablen)

      const info = data.tableInfo || {}
      const fields = data.fields || []
      const indexes = data.indexes || []

      // ── 한 시트에 기본정보 / 필드 / 인덱스를 블록으로 배치 ──
      const rows = []

      // [기본 정보 블록]
      rows.push(['[기본 정보]'])
      rows.push(['테이블 물리명', info.tablen || tablen])
      rows.push(['모듈명', info.module || ''])
      rows.push(['테이블 논리명', info.tableNm || ''])
      rows.push(['설명', info.description || ''])
      rows.push([]) // 빈 줄

      // [필드 명세 블록]
      rows.push(['[필드 명세]'])
      rows.push(['번호', '필드명(물리)', '필드명(논리)', '데이터 타입', '길이', 'NULL 허용', 'PK', 'AutoIncrement'])
      fields.forEach((f, i) => {
        rows.push([
          i + 1,
          f.fieldn || '',
          f.fieldNm || '',
          f.fieldType || '',
          f.fieldLength || '',
          f.isNull === 1 ? 'Y' : 'N',
          f.fieldKey === 'PRI' ? 'Y' : 'N',
          f.isAutoIncrement === 1 ? 'Y' : 'N',
        ])
      })
      rows.push([]) // 빈 줄

      // [인덱스 명세 블록]
      rows.push(['[인덱스 명세]'])
      rows.push(['번호', '인덱스명', '인덱스명(논리)', '대상 필드', 'Unique'])
      indexes.forEach((idx, i) => {
        const fieldNames = (idx.indexFields || []).map((inf) => inf.fieldn).join(', ')
        rows.push([
          i + 1,
          idx.indexn || '',
          idx.indexNm || '',
          fieldNames,
          idx.isUnique === 1 ? 'Y' : 'N',
        ])
      })

      // 시트명은 최대 31자 (Excel 제한)
      const sheetName = tablen.length > 31 ? tablen.slice(0, 31) : tablen
      sheets.push({ name: sheetName, data: rows })
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const fileName =
      tablenList.length === 1
        ? `테이블명세서_${tablenList[0]}_${today}.xlsx`
        : `테이블명세서_${tablenList.length}개_${today}.xlsx`

    exportMultiSheet(sheets, fileName)
  } catch (err) {
    console.error('엑셀 내보내기 실패:', err)
    alert('엑셀 내보내기 중 오류가 발생했습니다.')
  } finally {
    isExporting.value = false
  }
}

onMounted(() => {
  searchTables()
})
</script>

<style scoped>
.row-selected {
  background-color: color-mix(in srgb, var(--app-primary-color, #007bff) 8%, transparent);
}
</style>
