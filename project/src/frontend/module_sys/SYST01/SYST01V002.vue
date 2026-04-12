<template>
  <div class="app-container">
    <AppPageTitle :title="isNew ? '사용자 등록 (Create User)' : '사용자 상세 (User Detail)'" />

    <AppCard>
      <form @submit.prevent="saveUser" class="modern-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">사용자 ID</label>
            <AppInput v-model="form.userId" required placeholder="예: admin@example.com" />
          </div>
        </div>

        <div class="form-actions">
          <AppButton type="secondary" @click="goBack" class="btn-cancel">목록</AppButton>
          <div class="right-actions">
            <AppButton v-if="!isNew" type="secondary" class="btn-danger" @click="deleteUser"
              >삭제</AppButton
            >
            <AppButton type="primary" @click.prevent="saveUser" class="btn-save">저장</AppButton>
          </div>
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
import {
  getUserDetail,
  saveUser as saveUserApi,
  deleteUser as deleteUserApi,
} from '../api/userApi.js'

const route = useRoute()
const router = useRouter()
const isNew = computed(() => route.params.id === 'new')

// 중복 저장 방지용 상태 플래그
const isSaving = ref(false)

const form = ref({
  id: null,
  userId: '',
})

onMounted(async () => {
  if (!isNew.value) {
    try {
      const data = await getUserDetail(route.params.id)
      form.value = data
    } catch (error) {
      console.error('Error fetching user:', error)
      alert('사용자 정보를 불러오는데 실패했습니다.')
      goBack()
    }
  }
})

const saveUser = async () => {
  if (isSaving.value) return // 이미 저장 중이면 함수 실행 차단
  isSaving.value = true

  try {
    await saveUserApi(form.value)
    alert('저장되었습니다.')
    goBack()
  } catch (error) {
    console.error('Error saving user:', error)
    alert(`저장에 실패했습니다: ${error.response?.data?.message || error.message || '오류 발생'}`)
    // 에러 발생 시에만 플래그를 해제하여 다시 시도할 수 있게 함
    isSaving.value = false
  }
}

const deleteUser = async () => {
  if (!confirm('정말 삭제하시겠습니까?')) return
  try {
    await deleteUserApi(route.params.id)
    alert('삭제되었습니다.')
    goBack()
  } catch (error) {
    console.error('Error deleting user:', error)
    alert('삭제에 실패했습니다.')
  }
}

const goBack = () => {
  router.push('/sys/syst01')
}
</script>
