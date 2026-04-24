import { ref, watch } from 'vue'

export function useGameTools(getWorldInstance) {
  const activeTool = ref(null)
  
  const showToolMenu = ref(false)
  const showTopUI = ref(false)
  const showInspectorPanel = ref(true)
  const showInteractionPanel = ref(false)
  const showLogsPanel = ref(true)
  const showMinimapPanel = ref(false)
  const showTerritoryLayer = ref(true)

  // 💡 [Sync Settings] UI의 레이어 토글 상태를 엔진의 settings 객체와 동기화
  watch(showTerritoryLayer, (val) => {
    const worldInstance = getWorldInstance()
    if (worldInstance && worldInstance.settings) {
      worldInstance.settings.showTerritory = val
    }
  })

  const showVillageArea = ref(true)
  watch(showVillageArea, (val) => {
    const worldInstance = getWorldInstance()
    if (worldInstance && worldInstance.settings) {
      worldInstance.settings.showVillageArea = val
    }
  })

  const toggleTool = (toolName) => {
    if (activeTool.value === toolName) {
      activeTool.value = null
    } else {
      activeTool.value = toolName
    }
  }

  const handleAction = (action) => {
    const worldInstance = getWorldInstance()
    if (!worldInstance) return
    switch (action) {
      case 'earthquake':
        worldInstance.triggerEarthquake()
        break
      case 'fertility':
        worldInstance.addFertility(5000)
        break
      case 'weather_clear':
        worldInstance.setWeather('clear')
        break
      case 'weather_rain':
        worldInstance.setWeather('rain')
        break
      case 'weather_fog':
        worldInstance.setWeather('fog')
        break
    }
  }

  return {
    activeTool,
    showToolMenu,
    showTopUI,
    showInspectorPanel,
    showInteractionPanel,
    showLogsPanel,
    showMinimapPanel,
    showTerritoryLayer,
    showVillageArea,
    toggleTool,
    handleAction
  }
}
