<template>
  <div class="app-container">
    <AppPageTitle :title="isNew ? '공통 코드 등록' : '공통 코드 상세'" />

    <!-- Master Area: Code Head -->
    <AppCard class="master-card">
      <div class="card-header">
        <h3 class="card-title">코드 마스터 정보 (Code Head)</h3>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">카테고리 코드</label>
          <AppInput v-model="headInfo.categoryCode" :disabled="!isNew" placeholder="예: SYS" />
        </div>
        <div class="form-group">
          <label class="form-label">그룹 코드</label>
          <AppInput v-model="headInfo.groupCode" :disabled="!isNew" placeholder="예: USER_ROLE" />
        </div>
        <div class="form-group" style="grid-column: span 2">
          <label class="form-label">설명</label>
          <AppInput v-model="headInfo.description" placeholder="해당 코드 그룹의 용도 설명" />
        </div>
        <div class="form-group">
          <label class="form-label">사용 여부</label>
          <div class="select-wrapper">
            <select v-model="headInfo.useYn" class="app-input modern-select">
              <option :value="1">Y</option>
              <option :value="0">N</option>
            </select>
          </div>
        </div>
      </div>

      <div style="margin-top: 24px">
        <h4 class="section-subtitle">동적 확장 필드 명칭 설정 (최대 10개)</h4>
        <p class="section-desc">
          입력된 필드명은 하위 상세 코드의 추가 속성 컬럼으로 자동 활성화됩니다.
        </p>
        <div class="field-names-grid">
          <div class="form-group" v-for="i in 10" :key="'fn' + i">
            <label class="form-label">필드명 {{ i }}</label>
            <AppInput
              v-model="headInfo['fieldNm' + i]"
              :placeholder="i === 1 ? '예: 약어, 확장코드' : `필드 ${i} 용도`"
            />
          </div>
        </div>
      </div>

      <div class="form-actions">
        <AppButton type="secondary" @click="goBack" class="btn-cancel">목록</AppButton>
        <div class="right-actions">
          <AppButton v-if="!isNew" type="secondary" class="btn-danger" @click="deleteCodeGroup"
            >삭제</AppButton
          >
          <AppButton type="primary" @click="saveCodeGroup">저장</AppButton>
        </div>
      </div>
    </AppCard>

    <!-- Detail Area: Code Items -->
    <AppCard class="detail-card">
      <div class="card-header">
        <h3 class="card-title">상세 코드 데이터 (Code Items)</h3>
      </div>
      <div class="table-responsive">
        <table class="app-table modern-data-table">
          <thead>
            <tr>
              <th>서브 코드 *</th>
              <th>설명</th>
              <th style="width: 80px; text-align: center">사용</th>
              <th v-for="f in activeFields" :key="'th-' + f.key">{{ f.label }}</th>
              <th style="width: 80px; text-align: center">작업</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in items" :key="index">
              <td><AppInput v-model="item.subCode" required /></td>
              <td><AppInput v-model="item.description" /></td>
              <td style="text-align: center">
                <input
                  type="checkbox"
                  v-model="item.useYn"
                  :true-value="1"
                  :false-value="0"
                  class="modern-checkbox"
                />
              </td>
              <td v-for="f in activeFields" :key="'td-' + f.key + index">
                <AppInput v-model="item[f.key]" />
              </td>
              <td style="text-align: center">
                <button class="icon-btn danger" @click.prevent="removeItem(index)" title="삭제">
                  ✕
                </button>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td :colspan="4 + activeFields.length" class="empty-state">
                등록된 하위 코드가 없습니다.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top: 16px; text-align: right">
        <AppButton type="secondary" @click="addItem">+ 아이템 추가</AppButton>
      </div>
    </AppCard>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import {
  getCodeHeadDetail,
  saveCodeGroup as saveCodeGroupApi,
  deleteCodeGroup as deleteCodeGroupApi,
} from '../api/codeApi.js'

const route = useRoute()
const router = useRouter()

// '/sys/syst04/new' 또는 '/sys/syst04/detail?categoryCode=...&groupCode=...'
const isNew = computed(() => !route.query.categoryCode)

const headInfo = ref({
  categoryCode: '',
  groupCode: '',
  description: '',
  useYn: 1,
  fieldNm1: '',
  fieldNm2: '',
  fieldNm3: '',
  fieldNm4: '',
  fieldNm5: '',
  fieldNm6: '',
  fieldNm7: '',
  fieldNm8: '',
  fieldNm9: '',
  fieldNm10: '',
})

const items = ref([])

// 마스터에서 이름이 부여된 필드만 동적으로 추출하여 그리드 컬럼으로 사용
const activeFields = computed(() => {
  const fields = []
  for (let i = 1; i <= 10; i++) {
    const name = headInfo.value[`fieldNm${i}`]
    if (name && name.trim() !== '') {
      fields.push({ key: `field${i}`, label: name.trim() })
    }
  }
  return fields
})

onMounted(async () => {
  if (!isNew.value) {
    const { categoryCode, groupCode } = route.query
    try {
      const data = await getCodeHeadDetail(categoryCode, groupCode)
      headInfo.value = data.headInfo
      items.value = data.items.map((i) => ({ ...i, useYn: i.useYn ?? 1 })) // Checkbox mapping
    } catch (error) {
      console.error('Error fetching code detail:', error)
      alert('데이터를 가져오는데 실패했습니다.')
    }
  }
})

const addItem = () => {
  items.value.push({
    subCode: '',
    description: '',
    useYn: 1,
    field1: '',
    field2: '',
    field3: '',
    field4: '',
    field5: '',
    field6: '',
    field7: '',
    field8: '',
    field9: '',
    field10: '',
  })
}

const removeItem = (index) => {
  items.value.splice(index, 1)
}

const saveCodeGroup = async () => {
  if (!headInfo.value.categoryCode || !headInfo.value.groupCode) {
    return alert('카테고리 코드와 그룹 코드는 필수입니다.')
  }
  try {
    const payload = {
      headInfo: headInfo.value,
      items: items.value,
    }
    await saveCodeGroupApi(payload)
    alert('정상적으로 저장되었습니다.')
    if (isNew.value) {
      router.push({
        path: '/sys/syst04/detail',
        query: { categoryCode: headInfo.value.categoryCode, groupCode: headInfo.value.groupCode },
      })
    }
  } catch (error) {
    console.error('Save error:', error)
    alert(`저장 중 오류가 발생했습니다: ${error.response?.data?.message || error.message}`)
  }
}

const deleteCodeGroup = async () => {
  if (!confirm('해당 그룹의 모든 코드가 삭제됩니다. 정말 삭제하시겠습니까?')) return
  try {
    await deleteCodeGroupApi(headInfo.value.categoryCode, headInfo.value.groupCode)
    alert('삭제되었습니다.')
    goBack()
  } catch (error) {
    console.error('Delete error:', error)
    alert('삭제에 실패했습니다.')
  }
}

const goBack = () => {
  router.push('/sys/syst04')
}
</script>

<style scoped>
.field-names-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  background-color: #f8fafc;
  padding: 16px;
  border-radius: 8px;
}
.section-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 4px 0;
}
.section-desc {
  font-size: 0.85rem;
  color: var(--app-secondary-color);
  margin: 0 0 16px 0;
}
</style>
