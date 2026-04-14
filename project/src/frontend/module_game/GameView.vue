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

      <!-- 상단 HUD (통계 및 시스템 버튼) -->
      <div class="hud-top">
        <div class="hud-top-left action-buttons">
          <AppButton type="secondary" @click="handleSave">월드 저장</AppButton>
          <AppButton type="secondary" @click="handleLoad">월드 목록 새로고침</AppButton>
        </div>
        <div class="hud-top-right">
          <span class="badge-success">현재 인구: {{ population }}명</span>
          <span
            class="badge-primary"
            style="
              background: rgba(30, 40, 50, 0.9);
              color: white;
              border: 1px solid rgba(255, 255, 255, 0.2);
            "
          >
            🕒 {{ displayTime }} ({{ getSeasonName(season) }})
          </span>
          <span class="badge-warning"
            >대지 비옥도: {{ Math.floor(fertility) }} / {{ maxFertility }}</span
          >
        </div>
      </div>

      <!-- 좌측 HUD: 상태창 (Inspector) -->
      <div class="hud-left hud-panel custom-scroll">
        <GameInspector v-if="selectedEntityData" :entity-data="selectedEntityData" />
      </div>

      <!-- 우측 HUD: 상호작용 패널 -->
      <div class="hud-right custom-scroll">
        <GameInteractionPanel
          v-if="worldInstanceReady"
          :world-inventory="worldInventory"
          :world="worldInstance"
          v-model:spawnType="currentSpawnType"
        />
      </div>

      <!-- 좌측 하단 채팅/이벤트 로그 -->
      <GameChatLog :logs="chatLogs" />

      <!-- 우측 하단 미니 정보 -->
      <div class="hud-bottom-right">
        <GameMinimap
          v-if="worldInstanceReady"
          :world="worldInstance"
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import AppPageTitle from '../common/components/AppPageTitle.vue'
import AppCard from '../common/components/AppCard.vue'
import AppButton from '../common/components/AppButton.vue'
import { World } from './engine/core/World.js'
import { setupDI } from './di/providers/setupDI.js'
import { saveWorld, loadWorlds } from './api/gameApi.js'
import { Village } from './engine/objects/society/Village.js' // 필요시 import
import GameInteractionPanel from './components/GameInteractionPanel.vue'
import GameInspector from './components/GameInspector.vue'
import GameMinimap from './components/GameMinimap.vue'
import GameChatLog from './components/GameChatLog.vue'

const gameCanvas = ref(null)
let worldInstance = null
const worldInstanceReady = ref(false)
const population = ref(0)
const fertility = ref(0)
const maxFertility = ref(0)
const mapWidth = ref(0)
const mapHeight = ref(0)
const savedWorlds = ref([])
const currentSpawnType = ref('human')
const displayTime = ref('08:00')
const zoomLevel = ref(100)
const season = ref('SPRING')
const selectedEntityData = ref(null)
const worldInventory = ref(null)
const chatLogs = ref([])
let popInterval = null

let gameWorker = null

// Shared buffer indices mappings
const INDEX_CREATURE_COUNT = 0
const INDEX_FERTILITY = 8
const INDEX_TIME_OF_DAY = 9
const INDEX_SEASON = 10

// 카메라 드래그 판별용 변수
let isClickDrag = false

onMounted(() => {
  if (gameCanvas.value) {
    gameWorker = new Worker(new URL('./engine/worker/game.worker.js', import.meta.url), {
      type: 'module',
    })
    worldInstance = new World(setupDI(), gameCanvas.value)
    worldInstanceReady.value = true
    mapWidth.value = worldInstance.width
    mapHeight.value = worldInstance.height

    // Worker Proxy 연동
    worldInstance.onProxyAction = (msg) => {
      gameWorker.postMessage(msg)
    }

    // Worker 데이터 수신 및 렌더링
    gameWorker.onmessage = (e) => {
      const { type, payload } = e.data
      if (type === 'INIT_BUFFERS') {
        // [SAB] Worker로부터 SharedArrayBuffer를 받아 월드(렌더러) 초기화
        worldInstance.initSharedState(payload)
        worldInstance.start() // 렌더링 루프 시작
      } else if (type === 'SYNC') {
        // [SAB] Worker로부터 동기화 신호를 받으면 메인 스레드에서 렌더링만 수행
        // 데이터는 버퍼를 통해 직접 공유되므로 payload가 필요 없음
        // worldInstance.loop는 requestAnimationFrame으로 이미 돌고 있으므로 별도 호출 불필요
      } else if (type === 'VILLAGE_DETAILS') {
        // [SAB] Worker로부터 받은 마을 상세 정보(이름, 인벤토리 등)를 병합
        if (selectedEntityData.value && selectedEntityData.value.id === payload.id) {
          // 기존 버퍼 데이터에 상세 페이로드를 덮어씀
          const newEntityData = { ...selectedEntityData.value, ...payload }
          selectedEntityData.value = newEntityData
          if (payload.nation) {
            worldInstance.onProxyAction({
              type: 'GET_NATION_DETAILS',
              payload: { id: payload.nation.id },
            })
          }
        }
      } else if (type === 'NATION_DETAILS') {
        if (selectedEntityData.value?.nation?.id === payload.id) {
          const newNationData = { ...selectedEntityData.value.nation, ...payload }
          selectedEntityData.value = { ...selectedEntityData.value, nation: newNationData }
        }
      } else if (type === 'WORLD_INVENTORY_DETAILS') {
        // [SAB] Worker로부터 받은 월드 전체 인벤토리 정보
        worldInventory.value = payload
      } else if (type === 'SPEECH_BUBBLE') {
        worldInstance.showSpeechBubble(
          payload.entityId,
          payload.entityType,
          payload.text,
          payload.duration,
        )
        const timeStr = new Date().toLocaleTimeString('ko-KR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        chatLogs.value.push({
          time: timeStr,
          sender: payload.entityType === 'creature' ? `주민 ${payload.entityId || ''}` : '시스템',
          text: payload.text,
          color: '#ecf0f1',
        })
        if (chatLogs.value.length > 100) chatLogs.value.shift() // 로그 최대 100개 유지
      } else if (type === 'SYSTEM_MESSAGE') {
        const timeStr = new Date().toLocaleTimeString('ko-KR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        chatLogs.value.push({
          time: timeStr,
          sender: '시스템 알림',
          text: payload.text,
          color: payload.color || '#f1c40f',
        })
        if (chatLogs.value.length > 100) chatLogs.value.shift()
      }
    }

    gameWorker.postMessage({ type: 'INIT' })

    popInterval = setInterval(() => {
      if (worldInstance && worldInstance.views) {
        const globals = worldInstance.views.globals
        population.value = globals[INDEX_CREATURE_COUNT]
        fertility.value = globals[INDEX_FERTILITY]
        maxFertility.value = worldInstance.maxFertility
        season.value = Object.keys({ SPRING: 0, SUMMER: 1, AUTUMN: 2, WINTER: 3 })[
          globals[INDEX_SEASON]
        ]
        // 카메라 줌 레벨 추적 (기본 1.0 = 100%)
        zoomLevel.value = Math.round((worldInstance.camera.zoom || 1) * 100)
        // 시간 표시 포맷팅 (0~24000)
        const hours = Math.floor(globals[INDEX_TIME_OF_DAY] / 1000)
          .toString()
          .padStart(2, '0')
        displayTime.value = `${hours}:00`
        updateSelectedEntityData() // SAB 기반으로 데이터 갱신
      }
    }, 200)
  }
  handleLoad() // 초기 목업 데이터 목록 로드
})

onBeforeUnmount(() => {
  if (gameWorker) gameWorker.terminate()
  if (popInterval) clearInterval(popInterval)
})

// Camera Mouse Controls
const handleMouseDown = (e) => {
  if (!worldInstance) return
  worldInstance.camera.handleMouseDown(e)
  gameCanvas.value.style.cursor = 'grabbing'
  isClickDrag = false
}

const handleMouseMove = (e) => {
  if (!worldInstance || !worldInstance.camera.isDragging) return

  // 마우스 미세 흔들림 방지 (드래그 임계값 설정)
  const dx = Math.abs(e.clientX - worldInstance.camera.lastMouseX)
  const dy = Math.abs(e.clientY - worldInstance.camera.lastMouseY)
  if (dx > 3 || dy > 3) {
    isClickDrag = true
  }

  worldInstance.camera.handleMouseMove(e)
  syncCameraToWorker() // 패닝 중에도 Worker에 실시간 동기화
}

// Worker 동기화로 인한 카메라 리셋 방지용: 상태 강제 갱신
const syncCameraToWorker = () => {
  if (worldInstance && worldInstance.onProxyAction) {
    worldInstance.onProxyAction({
      type: 'CAMERA_UPDATE',
      payload: {
        x: worldInstance.camera.x,
        y: worldInstance.camera.y,
        zoom: worldInstance.camera.zoom,
      },
    })
  }
}

const handleMouseUp = (e) => {
  if (!worldInstance) return
  worldInstance.camera.handleMouseUp()
  if (gameCanvas.value) gameCanvas.value.style.cursor = 'grab'
}

// Camera Wheel Zoom Controls
const handleWheel = (e) => {
  if (!worldInstance) return

  // 엔진(World) 내부의 Camera 객체로 이벤트 위임
  worldInstance.camera.handleWheel(e)

  // 변경된 줌과 카메라 위치를 Worker 엔진에 즉각 브로드캐스팅
  syncCameraToWorker()
}

const handleCanvasClick = (event) => {
  if (!worldInstance || !gameCanvas.value || isClickDrag) return

  const rect = gameCanvas.value.getBoundingClientRect()
  const scaleX = gameCanvas.value.width / rect.width
  const scaleY = gameCanvas.value.height / rect.height
  const mouseX = (event.clientX - rect.left) * scaleX
  const mouseY = (event.clientY - rect.top) * scaleY

  const clickedEntity = worldInstance.getEntityAt(mouseX, mouseY)

  if (clickedEntity) {
    worldInstance.selectedEntity = clickedEntity
    const data = worldInstance.getDataFromBuffer(clickedEntity._type, clickedEntity.id)
    selectedEntityData.value = data
    if (data && data.isVillage) {
      worldInstance.onProxyAction({
        type: 'GET_VILLAGE_DETAILS',
        payload: { id: clickedEntity.id },
      })
    }
  } else {
    // 빈 공간을 클릭하면 선택 해제 후, 현재 선택된 소환 타입에 따라 개체 소환
    worldInstance.selectedEntity = null
    selectedEntityData.value = null

    const currentZoom = worldInstance.camera.zoom || 1
    const worldX = mouseX / currentZoom + worldInstance.camera.x
    const worldY = mouseY / currentZoom + worldInstance.camera.y

    // 선택된 개체 타입에 따라 클릭한 좌표에 소환
    switch (currentSpawnType.value) {
      case 'human':
        worldInstance.spawnCreature(worldX, worldY)
        break
      case 'herbivore':
        worldInstance.spawnAnimal(worldX, worldY, 'HERBIVORE')
        break
      case 'carnivore':
        worldInstance.spawnAnimal(worldX, worldY, 'CARNIVORE')
        break
      case 'tree':
        worldInstance.spawnPlant(worldX, worldY, 'tree')
        break
      case 'crop':
        worldInstance.spawnPlant(worldX, worldY, 'crop')
        break
    }
  }
}

const updateSelectedEntityData = () => {
  // [SAB] selectedEntity는 이제 { _type: 'creature', id: 123 } 형태의 객체
  const ent = worldInstance.selectedEntity
  if (!worldInstance || !ent) {
    selectedEntityData.value = null
    return
  }

  const bufferedData = worldInstance.getDataFromBuffer(ent._type, ent.id)
  if (!bufferedData || bufferedData.isDead) {
    worldInstance.selectedEntity = null
    selectedEntityData.value = null
    return
  }

  // 마을의 경우, 이전에 비동기로 받아온 상세 정보(name, inventory)가 있다면 유지하고,
  // 실시간으로 변하는 값(population 등)만 버퍼에서 덮어쓴다.
  if (bufferedData.isVillage && selectedEntityData.value?.id === bufferedData.id) {
    selectedEntityData.value = { ...selectedEntityData.value, ...bufferedData }
  } else {
    // 다른 개체거나, 아직 상세 정보가 없는 마을은 버퍼 데이터로 바로 덮어쓴다.
    selectedEntityData.value = bufferedData
    // 마을이 새로 선택된 경우, 상세 정보를 요청
    if (bufferedData.isVillage) {
      worldInstance.onProxyAction({ type: 'GET_VILLAGE_DETAILS', payload: { id: ent.id } })
    }
  }
}

const getSeasonName = (s) => {
  const map = { SPRING: '봄 🌸', SUMMER: '여름 ☀️', AUTUMN: '가을 🍂', WINTER: '겨울 ❄️' }
  return map[s] || s
}

const handleSave = async () => {
  if (!worldInstance) return
  const worldData = worldInstance.creatures.map((c) => ({
    x: c.x,
    y: c.y,
    color: c.color,
    age: c.age,
    profession: c.profession,
  }))
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
  if (!worldInstance) return
  if (world.worldData && Array.isArray(world.worldData)) {
    worldInstance.loadCreatures(world.worldData)
  } else {
    // 데이터가 유실되었거나 없을 경우 개수만큼 랜덤 생성
    worldInstance.creatures = []
    for (let i = 0; i < world.population; i++) {
      worldInstance.spawnCreature(
        Math.random() * worldInstance.width,
        Math.random() * worldInstance.height,
      )
    }
  }
}
</script>
