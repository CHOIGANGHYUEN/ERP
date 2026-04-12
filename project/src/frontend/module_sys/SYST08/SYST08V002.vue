<template>
  <div class="app-container">
    <AppPageTitle :title="id === 'new' ? '사업장 등록' : '사업장 상세'" />
    <AppCard>
      <form class="modern-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">회사 코드</label
            ><AppInput v-model="form.company" :disabled="id !== 'new'" required />
          </div>
          <div class="form-group">
            <label class="form-label">공장 코드</label
            ><AppInput v-model="form.plant" :disabled="id !== 'new'" required />
          </div>
          <div class="form-group">
            <label class="form-label">사업자번호</label><AppInput v-model="form.regNo" />
          </div>
          <div class="form-group">
            <label class="form-label">전화번호</label><AppInput v-model="form.telNo" />
          </div>
          <div class="form-group">
            <label class="form-label">우편번호</label><AppInput v-model="form.zipCode" />
          </div>
          <div class="form-group">
            <label class="form-label">기본 주소</label><AppInput v-model="form.addr" />
          </div>
          <div class="form-group">
            <label class="form-label">상세 주소</label><AppInput v-model="form.addrDetail" />
          </div>
          <div class="form-group">
            <label class="form-label">사용 여부</label>
            <div class="select-wrapper">
              <select v-model="form.useYn" class="app-input modern-select">
                <option :value="1">Y (사용)</option>
                <option :value="0">N (미사용)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <AppButton type="secondary" @click="router.push('/sys/syst08')">목록</AppButton>
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
import { getPlantDetail, savePlant, deletePlant } from '../api/plantApi.js'

const route = useRoute(),
  router = useRouter()
const id = route.params.id
const form = ref({}),
  isSaving = ref(false)

onMounted(async () => (form.value = await getPlantDetail(id)))

const save = async () => {
  if (isSaving.value) return
  isSaving.value = true
  try {
    await savePlant(form.value)
    alert('저장되었습니다.')
    router.push('/sys/syst08')
  } catch (e) {
    alert(e.response?.data?.message || '오류 발생')
  } finally {
    isSaving.value = false
  }
}
const del = async () => {
  if (confirm('삭제하시겠습니까?')) {
    await deletePlant(id)
    router.push('/sys/syst08')
  }
}
</script>
