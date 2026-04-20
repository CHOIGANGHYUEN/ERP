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

    <AppCard v-if="savedWorlds.length > 0" style="margin-top: 24px">
      <h3 style="margin-top: 0; margin-bottom: 16px">저장된 월드 목록 (Mock Data)</h3>
      <table class="app-table modern-data-table">
        <thead>
          <tr>
            <th>월드명</th>
            <th>인구수</th>
            <th>생성일시</th>
            <th>조작</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="world in savedWorlds" :key="world.id">
            <td>{{ world.worldName }}</td>
            <td>
              <span class="badge-success">{{ world.population }}명</span>
            </td>
            <td>{{ new Date(world.createdAt).toLocaleString() }}</td>
            <td>
              <AppButton type="secondary" size="small" @click="loadWorldData(world)">
                이 월드 불러오기
              </AppButton>
            </td>
          </tr>
        </tbody>
      </table>
    </AppCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppPageTitle from '../common/components/AppPageTitle.vue'
import AppCard from '../common/components/AppCard.vue'
import AppButton from '../common/components/AppButton.vue'
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
const savedWorlds = ref([])

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

const loadWorldData = (world) => {
  const worldInstance = getWorldInstance()
  if (!worldInstance) return
  if (world.worldData && Array.isArray(world.worldData)) {
    worldInstance.loadCreatures(world.worldData)
  } else {
    // 💡 [병목 개선] 개체를 하나씩 소환하여 수천 개의 Worker 메시지를 쏘는 대신 일괄(Batch) 배열로 전달
    const dummyData = []
    for (let i = 0; i < world.population; i++) {
      dummyData.push({
        x: Math.random() * worldInstance.width,
        y: Math.random() * worldInstance.height,
      })
    }
    worldInstance.loadCreatures(dummyData)
  }
}

onMounted(() => {
  initWorker()
  handleLoad()
})
</script>
