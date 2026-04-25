<template>
  <div class="app-container">
    <AppPageTitle title="월드박스 미니게임 (Mock 버젼)" />

    <div class="game-wrapper">
      <canvas
        ref="gameCanvas"
        width="1280"
        height="720"
        class="game-canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @click="handleCanvasClick"
        @wheel.prevent="handleWheel"
      ></canvas>

      <GameTopHud
        :showTopUI="showTopUI"
        :population="population"
        :displayTime="displayTime"
        :season="season"
        :fertility="fertility"
        :maxFertility="maxFertility"
        @save="handleSave"
        @load="handleLoad"
      />

      <div class="hud-left hud-panel custom-scroll" v-if="showInspectorPanel">
        <GameInspector v-if="selectedEntityData" :entity-data="selectedEntityData" />
      </div>

      <div class="hud-right custom-scroll" v-if="showInteractionPanel">
        <GameInteractionPanel
          v-if="worldInstanceReady"
          :world-inventory="worldInventory"
          :world="getWorldInstance()"
        />
      </div>

      <div class="hud-bottom-left" v-if="showLogsPanel">
        <GameChatLog :logs="chatLogs" />
      </div>

      <GameToolMenu
        v-model:showToolMenu="showToolMenu"
        v-model:showTopUI="showTopUI"
        v-model:showInspectorPanel="showInspectorPanel"
        v-model:showInteractionPanel="showInteractionPanel"
        v-model:showLogsPanel="showLogsPanel"
        v-model:showMinimapPanel="showMinimapPanel"
        v-model:showTerritoryLayer="showTerritoryLayer"
        v-model:showVillageArea="showVillageArea"
        :activeTool="activeTool"
        @toggleTool="toggleTool"
        @handleAction="handleAction"
      />

      <div class="hud-bottom-right" v-if="showMinimapPanel">
        <GameMinimap
          v-if="worldInstanceReady"
          :world="getWorldInstance()"
          :map-width="mapWidth"
          :map-height="mapHeight"
          :zoom-level="zoomLevel"
          :game-canvas="gameCanvas"
          @sync-camera="syncCameraToWorker"
        />
      </div>
    </div>

    <!-- [UI Clean-up] 하단 저장된 월드 목록 제거 -->
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted } from 'vue'
import AppPageTitle from '../common/components/AppPageTitle.vue'
import { saveWorld, loadWorlds } from './api/gameApi.js'

// Sub-components
import GameInteractionPanel from './components/GameInteractionPanel.vue'
import GameInspector from './components/GameInspector.vue'
import GameMinimap from './components/GameMinimap.vue'
import GameChatLog from './components/GameChatLog.vue'
import GameTopHud from './components/GameTopHud.vue'
import GameToolMenu from './components/GameToolMenu.vue'

// Composables (Logic Extracted)
import { useGameWorker } from './composables/useGameWorker.js'
import { useGameCamera } from './composables/useGameCamera.js'
import { useGameTools } from './composables/useGameTools.js'
import { useGameInteraction } from './composables/useGameInteraction.js'

const gameCanvas = ref(null)
const savedWorlds = shallowRef([]) // 💡 [Reactivity 최적화] 거대한 JSON 데이터 Deep Proxy 방지

// 1. Worker & World State (Shared Logic)
const {
  worldInstanceReady,
  getWorldInstance,
  initWorker,
  selectedEntityData,
  worldInventory,
  chatLogs,
  population,
  fertility,
  maxFertility,
  season,
  displayTime,
  zoomLevel,
  mapWidth,
  mapHeight,
  requestWorldSaveData,
} = useGameWorker(gameCanvas)

// 2. Tools & UI Menus Logic
const {
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
  handleAction,
} = useGameTools(getWorldInstance)

// 3. Camera (Drag/Zoom) Logic
const {
  isClickDrag,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  syncCameraToWorker,
} = useGameCamera(worldInstanceReady, getWorldInstance, gameCanvas)

// 4. Interaction (Clicking canvas) Logic
const { handleCanvasClick } = useGameInteraction(
  getWorldInstance,
  gameCanvas,
  activeTool,
  isClickDrag,
  selectedEntityData,
)

// API Handlers
const handleSave = async () => {
  const worldData = await requestWorldSaveData()
  if (!worldData || worldData.length === 0) {
    alert('저장할 월드 데이터가 없거나 워커가 응답하지 않습니다.')
    return
  }
  try {
    await saveWorld({
      worldName: `Mock World ${new Date().toLocaleTimeString()}`,
      population: population.value,
      worldData,
    })
    alert('월드가 성공적으로 저장되었습니다.')
    handleLoad()
  } catch (error) {
    console.error(error)
    alert('저장 실패')
  }
}

const handleLoad = async () => {
  try {
    const response = await loadWorlds()
    savedWorlds.value = response.data?.data || response.data || []
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  initWorker()
  handleLoad()
})
</script>
