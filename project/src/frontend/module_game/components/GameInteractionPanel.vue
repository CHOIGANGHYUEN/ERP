<template>
  <div class="interaction-panel">
    <!-- 1. 창조 및 소환 패널 -->
    <div class="hud-section">
      <h3 class="section-title">✨ 창조의 권능</h3>
      <div class="modern-form spawn-form">
        <div class="form-group">
          <label class="form-label hud-label">소환할 개체 선택</label>
          <div class="select-wrapper">
            <select v-model="localSpawnType" class="app-input modern-select">
              <option value="human">지성체 (인간)</option>
              <option value="herbivore">초식동물 (토끼)</option>
              <option value="carnivore">육식동물 (호랑이)</option>
              <option value="tree">나무</option>
              <option value="crop">농작물</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary full-width" @click="handleSpawn">
          화면 중앙에 소환하기
        </button>
      </div>
    </div>

    <!-- 2. 환경 제어 패널 -->
    <div class="hud-section">
      <h3 class="section-title">🌍 환경 통제</h3>
      <div class="modern-form control-form">
        <button class="btn btn-secondary" @click="addFertility">대지 비옥도 +5000 🌿</button>
        <div class="flex-row">
          <button class="btn btn-secondary flex-1" @click="setWeather('clear')">맑음 ☀️</button>
          <button class="btn btn-secondary flex-1" @click="setWeather('rain')">비 🌧️</button>
          <button class="btn btn-secondary flex-1" @click="setWeather('fog')">안개 🌫️</button>
        </div>
      </div>
      <div class="modern-form disaster-form">
        <h4 class="sub-title">🔥 재앙의 권능</h4>
        <div class="flex-row">
          <button class="btn btn-secondary flex-1 btn-tornado" @click="spawnTornado">
            🌪️ 토네이도
          </button>
          <button class="btn btn-secondary flex-1 btn-earthquake" @click="triggerEarthquake">
            🌋 대지진
          </button>
        </div>
      </div>
    </div>

    <!-- 3. 실시간 통계 패널 -->
    <div class="hud-section">
      <div class="section-header">
        <h3 class="section-title no-border">📊 월드 통계</h3>
        <button class="icon-btn" @click="fetchOverallStatus" title="새로고침">🔄</button>
      </div>
      <div v-if="overallStatus" class="statistics-panel">
        <!-- 문명 통계 -->
        <details open>
          <summary>
            <span class="badge-success">{{ overallStatus.creatureCount }}</span> 명의 주민 ({{
              overallStatus.villageCount
            }}개 마을)
          </summary>
          <ul class="stat-list">
            <li class="divider">
              <span>심층 상태</span>
              <span></span>
            </li>
            <li>
              <span class="indent">↳ 평균 나이</span>
              <span>{{ overallStatus.avgAge }}살</span>
            </li>
            <li>
              <span class="indent">↳ 평균 행복도</span>
              <span>{{ overallStatus.avgHappiness }}%</span>
            </li>
            <li>
              <span class="indent">↳ 평균 레벨 (최대)</span>
              <span>Lv.{{ overallStatus.avgLevel }} (Lv.{{ overallStatus.maxLevel }})</span>
            </li>
            <li class="divider">
              <span>직업 분포</span>
              <span></span>
            </li>
            <li v-for="(count, prof) in overallStatus.professions" :key="prof">
              <span class="indent">↳ {{ getProfessionName(prof) }}</span>
              <span>{{ count }}명</span>
            </li>
            <li class="divider">
              <span>총 건물 수</span>
              <span>{{ overallStatus.buildingCount }}채</span>
            </li>
            <li v-for="(count, type) in overallStatus.buildingTypes" :key="type">
              <span class="indent">↳ {{ getBuildingName(type) }}</span>
              <span>{{ count }}채</span>
            </li>
          </ul>
        </details>

        <!-- 경제 통계 -->
        <details v-if="worldInventory" open>
          <summary>💰 월드 총 자산</summary>
          <ul class="stat-list">
            <li>
              <span>식량 🧺</span><span>{{ Math.floor(worldInventory.food) }}</span>
            </li>
            <li>
              <span>목재 🪓</span><span>{{ Math.floor(worldInventory.wood) }}</span>
            </li>
            <li>
              <span>석재 🪨</span><span>{{ Math.floor(worldInventory.stone) }}</span>
            </li>
            <li>
              <span>철광 ⛏️</span><span>{{ Math.floor(worldInventory.iron) }}</span>
            </li>
            <li>
              <span>금 💰</span><span>{{ Math.floor(worldInventory.gold) }}</span>
            </li>
            <li>
              <span>지식 💡</span><span>{{ Math.floor(worldInventory.knowledge) }}</span>
            </li>
          </ul>
        </details>

        <!-- 생태계 통계 -->
        <details>
          <summary>
            <span class="badge-warning">{{
              overallStatus.animalCount + overallStatus.plantCount
            }}</span>
            개의 자연 생태계
          </summary>
          <ul class="stat-list">
            <li>
              <span>동물</span><span>{{ overallStatus.animalCount }}마리</span>
            </li>
            <li v-for="(count, type) in overallStatus.animalTypes" :key="type">
              <span class="indent">↳ {{ getAnimalName(type) }}</span>
              <span>{{ count }}마리</span>
            </li>
            <li class="divider">
              <span>식물</span><span>{{ overallStatus.plantCount }}개</span>
            </li>
            <li v-for="(count, type) in overallStatus.plantTypes" :key="type">
              <span class="indent">↳ {{ getPlantName(type) }}</span>
              <span>{{ count }}개</span>
            </li>
          </ul>
        </details>
      </div>
      <div v-else class="empty-state hud-empty">우측 상단의 새로고침 버튼을 눌러주세요.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { PROPS, STRIDE } from '../engine/core/SharedState.js'

const props = defineProps({
  world: {
    type: Object,
    default: null,
  },
  worldInventory: {
    type: Object,
    default: null,
  },
})

const localSpawnType = ref('human')
const overallStatus = ref(null)

onMounted(() => {
  // 월드 인스턴스가 준비되면 통계 로드
  if (props.world) {
    setTimeout(fetchOverallStatus, 500)
  }
})

watch(
  () => props.world,
  (newWorld) => {
    if (newWorld) {
      setTimeout(fetchOverallStatus, 500)
    }
  },
)

const professionNameMap = {
  NONE: '아기/무직',
  GATHERER: '채집가 🧺',
  LUMBERJACK: '벌목꾼 🪓',
  FARMER: '농부 🌱',
  BUILDER: '건축가 🔨',
  SCHOLAR: '학자 📖',
  MINER: '광부 ⛏️',
  WARRIOR: '전사 ⚔️',
  LEADER: '마을 촌장 👑',
}
const getProfessionName = (prof) => professionNameMap[prof] || prof

const buildingNameMap = {
  HOUSE: '집',
  SCHOOL: '학교',
  FARM: '농장',
  BARRACKS: '병영',
  TEMPLE: '신전',
  SMITHY: '대장간',
  RANCH: '목장',
  WAREHOUSE: '창고',
  MARKET: '시장',
  TAVERN: '선술집',
  FENCE: '울타리',
  FENCE_GATE: '울타리 문',
}
const getBuildingName = (type) => buildingNameMap[type] || type
const getAnimalName = (type) => (type === 'CARNIVORE' ? '육식동물' : '초식동물')
const getPlantName = (type) => ({ tree: '나무', grass: '풀', crop: '농작물' })[type] || type

const handleSpawn = () => {
  if (!props.world) return

  const zoom = props.world.camera.zoom || 1
  const viewW = props.world.canvas.width / zoom
  const viewH = props.world.canvas.height / zoom
  const x = props.world.camera.x + viewW / 2
  const y = props.world.camera.y + viewH / 2

  switch (localSpawnType.value) {
    case 'human':
      props.world.spawnCreature(x, y)
      break
    case 'herbivore':
      props.world.spawnAnimal(x, y, 'HERBIVORE')
      break
    case 'carnivore':
      props.world.spawnAnimal(x, y, 'CARNIVORE')
      break
    case 'tree':
      props.world.spawnPlant(x, y, 'tree')
      break
    case 'crop':
      props.world.spawnPlant(x, y, 'crop')
      break
    case 'fence':
      props.world.spawnBuilding(x, y, 'FENCE', null)
      break
    case 'fence_gate':
      props.world.spawnBuilding(x, y, 'FENCE_GATE', null)
      break
  }
  fetchOverallStatus()
}

const addFertility = () => {
  if (!props.world) return
  props.world.addFertility(5000)
}

const setWeather = (type) => {
  if (!props.world) return
  props.world.setWeather(type)
}

const spawnTornado = () => {
  if (!props.world) return
  const x = props.world.camera.x + props.world.canvas.width / 2
  const y = props.world.camera.y + props.world.canvas.height / 2
  props.world.spawnTornado(x, y)
}

const triggerEarthquake = () => {
  if (!props.world) return
  props.world.triggerEarthquake()
}

const fetchOverallStatus = () => {
  if (!props.world || !props.world.views) return
  const { globals, creatures, buildings, animals, plants } = props.world.views

  // Worker에 월드 총 자산 요청
  if (props.world.onProxyAction) {
    props.world.onProxyAction({ type: 'GET_WORLD_INVENTORY' })
  }

  const creatureCount = globals[PROPS.GLOBALS.CREATURE_COUNT]
  const buildingCount = globals[PROPS.GLOBALS.BUILDING_COUNT]
  const animalCount = globals[PROPS.GLOBALS.ANIMAL_COUNT]
  const plantCount = globals[PROPS.GLOBALS.PLANT_COUNT]
  const villageCount = globals[PROPS.GLOBALS.VILLAGE_COUNT]

  // 직업 및 기타 상세 통계
  const professions = {}
  let maxLevel = 1

  const professionReverseMap = {
    0: 'NONE',
    1: 'GATHERER',
    2: 'LUMBERJACK',
    3: 'FARMER',
    4: 'BUILDER',
    5: 'SCHOLAR',
    6: 'WARRIOR',
    7: 'MINER',
    8: 'LEADER',
  }
  for (let i = 0; i < creatureCount; i++) {
    const offset = i * STRIDE.CREATURE
    if (creatures[offset + PROPS.CREATURE.IS_ACTIVE] === 1) {
      const profId = creatures[offset + PROPS.CREATURE.PROFESSION]
      const profName = professionReverseMap[profId] || 'NONE'
      professions[profName] = (professions[profName] || 0) + 1
      
      const level = creatures[offset + PROPS.CREATURE.LEVEL] || 1
      
      if (level > maxLevel) maxLevel = level
    }
  }

  // 건물 종류별 통계
  const buildingTypes = {}
  const buildingTypeReverseMap = {
    0: 'HOUSE',
    1: 'SCHOOL',
    2: 'FARM',
    3: 'BARRACKS',
    4: 'TEMPLE',
    5: 'SMITHY',
  }
  for (let i = 0; i < buildingCount; i++) {
    const offset = i * STRIDE.BUILDING
    if (buildings[offset + PROPS.BUILDING.IS_ACTIVE] === 1) {
      const typeId = buildings[offset + PROPS.BUILDING.TYPE]
      const typeName = buildingTypeReverseMap[typeId] || 'UNKNOWN'
      buildingTypes[typeName] = (buildingTypes[typeName] || 0) + 1
    }
  }

  // 동물 종류별 통계
  const animalTypes = {}
  for (let i = 0; i < animalCount; i++) {
    const offset = i * STRIDE.ANIMAL
    if (animals[offset + PROPS.ANIMAL.IS_ACTIVE] === 1) {
      const typeId = animals[offset + PROPS.ANIMAL.TYPE]
      const typeName = typeId === 1 ? 'CARNIVORE' : 'HERBIVORE'
      animalTypes[typeName] = (animalTypes[typeName] || 0) + 1
    }
  }

  // 식물 종류별 통계
  const plantTypes = {}
  const plantTypeReverseMap = { 0: 'grass', 1: 'tree', 2: 'crop' }
  for (let i = 0; i < plantCount; i++) {
    const offset = i * STRIDE.PLANT
    if (plants[offset + PROPS.PLANT.IS_ACTIVE] === 1) {
      const typeId = plants[offset + PROPS.PLANT.TYPE]
      const typeName = plantTypeReverseMap[typeId] || 'UNKNOWN'
      plantTypes[typeName] = (plantTypes[typeName] || 0) + 1
    }
  }

  overallStatus.value = {
    creatureCount,
    professions,
    buildingCount,
    buildingTypes,
    animalCount,
    animalTypes,
    plantCount,
    plantTypes,
    villageCount,
  }
}
</script>

<style scoped>
.interaction-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.hud-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 16px;
}
.section-title {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  color: #f1c40f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}
.section-title.no-border {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
  margin-bottom: 12px;
}
.sub-title {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #e74c3c;
}
.hud-label {
  color: #bdc3c7;
}
.spawn-form,
.control-form {
  gap: 12px;
}
.disaster-form {
  gap: 12px;
  margin-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 16px;
}
.flex-row {
  display: flex;
  gap: 8px;
}
.flex-1 {
  flex: 1;
}
.full-width {
  width: 100%;
}
.btn-tornado {
  border-color: #e74c3c;
  color: #e74c3c;
}
.btn-earthquake {
  border-color: #c0392b;
  color: #c0392b;
}
.statistics-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.statistics-panel details {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 4px;
}
.statistics-panel details:last-child {
  border-bottom: none;
}
.statistics-panel summary {
  cursor: pointer;
  outline: none;
  list-style-position: inside;
  font-weight: bold;
  color: #ecf0f1;
}
.stat-list {
  list-style: none;
  padding: 8px 0 0 12px;
  margin: 0;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stat-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #bdc3c7;
}
.stat-list li span:last-child {
  font-weight: 600;
  color: #f8fafc;
}
.stat-list li.divider {
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  margin-top: 4px;
  padding-top: 4px;
}
.indent {
  padding-left: 12px;
}
.hud-empty {
  color: #95a5a6;
}
</style>
