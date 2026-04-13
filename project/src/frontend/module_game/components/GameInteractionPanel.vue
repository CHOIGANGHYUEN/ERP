<template>
  <div class="hud-interaction-panel">
    <!-- 1. 창조 및 소환 패널 -->
    <div class="hud-box">
      <h3 style="margin-top: 0; color: #3498db">✨ 창조의 권능</h3>
      <div class="modern-form" style="gap: 12px; margin-top: 16px">
        <div class="form-group">
          <label class="form-label">소환할 개체 선택</label>
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
        <button class="btn btn-primary" style="width: 100%" @click="handleSpawn">
          화면 중앙에 소환하기
        </button>
      </div>
    </div>

    <!-- 2. 환경 제어 패널 -->
    <div class="hud-box">
      <h3 style="margin-top: 0; color: #2ecc71">🌍 환경 통제</h3>
      <div class="modern-form" style="gap: 12px; margin-top: 16px">
        <button class="btn btn-secondary" @click="addFertility">대지 비옥도 +5000 🌿</button>
        <div style="display: flex; gap: 8px">
          <button class="btn btn-secondary" style="flex: 1" @click="setWeather('clear')">
            맑음 ☀️
          </button>
          <button class="btn btn-secondary" style="flex: 1" @click="setWeather('rain')">
            비 🌧️
          </button>
          <button class="btn btn-secondary" style="flex: 1" @click="setWeather('fog')">
            안개 🌫️
          </button>
        </div>
      </div>
      <div
        class="modern-form"
        style="
          gap: 12px;
          margin-top: 16px;
          border-top: 1px dashed rgba(255, 255, 255, 0.2);
          padding-top: 16px;
        "
      >
        <h4 style="margin: 0; color: #ff7675">🔥 재앙의 권능</h4>
        <div style="display: flex; gap: 8px">
          <button
            class="btn btn-secondary"
            style="flex: 1; border-color: #e74c3c; color: #e74c3c"
            @click="spawnTornado"
          >
            🌪️ 토네이도
          </button>
          <button
            class="btn btn-secondary"
            style="flex: 1; border-color: #c0392b; color: #c0392b"
            @click="triggerEarthquake"
          >
            🌋 대지진
          </button>
        </div>
      </div>
    </div>

    <!-- 3. 실시간 통계 패널 -->
    <div class="hud-box">
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        "
      >
        <h3 style="margin: 0">📊 월드 통계</h3>
        <button class="icon-btn" @click="fetchOverallStatus" title="새로고침">🔄</button>
      </div>
      <div v-if="overallStatus" style="display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; justify-content: space-between">
          <span>생명체 및 인구</span>
          <span class="badge-success">{{ overallStatus['총 인구수'] }} 명</span>
        </div>
        <div style="display: flex; justify-content: space-between">
          <span>자연 생태계</span>
          <span class="badge-warning"
            >식물 {{ overallStatus['식물 수'] }} / 동물 {{ overallStatus['동물 수'] }}</span
          >
        </div>
        <div style="display: flex; justify-content: space-between">
          <span>문명 인프라</span>
          <span
            class="badge-primary"
            style="
              background: #3498db;
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 0.8rem;
              font-weight: 600;
            "
            >마을 {{ overallStatus['마을 수'] }} / 건물 {{ overallStatus['건물 수'] }}</span
          >
        </div>
      </div>
      <div v-else class="empty-state">우측 상단의 새로고침 버튼을 눌러주세요.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

const props = defineProps({
  world: {
    type: Object,
    default: null,
  },
  spawnType: {
    type: String,
    default: 'human',
  },
})

const emit = defineEmits(['update:spawnType'])

const localSpawnType = computed({
  get: () => props.spawnType,
  set: (val) => emit('update:spawnType', val),
})

const overallStatus = ref(null)

onMounted(() => {
  // 초기 통계 로드
  setTimeout(fetchOverallStatus, 500)
})

const handleSpawn = () => {
  if (!props.world) return
  const x = props.world.camera.x + props.world.canvas.width / 2
  const y = props.world.camera.y + props.world.canvas.height / 2

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
  if (!props.world) return
  overallStatus.value = {
    '총 인구수': props.world.creatures.length,
    '동물 수': props.world.animals.length,
    '식물 수': props.world.plants.length,
    '자원 수': props.world.resources.length,
    '건물 수': props.world.buildings.length,
    '마을 수': props.world.villages.length,
    '국가 수': props.world.nations.length,
  }
}
</script>

<style scoped>
.hud-interaction-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  pointer-events: auto; /* 클릭 상호작용 활성화 */
}

.hud-box {
  background: rgba(20, 30, 40, 0.85);
  color: #ecf0f1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 16px;
  backdrop-filter: blur(6px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
}

.hud-box .form-label {
  color: #bdc3c7;
}

.hud-box .modern-select {
  background-color: rgba(0, 0, 0, 0.3);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
}

/* 다크 테마용 2차 버튼 오버라이딩 */
.hud-box .btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.hud-box .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
