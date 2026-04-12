<template>
  <div class="app-container">
    <AppPageTitle
      :title="isNew ? '시스템 설정 등록 (Create Setting)' : '시스템 설정 상세 (Setting Detail)'"
    />
    <AppCard>
      <form @submit.prevent="saveConfig" class="modern-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">언어</label>
            <AppInput v-model="form.langu" :disabled="!isNew" required placeholder="예: KO" />
          </div>
          <div class="form-group">
            <label class="form-label">설정 ID</label>
            <AppInput
              v-model="form.configId"
              :disabled="!isNew"
              required
              placeholder="예: THEME_MODE"
            />
          </div>
          <div class="form-group">
            <label class="form-label">설정명</label>
            <AppInput v-model="form.configNm" required placeholder="예: 기본 화면 테마" />
          </div>
          <div class="form-group">
            <label class="form-label">설정값</label>
            <!-- Y/N 옵션은 정적 셀렉트박스로 화면에서 통제 -->
            <div v-if="isYnField" class="select-wrapper">
              <select v-model="form.configVal" class="app-input modern-select">
                <option value="Y">Y (사용/허용)</option>
                <option value="N">N (미사용/차단)</option>
              </select>
            </div>
            <!-- 등록된 공통 코드가 있는 경우 동적 셀렉트박스 렌더링 -->
            <div v-else-if="codeOptions.length > 0" class="select-wrapper">
              <select v-model="form.configVal" class="app-input modern-select">
                <option value="">-- 선택 --</option>
                <option v-for="opt in codeOptions" :key="opt.subCode" :value="opt.subCode">
                  {{ opt.description }} ({{ opt.subCode }})
                </option>
              </select>
            </div>
            <!-- 그 외의 경우 일반 텍스트 입력 렌더링 -->
            <AppInput v-else v-model="form.configVal" placeholder="직접 값을 입력하세요" />
          </div>
          <div class="form-group">
            <label class="form-label">레벨</label>
            <AppInput type="number" v-model="form.configLevel" required />
          </div>
          <div class="form-group">
            <label class="form-label">정렬 순서</label>
            <AppInput type="number" v-model="form.ordNum" required />
          </div>
          <div class="form-group">
            <label class="form-label">상위 설정 ID</label>
            <AppInput v-model="form.parentConfigId" placeholder="상위 그룹 ID" />
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
          <AppButton type="secondary" @click="goBack" class="btn-cancel">목록</AppButton>
          <div class="right-actions">
            <AppButton v-if="!isNew" type="secondary" class="btn-danger" @click="goToDelete"
              >삭제</AppButton
            >
            <AppButton v-if="!isNew" type="secondary" @click="copyConfig">설정 복사</AppButton>
            <AppButton type="primary" @click.prevent="saveConfig" class="btn-save">저장</AppButton>
          </div>
        </div>
      </form>
    </AppCard>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import {
  getConfigDetail,
  // configApi.js에 있는 saveConfig를 가져와서 내부 함수명과 안 겹치게 alias를 줍니다.
  saveConfig as createConfigApi,
  updateConfig,
} from '../api/configApi.js'
import { getCodeHeadDetail } from '../api/codeApi.js'
import { useConfigStore } from './configStore.js'

const route = useRoute()
const router = useRouter()
const isNew = computed(() => route.params.id === 'new')

const isSaving = ref(false)
const configStore = useConfigStore()
const codeOptions = ref([])

const isYnField = computed(() => {
  const id = form.value.configId
  if (!id) return false
  return id.startsWith('MOD_') || id.endsWith('_USE') || id.includes('_ALLOW_')
})

const form = ref({
  langu: 'KO',
  configId: '',
  configNm: '',
  configVal: '',
  configLevel: 1,
  ordNum: 1,
  parentConfigId: '',
  useYn: 1,
})

const loadData = async () => {
  if (isNew.value) {
    // '설정 복사' 버튼을 통해 진입했을 경우, 기존 데이터 복사 (ID는 초기화)
    if (route.query.copyFrom) {
      try {
        const response = await getConfigDetail(route.query.copyFrom)
        form.value = { ...(response.data || response), configId: '' }
      } catch (error) {
        console.error('Error copying config:', error)
      }
    } else {
      form.value = {
        langu: 'KO',
        configId: '',
        configNm: '',
        configVal: '',
        configLevel: 1,
        ordNum: 1,
        parentConfigId: '',
        useYn: 1,
      }
    }
  } else {
    try {
      const response = await getConfigDetail(route.params.id)
      form.value = response.data || response
    } catch (error) {
      console.error('Error loading config:', error)
      alert('설정 정보를 불러오는데 실패했습니다.')
      goBack()
    }
  }
}

onMounted(loadData)
watch(() => route.fullPath, loadData)

const loadOptions = async (configId) => {
  codeOptions.value = []
  if (!configId) return

  // Y/N 통제 필드인 경우 불필요한 API 호출을 생략합니다.
  if (isYnField.value) return

  try {
    const data = await getCodeHeadDetail('SYS', configId)
    if (data && data.items) {
      codeOptions.value = data.items.filter((i) => i.useYn === 1)
    }
  } catch (e) {
    // 코드가 등록되지 않은 설정항목은 에러를 무시하고 일반 텍스트 인풋 렌더링 유지
    codeOptions.value = []
  }
}

watch(
  () => form.value.configId,
  (newVal) => loadOptions(newVal),
)

const copyConfig = () => {
  router.push({ path: '/sys/syst05/new', query: { copyFrom: route.params.id } })
}

const saveConfig = async () => {
  if (isSaving.value) return
  isSaving.value = true

  try {
    if (isNew.value) {
      await createConfigApi(form.value)
    } else {
      await updateConfig(route.params.id, form.value)
    }
    alert('저장되었습니다.')
    await configStore.fetchConfigs(true) // 변경된 설정을 즉시 전역 스토어에 반영
    goBack()
  } catch (error) {
    console.error('Error saving config:', error)
    alert(
      `저장에 실패했습니다: ${error.response?.data?.message || error.message || '알 수 없는 오류'}`,
    )
  } finally {
    isSaving.value = false
  }
}

const goToDelete = () => {
  router.push(`/sys/syst05/${route.params.id}/delete`)
}

const goBack = () => {
  router.push('/sys/syst05')
}
</script>
