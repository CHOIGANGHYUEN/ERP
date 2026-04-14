<template>
  <div>
    <h4
      style="
        margin: 0 0 12px 0;
        color: var(--app-text-color);
        border-bottom: 1px solid var(--app-border-color);
        padding-bottom: 8px;
        font-size: 1.1rem;
      "
    >
      🔍 개체 관찰 (Inspector)
    </h4>

    <template v-if="entityData.isVillage">
      <!-- 마을 정보 -->
      <div class="app-grid" style="font-size: 0.95rem; gap: 12px">
        <div class="app-grid-item"><strong>마을 이름:</strong> {{ entityData.name }}</div>
        <div class="app-grid-item" v-if="entityData.nation">
          <strong>국가:</strong>
          <span :style="{ color: entityData.nation.color, fontWeight: 'bold' }">{{
            entityData.nation.name
          }}</span>
        </div>
        <div class="app-grid-item"><strong>인구:</strong> {{ entityData.population }}명</div>
        <div class="app-grid-item"><strong>건물:</strong> {{ entityData.buildings }}채</div>
        <div class="app-grid-item" style="color: #2ecc71">
          <strong>식량 🧺:</strong>
          {{ Math.floor(entityData.inventory.food || entityData.inventory.biomass || 0) }}
        </div>
        <div class="app-grid-item" style="color: #e67e22">
          <strong>목재 🪓:</strong> {{ Math.floor(entityData.inventory.wood || 0) }}
        </div>
        <div class="app-grid-item" style="color: #bdc3c7">
          <strong>석재 🪨:</strong> {{ Math.floor(entityData.inventory.stone || 0) }}
        </div>
        <div class="app-grid-item" style="color: #e67e22">
          <strong>철광 ⛏️:</strong> {{ Math.floor(entityData.inventory.iron || 0) }}
        </div>
        <div class="app-grid-item" style="color: #f1c40f">
          <strong>금 💰:</strong> {{ Math.floor(entityData.inventory.gold || 0) }}
        </div>
        <div class="app-grid-item" style="color: #3498db">
          <strong>지식 💡:</strong> {{ Math.floor(entityData.inventory.knowledge || 0) }}
        </div>
        <div
          class="app-grid-item"
          style="grid-column: span 2"
          v-if="entityData.nation && entityData.nation.diplomacy"
        >
          <strong>🤝 외교 관계:</strong>
          <ul style="padding-left: 20px; margin: 4px 0 0 0; font-size: 0.9rem">
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
      <div class="app-grid" style="font-size: 0.95rem; gap: 12px">
        <div class="app-grid-item">
          <strong>종류:</strong>
          <span class="badge-primary">{{ getEntityTypeName(entityData) }}</span>
        </div>
        <div class="app-grid-item" v-if="entityData.village">
          <strong>소속 마을:</strong> {{ entityData.village.name }}
        </div>
        <div class="app-grid-item" v-if="entityData.age !== undefined">
          <strong>나이:</strong> {{ Math.floor(entityData.age) }}살
        </div>
        <div class="app-grid-item" v-if="entityData.profession">
          <strong>직업:</strong> {{ getProfessionName(entityData.profession) }}
        </div>
        <div
          class="app-grid-item"
          v-if="entityData.type && ['stone', 'iron', 'gold'].includes(entityData.type)"
        >
          <strong>광물 잔량:</strong> {{ Math.floor(entityData.energy) }}
        </div>
        <div class="app-grid-item" v-if="entityData.energy !== undefined">
          <strong>체력:</strong>
          <span :class="entityData.energy > 50 ? 'badge-success' : 'badge-danger'">
            {{ Math.floor(entityData.energy) }}
          </span>
        </div>
        <div class="app-grid-item" v-if="entityData.state">
          <strong>상태:</strong> {{ entityData.state }}
        </div>
        <div class="app-grid-item" v-if="entityData.isImmortal">
          <strong>특성:</strong> 🛡️불사(Immortal)
        </div>
        <!-- 욕구 및 감정 패널 -->
        <div
          class="app-grid-item"
          v-if="entityData.needs && Object.keys(entityData.needs).length > 0"
          style="grid-column: span 2"
        >
          <strong>🔥 욕구 (Needs):</strong>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px">
            <span
              v-for="(val, key) in entityData.needs"
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
          v-if="entityData.emotions && Object.keys(entityData.emotions).length > 0"
          style="grid-column: span 2"
        >
          <strong>💖 감정 (Emotions):</strong>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px">
            <span
              v-for="(val, key) in entityData.emotions"
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
</template>

<script setup>
import { defineProps } from 'vue'

const props = defineProps({
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
  }
  return map[prof] || prof
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

const getRelationName = (status) => {
  const map = { WAR: '전쟁', PEACE: '평화', NEUTRAL: '중립' }
  return map[status] || status
}

const getRelationClass = (status) => {
  const map = { WAR: 'danger', PEACE: 'success', NEUTRAL: 'secondary' }
  return map[status] || 'secondary'
}
</script>
