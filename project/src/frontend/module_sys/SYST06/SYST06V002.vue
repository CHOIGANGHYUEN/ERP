<template>
  <div class="app-container">
    <AppPageTitle
      :title="isNew ? '테이블 명세서 등록 (Create Table)' : '테이블 명세서 상세 (Table Detail)'"
    />

    <!-- Master Area -->
    <AppCard class="master-card">
      <div class="card-header">
        <h3 class="card-title">기본 정보</h3>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">테이블 물리명</label>
          <AppInput
            type="text"
            v-model="tableInfo.tablen"
            :disabled="!isNew"
            placeholder="예: sysUser"
          />
        </div>
        <div class="form-group">
          <label class="form-label">모듈명</label>
          <AppInput type="text" v-model="tableInfo.module" placeholder="예: SYS" />
        </div>
        <div class="form-group">
          <label class="form-label">테이블 논리명</label>
          <AppInput type="text" v-model="tableInfo.tableNm" placeholder="예: 사용자 정보" />
        </div>
        <div class="form-group">
          <label class="form-label">설명</label>
          <AppInput type="text" v-model="tableInfo.description" placeholder="테이블에 대한 설명" />
        </div>
      </div>
      <div class="form-actions">
        <AppButton type="secondary" @click="goBack" class="btn-cancel">목록</AppButton>
        <div class="right-actions">
          <AppButton type="primary" @click="saveTableInfo" class="btn-save">저장</AppButton>
          <AppButton type="secondary" @click="handleGenerateInsertSql" v-if="!isNew">
            INSERT 생성
          </AppButton>
          <AppButton type="secondary" @click="handleGenerateUpdateSql" v-if="!isNew">
            UPDATE 생성
          </AppButton>
          <AppButton type="primary" @click="openSqlModal" v-if="!isNew" class="btn-sql">
            SQL DDL 생성
          </AppButton>
        </div>
      </div>
    </AppCard>

    <!-- Detail Tabs -->
    <AppCard class="detail-card">
      <div class="tab-header">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'fields' }"
          @click="activeTab = 'fields'"
        >
          필드 명세
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'indexes' }"
          @click="activeTab = 'indexes'"
        >
          인덱스 명세
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'history' }"
          @click="activeTab = 'history'"
        >
          변경 이력
        </button>
      </div>

      <!-- Fields Tab -->
      <div v-if="activeTab === 'fields'" class="tab-content fade-in">
        <div class="table-responsive">
          <table class="app-table modern-data-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center">☰</th>
                <th>필드명</th>
                <th>타입</th>
                <th>길이</th>
                <th style="text-align: center">NULL 허용</th>
                <th style="text-align: center">PK 여부</th>
                <th style="text-align: center" title="Auto Increment">A_I</th>
                <th style="text-align: right; width: 140px">작업</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(field, index) in fields" :key="index">
                <td style="text-align: center; color: #adb5bd; font-size: 1.2rem">≡</td>
                <td><AppInput type="text" v-model="field.name" placeholder="field_name" /></td>
                <td>
                  <div class="select-wrapper">
                    <select v-model="field.type" class="app-input modern-select">
                      <option value="INT">INT</option>
                      <option value="BIGINT">BIGINT</option>
                      <option value="VARCHAR">VARCHAR</option>
                      <option value="DATETIME">DATETIME</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                    </select>
                  </div>
                </td>
                <td><AppInput type="number" v-model="field.length" placeholder="길이" /></td>
                <td style="text-align: center">
                  <input type="checkbox" v-model="field.isNull" class="modern-checkbox" />
                </td>
                <td style="text-align: center">
                  <input type="checkbox" v-model="field.isPk" class="modern-checkbox" />
                </td>
                <td style="text-align: center">
                  <input
                    type="checkbox"
                    v-model="field.isAutoIncrement"
                    :disabled="field.type !== 'INT' && field.type !== 'BIGINT'"
                    class="modern-checkbox"
                  />
                </td>
                <td style="text-align: right">
                  <div class="action-buttons">
                    <button
                      class="icon-btn"
                      @click.prevent="moveFieldUp(index)"
                      :disabled="index === 0"
                      title="위로"
                    >
                      ▲
                    </button>
                    <button
                      class="icon-btn"
                      @click.prevent="moveFieldDown(index)"
                      :disabled="index === fields.length - 1"
                      title="아래로"
                    >
                      ▼
                    </button>
                    <button class="icon-btn danger" @click="removeField(index)" title="삭제">
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="fields.length === 0">
                <td colspan="8" class="empty-state">
                  등록된 필드가 없습니다. 필드를 추가해주세요.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="tab-actions">
          <AppButton type="secondary" @click="addField">+ 필드 추가</AppButton>
        </div>
      </div>

      <!-- Indexes Tab -->
      <div v-if="activeTab === 'indexes'" class="tab-content fade-in">
        <div class="table-responsive">
          <table class="app-table modern-data-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center">☰</th>
                <th>인덱스명</th>
                <th>대상 필드 (순서대로 콤마 구분)</th>
                <th style="text-align: center">Unique 여부</th>
                <th style="text-align: right; width: 140px">작업</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(idx, index) in indexes" :key="index">
                <td style="text-align: center; color: #adb5bd; font-size: 1.2rem">≡</td>
                <td><AppInput type="text" v-model="idx.name" placeholder="idx_name" /></td>
                <td>
                  <AppInput
                    type="text"
                    v-model="idx.fields"
                    placeholder="예: id, name, created_at"
                  />
                </td>
                <td style="text-align: center">
                  <input type="checkbox" v-model="idx.isUnique" class="modern-checkbox" />
                </td>
                <td style="text-align: right">
                  <div class="action-buttons">
                    <button
                      class="icon-btn"
                      @click.prevent="moveIndexUp(index)"
                      :disabled="index === 0"
                      title="위로"
                    >
                      ▲
                    </button>
                    <button
                      class="icon-btn"
                      @click.prevent="moveIndexDown(index)"
                      :disabled="index === indexes.length - 1"
                      title="아래로"
                    >
                      ▼
                    </button>
                    <button class="icon-btn danger" @click="removeIndex(index)" title="삭제">
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="indexes.length === 0">
                <td colspan="5" class="empty-state">
                  등록된 인덱스가 없습니다. 인덱스를 추가해주세요.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="tab-actions">
          <AppButton type="secondary" @click="addIndex">+ 인덱스 추가</AppButton>
        </div>
      </div>

      <!-- History Tab -->
      <div v-if="activeTab === 'history'" class="tab-content fade-in">
        <div class="table-responsive">
          <table class="app-table modern-data-table">
            <thead>
              <tr>
                <th>변경일시</th>
                <th>변경자</th>
                <th>변경 내역</th>
                <th style="text-align: center">상태</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(hist, index) in history" :key="index">
                <td class="cell-date">{{ hist.date }}</td>
                <td class="cell-user">{{ hist.user }}</td>
                <td class="cell-details">{{ hist.details }}</td>
                <td style="text-align: center">
                  <span :class="hist.isApplied ? 'badge-success' : 'badge-warning'">
                    {{ hist.isApplied ? '적용완료' : '대기중' }}
                  </span>
                </td>
              </tr>
              <tr v-if="history.length === 0">
                <td colspan="4" class="empty-state">이력이 없습니다.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppCard>

    <!-- SQL Execution Modal -->
    <SqlExecutionModal
      v-if="showSqlModal"
      :sqlContent="generatedSqlContent"
      @close="showSqlModal = false"
      @execute="handleExecuteSql"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import SqlExecutionModal from '../components/SqlExecutionModal.vue'
import {
  getTableDetail,
  saveTableSpec,
  generateSql,
  getInsertSql,
  getUpdateSql,
  executeSqlScript,
} from '../api/tableSpecApi.js'

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
const generatedSqlContent = ref('')

onMounted(async () => {
  if (!isNew.value) {
    try {
      const data = await getTableDetail(route.params.tablen)
      tableInfo.value = data.tableInfo || {}

      fields.value = (data.fields || []).map((f) => ({
        name: f.fieldn,
        type: f.fieldType,
        length: f.fieldLength,
        isNull: f.isNull === 1,
        isPk: f.fieldKey === 'PRI',
        isAutoIncrement: f.isAutoIncrement === 1,
        fieldNm: f.fieldNm,
        description: f.description,
      }))

      indexes.value = (data.indexes || []).map((idx) => ({
        name: idx.indexn,
        fields: (idx.indexFields || []).map((inf) => inf.fieldn).join(', '),
        isUnique: idx.isUnique === 1,
        indexNm: idx.indexNm,
        description: idx.description,
      }))

      history.value = (data.history || []).map((h) => ({
        date: new Date(h.createdAt).toLocaleString(),
        user: h.createdBy,
        details: `${h.actionType} ${h.targetType}: ${h.targetName}`,
        isApplied: h.isApplied === 1,
      }))
    } catch (error) {
      console.error('Error fetching detail:', error)
      alert('데이터를 불러오는데 실패했습니다.')
    }
  }
})

const goBack = () => {
  router.push('/sys/syst06')
}

const saveTableInfo = async () => {
  // 1. 필수 값 검증
  if (!tableInfo.value.tablen || tableInfo.value.tablen.trim() === '') {
    alert('테이블 물리명을 입력해주세요.')
    return
  }

  const invalidFields = fields.value.filter((f) => !f.name || f.name.trim() === '')
  if (invalidFields.length > 0) {
    alert('모든 필드의 물리명(필드명)을 입력해주세요.')
    return
  }

  // 2. 중복 검사 (필드명 및 인덱스명 중복 시 DB 에러 방지)
  const fieldNames = fields.value.map((f) => f.name.trim())
  if (new Set(fieldNames).size !== fieldNames.length) {
    alert('중복된 필드명이 존재합니다. 각 필드의 물리명은 고유해야 합니다.')
    return
  }

  const indexNames = indexes.value.map((idx) => idx.name.trim())
  if (new Set(indexNames).size !== indexNames.length) {
    alert('중복된 인덱스명이 존재합니다. 각 인덱스명은 고유해야 합니다.')
    return
  }

  try {
    const payload = {
      // 백엔드에 현재 화면이 신규 생성(new) 상태임을 명시적으로 전달
      isNew: isNew.value,
      tableInfo: tableInfo.value,
      fields: fields.value.map((f, i) => ({
        fieldn: f.name,
        fieldType: f.type,
        fieldLength: f.length || null,
        fieldKey: f.isPk ? 'PRI' : '',
        isNull: f.isNull ? 1 : 0,
        isAutoIncrement: f.isAutoIncrement ? 1 : 0,
        fieldOrder: i + 1,
        fieldNm: f.fieldNm || '',
        description: f.description || '',
      })),
      indexes: indexes.value.map((idx) => ({
        indexn: idx.name,
        isUnique: idx.isUnique ? 1 : 0,
        indexNm: idx.indexNm || '',
        description: idx.description || '',
        // 인덱스 내 중복 필드명 자동 제거 방어 로직 (Set 활용)
        indexFields: Array.from(
          new Set(
            idx.fields
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s),
          ),
        ).map((f, i) => ({
          fieldn: f,
          fieldOrder: i + 1,
        })),
      })),
    }

    await saveTableSpec(payload)
    alert('정상적으로 저장되었습니다.')

    if (isNew.value) {
      // 신규 등록 후 확실한 상태 초기화를 위해 Vue 라우터 대신 브라우저 리로드 이동 사용
      window.location.href = `/sys/syst06/${tableInfo.value.tablen}`
    } else {
      window.location.reload()
    }
  } catch (error) {
    console.error('Error saving table spec:', error)
    alert(`저장 실패: ${error.response?.data?.error || '오류가 발생했습니다.'}`)
  }
}

const openSqlModal = async () => {
  try {
    const data = await generateSql(tableInfo.value.tablen)
    generatedSqlContent.value =
      data.sql ||
      '/* 대기 중인 변경 사항이 없습니다. (모든 이력이 이미 DB에 적용 완료되었습니다.) */'
    showSqlModal.value = true
  } catch (error) {
    console.error('Error generating SQL:', error)
    alert('SQL 생성 중 오류가 발생했습니다.')
  }
}

const handleGenerateInsertSql = async () => {
  try {
    const data = await getInsertSql(tableInfo.value.tablen)
    generatedSqlContent.value = data.sql || '/* 생성된 INSERT 구문이 없습니다. */'
    showSqlModal.value = true
  } catch (error) {
    console.error('Error generating INSERT SQL:', error)
    alert('INSERT 구문 생성 중 오류가 발생했습니다.')
  }
}

const handleGenerateUpdateSql = async () => {
  try {
    const data = await getUpdateSql(tableInfo.value.tablen)
    generatedSqlContent.value = data.sql || '/* 생성된 UPDATE 구문이 없습니다. */'
    showSqlModal.value = true
  } catch (error) {
    console.error('Error generating UPDATE SQL:', error)
    alert('UPDATE 구문 생성 중 오류가 발생했습니다.')
  }
}

const addField = () => {
  fields.value.push({
    name: '',
    type: 'VARCHAR',
    length: 50,
    isNull: true,
    isPk: false,
    isAutoIncrement: false,
  })
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

const moveFieldUp = (index) => {
  if (index > 0) {
    const temp = fields.value[index]
    fields.value[index] = fields.value[index - 1]
    fields.value[index - 1] = temp
  }
}

const moveFieldDown = (index) => {
  if (index < fields.value.length - 1) {
    const temp = fields.value[index]
    fields.value[index] = fields.value[index + 1]
    fields.value[index + 1] = temp
  }
}

const moveIndexUp = (index) => {
  if (index > 0) {
    const temp = indexes.value[index]
    indexes.value[index] = indexes.value[index - 1]
    indexes.value[index - 1] = temp
  }
}

const moveIndexDown = (index) => {
  if (index < indexes.value.length - 1) {
    const temp = indexes.value[index]
    indexes.value[index] = indexes.value[index + 1]
    indexes.value[index + 1] = temp
  }
}

const handleExecuteSql = async (editedSql) => {
  if (
    !confirm('정말로 이 SQL 구문을 데이터베이스에 적용하시겠습니까? 이 작업은 되돌릴 수 없습니다.')
  )
    return

  try {
    const finalSql = typeof editedSql === 'string' ? editedSql : generatedSqlContent.value
    await executeSqlScript(tableInfo.value.tablen, finalSql)
    alert('DB에 정상적으로 적용되었습니다.')
    showSqlModal.value = false
    window.location.reload()
  } catch (error) {
    console.error('Error executing SQL:', error)
    alert(`실행 중 오류가 발생했습니다: ${error.response?.data?.error || error.message}`)
  }
}
</script>

<style scoped>
.tab-header {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid var(--app-border-color);
  margin-bottom: 20px;
}
.tab-btn {
  padding: 10px 20px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--app-secondary-color);
  font-weight: 600;
  margin-bottom: -2px;
  border-bottom: 2px solid transparent;
}
.tab-btn.active {
  color: var(--app-primary-color);
  border-bottom-color: var(--app-primary-color);
}
.tab-actions {
  margin-top: 16px;
  text-align: right;
}
</style>
