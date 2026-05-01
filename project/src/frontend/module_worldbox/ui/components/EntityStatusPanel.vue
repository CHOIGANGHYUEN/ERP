<template>
  <div class="entity-status-panel" v-if="entity">
    <div class="panel-header">
      <div class="title-wrap">
        <span class="icon">{{ getIcon(entity.type, entity.subType) }}</span>
        <h3>{{ entity.name }}</h3>
      </div>
      <button class="close-btn" @click="closePanel">✕</button>
    </div>
    
    <div class="panel-body">
      <div class="status-row">
        <span class="label">State:</span>
        <span class="value state-badge" :class="entity.state.toLowerCase()">
          {{ entity.state }}
        </span>
      </div>
      <div class="status-row" v-if="entity.rank !== undefined">
        <span class="label">Hierarchy Rank:</span>
        <span class="value" style="color: #ef5350">👑 {{ entity.rank }}</span>
      </div>

      <!-- 🥩 동물 전용 상태 (위장/허기) -->
      <template v-if="entity.maxHunger !== undefined">
        <div class="status-row">
          <span class="label">Stomach:</span>
          <div class="progress-bar">
            <div class="fill stomach" :style="{ width: getPercentage(entity.hunger, entity.maxHunger) + '%' }"></div>
          </div>
          <span class="value-sm">{{ (entity.hunger || 0).toFixed(1) }} / {{ entity.maxHunger }}</span>
        </div>

        <!-- 😴 피로도 표시 추가 -->
        <div class="status-row" v-if="entity.fatigue !== undefined">
          <span class="label">Fatigue:</span>
          <div class="progress-bar">
            <div class="fill fatigue" :style="{ width: entity.fatigue + '%' }"></div>
          </div>
          <span class="value-sm">{{ Math.floor(entity.fatigue) }}%</span>
        </div>

        <div class="status-row" v-if="entity.animalYield">
          <span class="label">Yield:</span>
          <span class="value yield-text">{{ entity.animalYield }}</span>
        </div>
      </template>

      <!-- 🌱 식물/나무 전용 상태 (비옥도, 품질) -->
      <template v-if="entity.quality !== undefined || entity.fertility !== undefined">
        <div class="status-row">
          <span class="label">{{ entity.maxStomach ? 'Nutrients:' : 'Fertility:' }}</span>
          <div class="progress-bar">
            <div class="fill fertility" :style="{ width: getPercentage(entity.fertility, 1.0) + '%' }"></div>
          </div>
          <span class="value-sm">{{ Math.floor((entity.fertility || 0) * 100) }}%</span>
        </div>
        
        <div class="status-row" v-if="entity.resourceValue">
          <span class="label">Resource Yield:</span>
          <span class="value">{{ entity.resourceValue }}</span>
        </div>
      </template>

      <!-- 🍯 벌집 나무 전용 상태 -->
      <template v-if="entity.inhabitants">
        <div class="divider"></div>
        <div class="status-row">
          <span class="label">👑 Queen:</span>
          <span class="value">{{ entity.inhabitants.queen }}</span>
        </div>
        <div class="status-row">
          <span class="label">🐝 Workers:</span>
          <span class="value">{{ entity.inhabitants.worker }}</span>
        </div>
        <div class="status-row">
          <span class="label">🐛 Larvae:</span>
          <span class="value">{{ entity.inhabitants.larva }}</span>
        </div>
        <div class="status-row mt-1">
          <span class="label">🍯 Stored Honey:</span>
          <span class="value honey-text">{{ entity.inhabitants.honey }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useWorldboxStore } from '../store/worldboxStore';

const store = useWorldboxStore();
const entity = computed(() => store.selectedEntity);

const closePanel = () => {
  store.clearSelection();
};

const getIcon = (type, subType) => {
  if (subType === 'beehive') return '🍯';
  if (subType === 'fruit') return '🍎';
  if (type === 'cow') {
    return subType === 'dairy' ? '🐄' : '🐃';
  }
  if (type === 'wolf') return '🐺';
  if (type === 'hyena') return '🐾';
  if (type === 'wild_dog') return '🐕';
  
  const icons = {
    sheep: '🐑', human: '👤', bee: '🐝',
    tree: '🌲', flower: '🌸', grass: '🌾', unknown: '❓'
  };
  return icons[type] || '❓';
};

const getPercentage = (val, max) => {
  if (!max) return 0;
  return Math.min(100, Math.max(0, (val / max) * 100));
};
</script>

<style scoped>
.entity-status-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 250px;
  background: rgba(15, 15, 20, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 15px;
  color: #eee;
  pointer-events: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  font-family: sans-serif;
  z-index: 1100;
}

.panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 10px; }
.title-wrap { display: flex; align-items: center; gap: 8px; }
.title-wrap h3 { margin: 0; font-size: 1.1rem; color: #fff; }
.icon { font-size: 1.2rem; }
.close-btn { background: none; border: none; color: #888; font-size: 1.2rem; cursor: pointer; }
.close-btn:hover { color: #fff; }

.panel-body { display: flex; flex-direction: column; gap: 8px; }
.status-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
.label { color: #aaa; width: 80px; }
.value { font-weight: bold; }
.value-sm { font-size: 0.75rem; color: #ccc; min-width: 45px; text-align: right; }

.state-badge { padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); text-transform: capitalize; }
.state-badge.withered { background: rgba(139, 69, 19, 0.3); color: #ff8a65; }
.state-badge.healthy, .state-badge.blooming { background: rgba(76, 175, 80, 0.3); color: #81c784; }

.progress-bar { flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 0 10px; overflow: hidden; }
.fill { height: 100%; transition: width 0.2s ease; }
.fill.stomach { background: #ff9800; }
.fill.fatigue { background: #9c27b0; } /* 😴 세련된 보라색 피로도 바 */
.fill.fertility { background: #4caf50; }

.divider { height: 1px; background: rgba(255,255,255,0.1); margin: 5px 0; }
.mt-1 { margin-top: 5px; }
.honey-text { color: #ffca28; font-size: 1rem; }
.yield-text { color: #ffab91; font-size: 0.85rem; }
</style>