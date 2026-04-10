<template>
  <div>
    <AppPageTitle
      :title="isNew ? '시스템 설정 등록 (Create Setting)' : '시스템 설정 상세 (Setting Detail)'"
    />
    <AppCard>
      <form @submit.prevent="saveConfig">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px">
          <div>
            <label style="display: block; margin-bottom: 4px; font-weight: bold"
              >설정 ID (Config ID)</label
            >
            <AppInput v-model="form.configId" :disabled="!isNew" required />
          </div>
          <div>
            <label style="display: block; margin-bottom: 4px; font-weight: bold"
              >설정명 (Name)</label
            >
            <AppInput v-model="form.configName" required />
          </div>
          <div style="grid-column: span 2">
            <label style="display: block; margin-bottom: 4px; font-weight: bold"
              >설정값 (Value)</label
            >
            <AppInput v-model="form.configValue" required />
          </div>
          <div style="grid-column: span 2">
            <label style="display: block; margin-bottom: 4px; font-weight: bold"
              >설명 (Description)</label
            >
            <AppInput v-model="form.description" />
          </div>
          <div>
            <label style="display: block; margin-bottom: 4px; font-weight: bold"
              >사용 여부 (Use Y/N)</label
            >
            <select
              v-model="form.useYn"
              style="
                width: 100%;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid var(--app-border-color);
                background-color: var(--app-surface-color);
                color: var(--app-text-color);
              "
            >
              <option :value="1">Y</option>
              <option :value="0">N</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <AppButton type="secondary" type-button="button" @click="goBack">목록</AppButton>
          <AppButton
            v-if="!isNew"
            type="secondary"
            style="background-color: #dc3545; color: white; border-color: #dc3545"
            type-button="button"
            @click="deleteConfig"
            >삭제</AppButton
          >
          <AppButton type="primary" type-button="submit">저장</AppButton>
        </div>
      </form>
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

const route = useRoute()
const router = useRouter()
const isNew = computed(() => route.params.id === 'new')

const form = ref({
  configId: '',
  configName: '',
  configValue: '',
  useYn: 1,
  description: '',
})

onMounted(async () => {
  if (!isNew.value) {
    try {
      const response = await fetch(`/api/sys/configs/${route.params.id}`)
      if (response.ok) {
        form.value = await response.json()
      } else {
        alert('설정 정보를 불러오는데 실패했습니다.')
        goBack()
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }
})

const saveConfig = async () => {
  try {
    const url = isNew.value ? '/api/sys/configs' : `/api/sys/configs/${route.params.id}`
    const method = isNew.value ? 'POST' : 'PUT'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    if (response.ok) {
      alert('저장되었습니다.')
      goBack()
    } else {
      const errorData = await response.json()
      alert(`저장에 실패했습니다: ${errorData.message}`)
    }
  } catch (error) {
    console.error('Error saving config:', error)
    alert('저장 중 오류가 발생했습니다.')
  }
}

const deleteConfig = async () => {
  if (!confirm('정말 삭제하시겠습니까?')) return

  try {
    const response = await fetch(`/api/sys/configs/${route.params.id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      alert('삭제되었습니다.')
      goBack()
    } else {
      const errorData = await response.json()
      alert(`삭제에 실패했습니다: ${errorData.message}`)
    }
  } catch (error) {
    console.error('Error deleting config:', error)
    alert('삭제 중 오류가 발생했습니다.')
  }
}

const goBack = () => {
  router.push('/sys/settings')
}
</script>
