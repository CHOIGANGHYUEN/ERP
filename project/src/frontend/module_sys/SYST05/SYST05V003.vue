<template>
  <div class="app-container">
    <AppPageTitle title="시스템 설정 삭제 (Delete Setting)" />

    <AppCard>
      <div v-if="config" class="modern-form">
        <div class="warning-message">
          <strong>⚠️ 경고:</strong> 정말로 아래의 시스템 설정을 삭제하시겠습니까? 이 작업은 되돌릴
          수 없으며 시스템 작동에 영향을 미칠 수 있습니다.
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">설정 ID</label>
            <AppInput :model-value="config.configId" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">설정명</label>
            <AppInput :model-value="config.configNm" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">설정값</label>
            <AppInput :model-value="config.configVal" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">상위 설정 ID</label>
            <AppInput :model-value="config.parentConfigId || '없음'" disabled />
          </div>
        </div>

        <div class="form-actions">
          <AppButton type="secondary" @click="goBack" class="btn-cancel"
            >취소 및 돌아가기</AppButton
          >
          <AppButton type="primary" class="btn-danger" @click.prevent="executeDelete">
            영구 삭제
          </AppButton>
        </div>
      </div>
      <div v-else style="text-align: center; padding: 40px">데이터를 불러오는 중입니다...</div>
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
import { getConfigDetail, deleteConfig } from '../api/configApi.js'
import { useConfigStore } from './configStore.js'

const route = useRoute()
const router = useRouter()
const configStore = useConfigStore()
const config = ref(null)

onMounted(async () => {
  try {
    const response = await getConfigDetail(route.params.id)
    config.value = response.data || response
  } catch (e) {
    alert('삭제할 설정 정보를 불러오지 못했습니다.')
    goBack()
  }
})

const executeDelete = async () => {
  try {
    await deleteConfig(route.params.id)
    alert('성공적으로 삭제되었습니다.')
    await configStore.fetchConfigs(true) // 삭제 후 전역 스토어 즉시 갱신
    router.push('/sys/syst05')
  } catch (error) {
    console.error('Error deleting config:', error)
    alert(`삭제에 실패했습니다: ${error.response?.data?.message || error.message}`)
  }
}

const goBack = () => {
  router.push(`/sys/syst05/${route.params.id}`)
}
</script>

<style scoped>
.warning-message {
  color: #ef4444;
  background-color: #fee2e2;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}
</style>
