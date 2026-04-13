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
      <div v-if="selectedEntityData" class="hud-left hud-panel custom-scroll">
        <h4
          style="
            margin: 0 0 12px 0;
            color: #fff;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding-bottom: 8px;
          "
        >
          🔍 개체 관찰 (Inspector)
        </h4>

        <template v-if="selectedEntityData.isVillage">
          <!-- 마을 정보 -->
          <div class="app-grid" style="font-size: 0.95rem; gap: 12px">
            <div class="app-grid-item">
              <strong>마을 이름:</strong> {{ selectedEntityData.name }}
            </div>
            <div class="app-grid-item" v-if="selectedEntityData.nation">
              <strong>국가:</strong>
              <span :style="{ color: selectedEntityData.nation.color, fontWeight: 'bold' }">{{
                selectedEntityData.nation.name
              }}</span>
            </div>
            <div class="app-grid-item">
              <strong>인구:</strong> {{ selectedEntityData.population }}명
            </div>
            <div class="app-grid-item">
              <strong>건물:</strong> {{ selectedEntityData.buildings }}채
            </div>
            <div class="app-grid-item" style="color: #2ecc71">
              <strong>식량 🧺:</strong>
              {{
                Math.floor(
                  selectedEntityData.inventory.food || selectedEntityData.inventory.biomass || 0,
                )
              }}
            </div>
            <div class="app-grid-item" style="color: #e67e22">
              <strong>목재 🪓:</strong> {{ Math.floor(selectedEntityData.inventory.wood || 0) }}
            </div>
            <div class="app-grid-item" style="color: #bdc3c7">
              <strong>석재 🪨:</strong> {{ Math.floor(selectedEntityData.inventory.stone || 0) }}
            </div>
            <div class="app-grid-item" style="color: #e67e22">
              <strong>철광 ⛏️:</strong> {{ Math.floor(selectedEntityData.inventory.iron || 0) }}
            </div>
            <div class="app-grid-item" style="color: #f1c40f">
              <strong>금 💰:</strong> {{ Math.floor(selectedEntityData.inventory.gold || 0) }}
            </div>
            <div class="app-grid-item" style="color: #3498db">
              <strong>지식 💡:</strong>
              {{ Math.floor(selectedEntityData.inventory.knowledge || 0) }}
            </div>
          </div>
        </template>
        <template v-else>
          <!-- 개체 정보 -->
          <div class="app-grid" style="font-size: 0.95rem; gap: 12px">
            <div class="app-grid-item">
              <strong>종류:</strong>
              <span class="badge-primary">{{ getEntityTypeName(selectedEntityData) }}</span>
            </div>
            <div class="app-grid-item" v-if="selectedEntityData.village">
              <strong>소속 마을:</strong> {{ selectedEntityData.village.name }}
            </div>
            <div class="app-grid-item" v-if="selectedEntityData.age !== undefined">
              <strong>나이:</strong> {{ Math.floor(selectedEntityData.age) }}살
            </div>
            <div class="app-grid-item" v-if="selectedEntityData.profession">
              <strong>직업:</strong> {{ getProfessionName(selectedEntityData.profession) }}
            </div>
            <div
              class="app-grid-item"
              v-if="
                selectedEntityData.type &&
                ['stone', 'iron', 'gold'].includes(selectedEntityData.type)
              "
            >
              <strong>광물 잔량:</strong> {{ Math.floor(selectedEntityData.energy) }}
            </div>
            <div class="app-grid-item" v-if="selectedEntityData.energy !== undefined">
              <strong>체력:</strong>
              <span :class="selectedEntityData.energy > 50 ? 'badge-success' : 'badge-danger'">{{
                Math.floor(selectedEntityData.energy)
              }}</span>
            </div>
            <div class="app-grid-item" v-if="selectedEntityData.state">
              <strong>상태:</strong> {{ selectedEntityData.state }}
            </div>
            <div class="app-grid-item" v-if="selectedEntityData.isImmortal">
              <strong>특성:</strong> 🛡️불사(Immortal)
            </div>
            <!-- 욕구 및 감정 패널 -->
            <div
              class="app-grid-item"
              v-if="selectedEntityData.needs && Object.keys(selectedEntityData.needs).length > 0"
              style="grid-column: span 2"
            >
              <strong>🔥 욕구 (Needs):</strong>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px">
                <span
                  v-for="(val, key) in selectedEntityData.needs"
                  :key="key"
                  class="badge-warning"
                  style="background: #e67e22; font-size: 0.8rem; padding: 2px 6px"
                >
                  {{ translateKey(key) }}: {{ Math.floor(val) }}%
                </span>
              </div>
            </div>
            <div
              class="app-grid-item"
              v-if="
                selectedEntityData.emotions && Object.keys(selectedEntityData.emotions).length > 0
              "
              style="grid-column: span 2"
            >
              <strong>💖 감정 (Emotions):</strong>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px">
                <span
                  v-for="(val, key) in selectedEntityData.emotions"
                  :key="key"
                  class="badge-primary"
                  style="background: #9b59b6; font-size: 0.8rem; padding: 2px 6px"
                >
                  {{ translateKey(key) }}: {{ Math.floor(val) }}%
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 우측 HUD: 상호작용 패널 -->
      <div class="hud-right custom-scroll">
        <GameInteractionPanel
          v-if="worldInstanceReady"
          :world="worldInstance"
          v-model:spawnType="currentSpawnType"
        />
      </div>

      <!-- 우측 하단 미니 정보 -->
      <div class="hud-bottom-right">
        🗺️ 맵 크기: {{ mapWidth }} x {{ mapHeight }}<br />
        <span style="color: #bbb; font-size: 0.8rem"
          >※ 화면 드래그 이동 / 빈 공간 클릭 시 소환</span
        >
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
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import { World } from './engine/core/World.js'
import { saveWorld, loadWorlds } from './api/gameApi.js'
import { Village } from './engine/objects/society/Village.js' // 필요시 import
import GameInteractionPanel from './components/GameInteractionPanel.vue'

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
const season = ref('SPRING')
const selectedEntityData = ref(null)
let popInterval = null

let gameWorker = null

// 카메라 드래그 판별용 변수
let isClickDrag = false

onMounted(() => {
  if (gameCanvas.value) {
    gameWorker = new Worker(new URL('./engine/worker/game.worker.js', import.meta.url), {
      type: 'module',
    })
    worldInstance = new World(gameCanvas.value)
    worldInstanceReady.value = true
    mapWidth.value = worldInstance.width
    mapHeight.value = worldInstance.height

    // Worker Proxy 연동
    worldInstance.onProxyAction = (msg) => {
      gameWorker.postMessage(msg)
    }

    // Worker 데이터 수신 및 렌더링
    gameWorker.onmessage = (e) => {
      if (e.data.type === 'SYNC') {
        worldInstance.importState(e.data.payload)
        requestAnimationFrame((t) => worldInstance.render(t))
      }
    }

    gameWorker.postMessage({ type: 'INIT' })

    popInterval = setInterval(() => {
      if (worldInstance) {
        population.value = worldInstance.creatures.length
        fertility.value = worldInstance.currentFertility
        maxFertility.value = worldInstance.maxFertility
        season.value = worldInstance.timeSystem.season
        // 시간 표시 포맷팅 (0~24000)
        const hours = Math.floor(worldInstance.timeSystem.timeOfDay / 1000)
          .toString()
          .padStart(2, '0')
        displayTime.value = `${hours}:00`
        updateSelectedEntityData()
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
  worldInstance.camera.handleMouseMove(e)
  isClickDrag = true
}

const handleMouseUp = (e) => {
  if (!worldInstance) return
  worldInstance.camera.handleMouseUp()
  if (gameCanvas.value) gameCanvas.value.style.cursor = 'grab'
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
    updateSelectedEntityData()
  } else {
    // 빈 공간을 클릭하면 마을인지 먼저 체크 (원 안에 포함되는지)
    const worldX = mouseX + worldInstance.camera.x
    const worldY = mouseY + worldInstance.camera.y
    let clickedVillage = null
    for (const v of worldInstance.villages) {
      if (Math.sqrt(Math.pow(v.x - worldX, 2) + Math.pow(v.y - worldY, 2)) < v.radius) {
        clickedVillage = v
        break
      }
    }

    if (clickedVillage) {
      worldInstance.selectedEntity = clickedVillage
      updateSelectedEntityData()
    } else {
      worldInstance.selectedEntity = null
      selectedEntityData.value = null

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
}

const updateSelectedEntityData = () => {
  if (!worldInstance || !worldInstance.selectedEntity) {
    selectedEntityData.value = null
    return
  }
  const ent = worldInstance.selectedEntity

  if (ent.isDead) {
    worldInstance.selectedEntity = null
    selectedEntityData.value = null
    return
  }

  if (ent instanceof Village || (ent.inventory && ent.creatures)) {
    // 마을인 경우
    selectedEntityData.value = {
      isVillage: true,
      name: ent.name,
      nation: ent.nation,
      population: ent.population !== undefined ? ent.population : ent.creatures.length,
      buildings: ent.buildingCount !== undefined ? ent.buildingCount : ent.buildings.length,
      inventory: ent.inventory,
    }
  } else {
    // 일반 개체
    selectedEntityData.value = {
      isVillage: false,
      type: ent.type,
      profession: ent.profession,
      age: ent.age,
      energy: ent.energy,
      state: ent.state,
      isImmortal: ent.isImmortal,
      village: ent.village,
      needs: ent.needs,
      emotions: ent.emotions,
    }
  }
}

const getEntityTypeName = (entity) => {
  if (entity.profession !== undefined) return '지성체 (인간)'
  if (entity.type === 'HERBIVORE') return '초식동물 (토끼)'
  if (entity.type === 'CARNIVORE') return '육식동물 (호랑이)'
  if (entity.type === 'tree') return '나무'
  if (entity.type === 'grass') return '풀'
  if (entity.type === 'crop') return '농작물 (밀)'
  if (entity.type === 'wood' || entity.type === 'biomass' || entity.type === 'food') return '자원'

  const buildingTypes = {
    HOUSE: '집',
    SCHOOL: '학교',
    FARM: '농장',
    BARRACKS: '병영',
    TEMPLE: '신전',
    SMITHY: '대장간',
  }
  if (buildingTypes[entity.type]) return `건물 (${buildingTypes[entity.type]})`

  if (entity.type === 'stone' || entity.type === 'iron' || entity.type === 'gold')
    return '광맥 (' + entity.type + ')'
  if (entity.lifeTime !== undefined && entity.angle !== undefined) return '재해 (토네이도)'
  return '알 수 없음'
}

const getProfessionName = (prof) => {
  const map = {
    NONE: '아기/무직',
    GATHERER: '채집가 🧺',
    LUMBERJACK: '벌목꾼 🪓',
    FARMER: '농부 🌱',
    BUILDER: '건축가 🔨',
    SCHOLAR: '학자 📖',
    MINER: '광부 ⛏️',
    WARRIOR: '전사 ⚔️',
    LEADER: '마일 촌장 👑',
  }
  return map[prof] || prof
}

const getSeasonName = (s) => {
  const map = { SPRING: '봄 🌸', SUMMER: '여름 ☀️', AUTUMN: '가을 🍂', WINTER: '겨울 ❄️' }
  return map[s] || s
}

const translateKey = (key) => {
  const dict = {
    hunger: '허기',
    fatigue: '피로',
    moisture: '수분 갈증',
    thirst: '갈증',
    happiness: '행복',
    fear: '공포',
    aggression: '공격성',
    vitality: '활력',
  }
  return dict[key] || key
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

<style scoped>
.game-wrapper {
  position: relative;
  width: 100%;
  max-width: 1280px; /* 기존 800px 에서 대폭 확대 */
  margin: 0 auto;
  border: 2px solid var(--app-border-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  background-color: #a4b07e;
}

.game-canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1280 / 720;
  cursor: grab;
}
.game-canvas:active {
  cursor: grabbing;
}

/* HUD 레이아웃 공통 */
.hud-top {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: space-between;
  pointer-events: none; /* 클릭 통과 */
}
.hud-top-left,
.hud-top-right {
  pointer-events: auto; /* 자식 요소만 클릭 활성화 */
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.hud-top-right span {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.hud-panel {
  background: rgba(20, 30, 40, 0.85);
  color: #ecf0f1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 16px;
  backdrop-filter: blur(6px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
}

.hud-left {
  position: absolute;
  top: 70px;
  left: 16px;
  width: 300px;
  max-height: calc(100% - 90px);
  overflow-y: auto;
}

.hud-right {
  position: absolute;
  top: 70px;
  right: 16px;
  width: 300px;
  max-height: calc(100% - 90px);
  overflow-y: auto;
  pointer-events: none; /* GameInteractionPanel 내부에서 auto로 제어 */
}

.hud-bottom-right {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  pointer-events: none;
  text-align: right;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 스크롤바 커스텀 */
.custom-scroll::-webkit-scrollbar {
  width: 6px;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}
</style>
