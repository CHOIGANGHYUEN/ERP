<template>
  <div class="app-container">
    <AppPageTitle :title="id === 'new' ? '단위 등록' : '단위 상세'" />
    <AppCard>
      <form class="modern-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">단위 코드</label
            ><AppInput
              v-model="form.unit"
              :disabled="id !== 'new'"
              required
              placeholder="예: BOX"
            />
          </div>
          <div class="form-group">
            <label class="form-label">단위 명칭</label><AppInput v-model="form.unitNm" required />
          </div>
          <div class="form-group">
            <label class="form-label">기본 단위 여부</label>
            <div class="select-wrapper">
              <select v-model="form.baseUnitYn" class="app-input modern-select">
                <option :value="1">Y</option>
                <option :value="0">N</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">변환 기준 단위</label
            ><AppInput v-model="form.baseUnit" placeholder="예: EA" />
          </div>
          <div class="form-group">
            <label class="form-label">변환 비율</label
            ><AppInput type="number" step="0.00001" v-model="form.convRate" />
          </div>
          <div class="form-group">
            <label class="form-label">표시 순서</label
            ><AppInput type="number" v-model="form.dispOrd" />
          </div>
          <div class="form-group">
            <label class="form-label">사용 여부</label>
            <!-- DDL 스펙상 varchar(255) 이지만 실무 통일을 위해 '1'과 '0'으로 관리 -->
            <div class="select-wrapper">
              <select v-model="form.useYn" class="app-input modern-select">
                <option value="1">Y (사용)</option>
                <option value="0">N (미사용)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <AppButton type="secondary" @click="router.push('/sys/syst09')">목록</AppButton>
          <div class="right-actions">
            <AppButton v-if="id !== 'new'" type="secondary" class="btn-danger" @click.prevent="del"
              >삭제</AppButton
            >
            <AppButton type="primary" @click.prevent="save">저장</AppButton>
          </div>
        </div>
      </form>
    </AppCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import { getUnitDetail, saveUnit, deleteUnit } from '../api/unitApi.js'

const route = useRoute(),
  router = useRouter()
const id = route.params.id
const form = ref({}),
  isSaving = ref(false)

onMounted(async () => (form.value = await getUnitDetail(id)))

const save = async () => {
  if (isSaving.value) return
  isSaving.value = true
  try {
    await saveUnit(form.value)
    alert('저장되었습니다.')
    router.push('/sys/syst09')
  } catch (e) {
    alert(e.response?.data?.message || '오류 발생')
  } finally {
    isSaving.value = false
  }
}
const del = async () => {
  if (confirm('삭제하시겠습니까?')) {
    await deleteUnit(id)
    router.push('/sys/syst09')
  }
}
</script>
