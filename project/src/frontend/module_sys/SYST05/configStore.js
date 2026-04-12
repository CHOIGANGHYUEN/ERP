import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getConfigs } from '@/frontend/module_sys/api/configApi.js'

export const useConfigStore = defineStore('sysConfig', () => {
  // State
  const configs = ref([])
  const isLoaded = ref(false)

  // Getters
  // configId를 통해 설정값(configVal)을 즉시 찾아 반환하는 헬퍼 함수
  const getConfigValue = computed(() => {
    return (configId, defaultValue = null) => {
      const found = configs.value.find((c) => c.configId === configId && c.useYn === 1)
      return found && found.configVal ? found.configVal : defaultValue
    }
  })

  // Actions
  // App 초기 로드 시 1회만 호출되며, 강제 리로드가 필요할 땐 force = true 옵션 사용
  const fetchConfigs = async (force = false) => {
    if (isLoaded.value && !force) return

    try {
      // 전체 설정값을 가져와 캐싱
      const response = await getConfigs()
      configs.value = response.data || []
      isLoaded.value = true
      console.log('✅ System configs loaded and cached in Pinia Store.')
    } catch (error) {
      console.error('Failed to load system configs:', error)
    }
  }

  return {
    configs,
    isLoaded,
    getConfigValue,
    fetchConfigs,
  }
})
