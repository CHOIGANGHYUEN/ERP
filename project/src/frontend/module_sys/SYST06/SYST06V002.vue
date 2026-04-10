<template>
  <div class="app-container">
    <div class="app-page-title">테이블 명세서 상세 (SYST06V002)</div>

    <!-- Master Area -->
    <div class="app-card" style="margin-bottom: var(--app-spacing-md)">
      <h3
        style="
          margin-bottom: 12px;
          font-size: 1.1rem;
          border-bottom: 1px solid var(--app-border-color);
          padding-bottom: 8px;
        "
      >
        기본 정보
      </h3>
      <div class="app-grid">
        <div class="app-grid-item">
          <label>테이블 물리명</label>
          <input type="text" v-model="tableInfo.tablen" class="app-input" :disabled="!isNew" />
        </div>
        <div class="app-grid-item">
          <label>모듈명</label>
          <input type="text" v-model="tableInfo.module" class="app-input" />
        </div>
        <div class="app-grid-item">
          <label>테이블 논리명</label>
          <input type="text" v-model="tableInfo.tableNm" class="app-input" />
        </div>
        <div class="app-grid-item">
          <label>설명</label>
          <input type="text" v-model="tableInfo.description" class="app-input" />
        </div>
      </div>
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end">
        <button class="btn btn-secondary" @click="goBack">목록</button>
        <button class="btn btn-primary" @click="saveTableInfo">저장</button>
        <button class="btn btn-primary" @click="showSqlModal = true" v-if="!isNew">
          SQL DDL 생성
        </button>
      </div>
    </div>

    <!-- Detail Tabs -->
    <div class="app-card">
      <div
        style="
          margin-bottom: 16px;
          border-bottom: 1px solid var(--app-border-color);
          padding-bottom: 8px;
          display: flex;
          gap: 8px;
        "
      >
        <button
          class="btn"
          :class="activeTab === 'fields' ? 'btn-primary' : 'btn-secondary'"
          @click="activeTab = 'fields'"
        >
          필드 명세
        </button>
        <button
          class="btn"
          :class="activeTab === 'indexes' ? 'btn-primary' : 'btn-secondary'"
          @click="activeTab = 'indexes'"
        >
          인덱스 명세
        </button>
        <button
          class="btn"
          :class="activeTab === 'history' ? 'btn-primary' : 'btn-secondary'"
          @click="activeTab = 'history'"
        >
          변경 이력
        </button>
      </div>

      <!-- Fields Tab -->
      <div v-if="activeTab === 'fields'">
        <table class="app-table">
          <thead>
            <tr>
              <th>필드명</th>
              <th>타입</th>
              <th>길이</th>
              <th>NULL 여부</th>
              <th>PK 여부</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(field, index) in fields" :key="index">
              <td><input type="text" v-model="field.name" class="app-input" /></td>
              <td>
                <select v-model="field.type" class="app-input">
                  <option value="INT">INT</option>
                  <option value="VARCHAR">VARCHAR</option>
                  <option value="DATETIME">DATETIME</option>
                  <option value="BOOLEAN">BOOLEAN</option>
                </select>
              </td>
              <td><input type="number" v-model="field.length" class="app-input" /></td>
              <td style="text-align: center"><input type="checkbox" v-model="field.isNull" /></td>
              <td style="text-align: center"><input type="checkbox" v-model="field.isPk" /></td>
              <td>
                <button
                  class="btn btn-secondary"
                  style="padding: 4px 8px; font-size: 0.9em"
                  @click="removeField(index)"
                >
                  삭제
                </button>
              </td>
            </tr>
            <tr v-if="fields.length === 0">
              <td colspan="6" style="text-align: center">등록된 필드가 없습니다.</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 12px; text-align: right">
          <button class="btn btn-secondary" @click="addField">필드 추가</button>
        </div>
      </div>

      <!-- Indexes Tab -->
      <div v-if="activeTab === 'indexes'">
        <table class="app-table">
          <thead>
            <tr>
              <th>인덱스명</th>
              <th>대상 필드</th>
              <th>Unique 여부</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(idx, index) in indexes" :key="index">
              <td><input type="text" v-model="idx.name" class="app-input" /></td>
              <td>
                <input
                  type="text"
                  v-model="idx.fields"
                  class="app-input"
                  placeholder="콤마로 구분"
                />
              </td>
              <td style="text-align: center"><input type="checkbox" v-model="idx.isUnique" /></td>
              <td>
                <button
                  class="btn btn-secondary"
                  style="padding: 4px 8px; font-size: 0.9em"
                  @click="removeIndex(index)"
                >
                  삭제
                </button>
              </td>
            </tr>
            <tr v-if="indexes.length === 0">
              <td colspan="4" style="text-align: center">등록된 인덱스가 없습니다.</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 12px; text-align: right">
          <button class="btn btn-secondary" @click="addIndex">인덱스 추가</button>
        </div>
      </div>

      <!-- History Tab -->
      <div v-if="activeTab === 'history'">
        <table class="app-table">
          <thead>
            <tr>
              <th>변경일시</th>
              <th>변경자</th>
              <th>변경 내역</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(hist, index) in history" :key="index">
              <td>{{ hist.date }}</td>
              <td>{{ hist.user }}</td>
              <td>{{ hist.details }}</td>
            </tr>
            <tr v-if="history.length === 0">
              <td colspan="3" style="text-align: center">이력이 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- SQL Execution Modal -->
    <SqlExecutionModal
      v-if="showSqlModal"
      :tableInfo="tableInfo"
      :fields="fields"
      :indexes="indexes"
      @close="showSqlModal = false"
      @execute="executeSql"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SqlExecutionModal from '../components/SqlExecutionModal.vue'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => route.params.tablen === 'new')
const activeTab = ref('fields')
const showSqlModal = ref(false)

const tableInfo = ref({
  tablen: '',
  module: '',
  tableNm: '',
  description: '',
})

const fields = ref([])
const indexes = ref([])
const history = ref([])

onMounted(() => {
  if (!isNew.value) {
    // Mock Load based on tablen
    tableInfo.value = {
      tablen: route.params.tablen,
      module: 'SYS',
      tableNm: '샘플 테이블',
      description: '시스템 샘플 테이블',
    }
    fields.value = [
      { name: 'id', type: 'INT', length: 11, isNull: false, isPk: true },
      { name: 'name', type: 'VARCHAR', length: 50, isNull: true, isPk: false },
      { name: 'created_at', type: 'DATETIME', length: 0, isNull: true, isPk: false },
    ]
    indexes.value = [{ name: 'idx_name', fields: 'name', isUnique: false }]
    history.value = [
      { date: '2026-04-09 10:00:00', user: 'admin', details: '테이블 명세 최초 등록' },
    ]
  }
})

const goBack = () => {
  router.push('/sys/tables')
}

const saveTableInfo = () => {
  alert('정상적으로 저장되었습니다.')
  if (isNew.value) {
    router.push(`/sys/tables/${tableInfo.value.tablen}`)
  }
}

const addField = () => {
  fields.value.push({ name: '', type: 'VARCHAR', length: 50, isNull: true, isPk: false })
}

const removeField = (index) => {
  fields.value.splice(index, 1)
}

const addIndex = () => {
  indexes.value.push({ name: '', fields: '', isUnique: false })
}

const removeIndex = (index) => {
  indexes.value.splice(index, 1)
}

const executeSql = () => {
  alert('SQL 스크립트 실행이 완료되었습니다.')
  showSqlModal.value = false
}
</script>
