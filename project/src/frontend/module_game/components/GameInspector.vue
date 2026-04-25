<template>
  <div class="inspector-panel">
    <h4 class="inspector-title">🔍 개체 관찰 (Inspector)</h4>

    <template v-if="entityData.isVillage">
      <!-- 마을 정보 -->
      <div class="app-grid inspector-grid">
        <div class="app-grid-item"><strong>이름:</strong> {{ entityData.name }}</div>
        <div class="app-grid-item nation-name" v-if="entityData.nation">
          <strong>국가:</strong>
          <span :style="{ color: entityData.nation.color }">{{ entityData.nation.name }}</span>
        </div>
        <div class="app-grid-item"><strong>인구:</strong> {{ entityData.population }}명</div>
        <div class="app-grid-item"><strong>건물:</strong> {{ entityData.buildings }}채</div>
        <div class="app-grid-item res-food">
          <strong>식량 🧺:</strong>
          {{ Math.floor(entityData.inventory.food || entityData.inventory.biomass || 0) }}
        </div>
        <div class="app-grid-item res-wood">
          <strong>목재 🪓:</strong> {{ Math.floor(entityData.inventory.wood || 0) }}
        </div>
        <div class="app-grid-item res-stone">
          <strong>석재 🪨:</strong> {{ Math.floor(entityData.inventory.stone || 0) }}
        </div>
        <div class="app-grid-item res-iron">
          <strong>철광 ⛏️:</strong> {{ Math.floor(entityData.inventory.iron || 0) }}
        </div>
        <div class="app-grid-item res-gold">
          <strong>금 💰:</strong> {{ Math.floor(entityData.inventory.gold || 0) }}
        </div>
        <div class="app-grid-item res-know">
          <strong>지식 💡:</strong> {{ Math.floor(entityData.inventory.knowledge || 0) }}
        </div>
        <!-- 국가 자원 표시 -->
        <template v-if="entityData.nation && entityData.nation.inventory">
          <div class="app-grid-item full-span" style="margin-top: 8px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 8px;">
            <strong :style="{ color: entityData.nation.color }">👑 {{ entityData.nation.name }} 총 자산</strong>
          </div>
          <div class="app-grid-item res-food">
            <strong>식량 🧺:</strong> {{ Math.floor(entityData.nation.inventory.food || 0) }}
          </div>
          <div class="app-grid-item res-wood">
            <strong>목재 🪓:</strong> {{ Math.floor(entityData.nation.inventory.wood || 0) }}
          </div>
          <div class="app-grid-item res-stone">
            <strong>석재 🪨:</strong> {{ Math.floor(entityData.nation.inventory.stone || 0) }}
          </div>
          <div class="app-grid-item res-iron">
            <strong>철광 ⛏️:</strong> {{ Math.floor(entityData.nation.inventory.iron || 0) }}
          </div>
          <div class="app-grid-item res-gold">
            <strong>금 💰:</strong> {{ Math.floor(entityData.nation.inventory.gold || 0) }}
          </div>
          <div class="app-grid-item res-know">
            <strong>지식 💡:</strong> {{ Math.floor(entityData.nation.inventory.knowledge || 0) }}
          </div>
        </template>
        <div
          class="app-grid-item full-span"
          v-if="entityData.nation && entityData.nation.diplomacy"
        >
          <strong> 외교 관계:</strong>
          <ul class="diplomacy-list">
            <li v-for="(rel, name) in entityData.nation.diplomacy" :key="name">
              {{ name }}:
              <span :class="`badge-${getRelationClass(rel.status)}`">{{
                getRelationName(rel.status)
              }}</span>
              ({{ rel.score }})
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- 개체 정보 -->
      <div class="app-grid inspector-grid">
        <div class="app-grid-item">
          <strong>종류:</strong>
          <span class="badge-primary">{{ getEntityTypeName(entityData) }}</span>
        </div>
        <div class="app-grid-item" v-if="entityData.village">
          <strong>소속 마을:</strong> {{ entityData.village.name }}
        </div>
        <div class="app-grid-item" v-if="entityData.familyName">
          <strong>👨‍👩‍👧 가문:</strong>
          <span class="badge-primary">{{ entityData.familyName }}씨</span>
        </div>
        <div class="app-grid-item" v-if="entityData.age !== undefined">
          <strong>나이:</strong> {{ Math.floor(entityData.age) }}살
        </div>
        <div class="app-grid-item" v-if="entityData.profession">
          <strong>직업:</strong> {{ getProfessionName(entityData.profession) }}
        </div>
        <div class="app-grid-item" v-if="entityData.level !== undefined">
          <strong>레벨:</strong> <span class="badge-success">Lv.{{ entityData.level }}</span>
        </div>
        <div class="app-grid-item" v-if="entityData.exp !== undefined">
          <strong>경험치:</strong> {{ entityData.exp }} / {{ entityData.maxExp }}
        </div>
        <div class="app-grid-item" v-if="entityData.attackPower !== undefined">
          <strong>공격력:</strong> {{ (entityData.attackPower).toFixed(1) }}
        </div>
        <div class="app-grid-item" v-if="entityData.workEfficiency !== undefined">
          <strong>작업 효율:</strong> {{ entityData.workEfficiency }}
        </div>
        <div
          class="app-grid-item"
          v-if="entityData.type && ['stone', 'iron', 'gold'].includes(entityData.type)"
        >
          <strong>광물 잔량:</strong> {{ Math.floor(entityData.energy) }}
        </div>
        <div class="app-grid-item" v-if="entityData.energy !== undefined">
          <strong>체력:</strong>
          <span :class="entityData.energy > 50 ? 'badge-success' : 'badge-danger'">{{
            Math.floor(entityData.energy)
          }}</span>
        </div>
        <div class="app-grid-item" v-if="entityData.state">
          <strong>상태:</strong> {{ entityData.state }}
        </div>
        <div class="app-grid-item" v-if="entityData.isImmortal">
          <strong>특성:</strong> 🛡️불사(Immortal)
        </div>
        <!-- 욕구 및 감정 패널 -->
        <div
          class="app-grid-item full-span"
          v-if="entityData.needs && Object.keys(entityData.needs).length > 0"
        >
          <strong>🔥 욕구 (Needs):</strong>
          <div class="badge-container">
            <span
              v-for="(val, key) in entityData.needs"
              :key="key"
              class="badge-warning small-badge"
            >
              {{ translateKey(key) }}: {{ Math.floor(val) }}%
            </span>
          </div>
        </div>
        <div
          class="app-grid-item full-span"
          v-if="entityData.emotions && Object.keys(entityData.emotions).length > 0"
        >
          <strong>💖 감정 (Emotions):</strong>
          <div class="badge-container">
            <span
              v-for="(val, key) in entityData.emotions"
              :key="key"
              class="badge-primary small-badge bg-purple"
            >
              {{ translateKey(key) }}: {{ Math.floor(val) }}%
            </span>
          </div>
        </div>
        
        <!-- 인벤토리 패널 -->
        <div class="app-grid-item full-span" v-if="entityData.inventory && Object.keys(entityData.inventory).some(k => entityData.inventory[k] > 0)">
          <strong>🎒 개별 인벤토리:</strong>
          <div class="badge-container">
            <span class="badge-success small-badge" v-if="entityData.inventory.food > 0">식량: {{ Math.floor(entityData.inventory.food) }}</span>
            <span class="badge-success small-badge" v-if="entityData.inventory.biomass > 0">생물량: {{ Math.floor(entityData.inventory.biomass) }}</span>
            <span class="badge-warning small-badge" v-if="entityData.inventory.wood > 0">목재: {{ Math.floor(entityData.inventory.wood) }}</span>
            <span class="badge-secondary small-badge" v-if="entityData.inventory.stone > 0">석재: {{ Math.floor(entityData.inventory.stone) }}</span>
            <span class="res-iron small-badge" style="background:#55280b; padding:2px 4px; border-radius:4px" v-if="entityData.inventory.iron > 0">철광: {{ Math.floor(entityData.inventory.iron) }}</span>
            <span class="res-gold small-badge" style="background:#55500b; padding:2px 4px; border-radius:4px" v-if="entityData.inventory.gold > 0">금: {{ Math.floor(entityData.inventory.gold) }}</span>
          </div>
        </div>
        
        <!-- Task Queue 패널 -->
        <div class="app-grid-item full-span task-queue-section">
          <strong>📝 할일 목록 (Task Queue):</strong>
          <ul class="task-queue-list">
            <template v-if="entityData.taskQueue && entityData.taskQueue.length > 0">
              <li v-for="(task, idx) in entityData.taskQueue" :key="idx" :class="{ 'current-task': idx === 0 }">
                <span class="queue-num">{{ idx + 1 }}</span>
                <span class="queue-type">{{ translateKey(task.type) }}</span>
                <span v-if="task.targetType" class="queue-target"> → {{ translateKey(task.targetType) }}</span>
                <span :class="statusClass(task.status)"> [{{ translateKey(task.status) }}]</span>
              </li>
            </template>
            <li v-else class="task-idle">
              <span v-if="entityData.state && entityData.state !== 'IDLE'">🔄 {{ translateKey(entityData.state) }} 중...</span>
              <span v-else style="color:#aaa;">대기 중... (업무 대기)</span>
            </li>
          </ul>
        </div>

      </div>
    </template>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'

defineProps({
  entityData: {
    type: Object,
    required: true,
  },
})

const getEntityTypeName = (entity) => {
  if (entity.profession !== undefined) return '지성체 (인간)'
  if (entity.type === 'HERBIVORE') return '초식동물 (토끼)'
  if (entity.type === 'CARNIVORE') return '육식동물 (호랑이)'
  if (entity.type === 'tree') return '나무'
  if (entity.type === 'grass') return '풀'
  if (entity.type === 'crop') return '농작물 (밀)'
  if (['wood', 'biomass', 'food'].includes(entity.type)) return '자원'

  const buildingTypes = {
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
  }
  if (buildingTypes[entity.type]) return `건물 (${buildingTypes[entity.type]})`

  if (['stone', 'iron', 'gold'].includes(entity.type)) return `광맥 (${entity.type})`
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
    LEADER: '마을 촌장 👑',
    MERCHANT: '상인 💰',
  }
  return map[prof] || prof
}

const translateKey = (key) => {
  const dict = {
    // needs
    hunger: '허기',
    fatigue: '피로',
    moisture: '수분 갈증',
    thirst: '갈증',
    happiness: '행복',
    fear: '공포',
    aggression: '공격성',
    vitality: '활력',
    // task types
    MOVE: '목적지로 이동',
    HARVEST: '수확/채집/채광',
    BUILD: '건설 작업',
    DEPOSIT: '창고 납품',
    SLEEP: '수면/휴식',
    EAT: '식사',
    // task status
    PENDING: '대기 중',
    RUNNING: '실행 중',
    COMPLETED: '완료됨',
    FAILED: '취소/실패',
    // creature states
    IDLE: '대기',
    WORK: '작업 준비',
    MOVING: '이동 중',
    WORKING: '작업 중',
    BUILDING: '건설 중',
    HARVESTING: '벌목 중',
    GATHERING: '채집 중',
    MINING: '채광 중',
    RESTING: '휴식 중',
    EATING: '식사 중',
    SLEEPING: '수면 중',
    WANDERING: '배회 중',
    FLEEING: '도망 중',
    ATTACKING: '공격 중',
    SUFFERING: '고통 중',
    // resource/target types
    tree: '나무',
    plant: '식물',
    crop: '농작물',
    grass: '풀',
    mine: '광맥',
    stone: '돌',
    iron: '철광석',
    gold: '금광석',
    wood: '목재',
    food: '식량',
    biomass: '생물량',
    village: '마을',
    building: '건물',
    creature: '주민',
  }
  return dict[key] || key
}

const statusClass = (status) => {
  if (status === 'RUNNING') return 'res-wood'
  if (status === 'COMPLETED') return 'res-food'
  if (status === 'FAILED') return 'res-iron'
  return 'res-stone'
}

const getRelationName = (status) => {
  const map = { WAR: '전쟁', PEACE: '평화', NEUTRAL: '중립' }
  return map[status] || status
}

const getRelationClass = (status) => {
  const map = { WAR: 'danger', PEACE: 'success', NEUTRAL: 'secondary' }
  return map[status] || 'secondary'
}
</script>

<style scoped>
.inspector-panel {
  padding: 16px;
  color: #f8fafc;
}
.inspector-title {
  margin: 0 0 16px 0;
  color: #3498db;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
  font-size: 1.15rem;
}
.inspector-grid {
  font-size: 0.95rem;
  gap: 12px;
}
.nation-name span {
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.full-span {
  grid-column: 1 / -1;
}
.res-food {
  color: #2ecc71;
}
.res-wood {
  color: #e67e22;
}
.res-stone {
  color: #bdc3c7;
}
.res-iron {
  color: #d35400;
}
.res-gold {
  color: #f1c40f;
}
.res-know {
  color: #3498db;
}
.diplomacy-list {
  padding-left: 20px;
  margin: 6px 0 0 0;
  font-size: 0.9rem;
}
.badge-container {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.small-badge {
  font-size: 0.8rem;
  padding: 3px 6px;
}
.bg-purple {
  background-color: #9b59b6 !important;
}
.task-queue-section {
  grid-column: 1 / -1;
}
.task-queue-list {
  padding-left: 0;
  list-style: none;
  font-size: 0.85rem;
  margin-top: 6px;
}
.task-queue-list li {
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.current-task {
  border-left: 3px solid #2ecc71;
  background: rgba(46, 204, 113, 0.1) !important;
}
.task-idle {
  color: #95a5a6;
  font-style: italic;
}
.queue-num {
  display: inline-block;
  background: #34495e;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  text-align: center;
  line-height: 18px;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.queue-type {
  font-weight: bold;
}
.queue-target {
  color: #3498db;
  font-size: 0.8rem;
}
</style>
