<template>
  <div class="entity-status-panel" v-if="entity">
    <div class="panel-header">
      <div class="title-wrap">
        <span class="icon">{{ getIcon(entity.type, entity.subType) }}</span>
        <h3>{{ entity.name }}</h3>
        <span v-if="entity.isChief" class="chief-tag" title="Village Chief">👑</span>
      </div>
      <button class="close-btn" @click="closePanel">✕</button>
    </div>
    
    <div class="panel-body">
      <div class="status-row">
        <span class="label">Species:</span>
        <span class="value species-text">{{ entity.type }}</span>
      </div>

      <div class="status-row" v-if="entity.diet">
        <span class="label">Diet:</span>
        <span class="diet-badge" :class="entity.diet.toLowerCase()">
          {{ entity.diet === 'carnivore' ? '🥩 Carnivore' : '🌿 Herbivore' }}
        </span>
      </div>

      <div class="status-row">
        <span class="label">State:</span>
        <span class="value state-badge" :class="entity.state.toLowerCase()">
          {{ entity.state }}
        </span>
      </div>

      <!-- 🏷️ 직업 뱃지 (인간 전용) -->
      <div class="status-row" v-if="entity.jobType">
        <span class="label">Job:</span>
        <span class="job-badge" :style="{ background: jobMeta.bg, color: jobMeta.color }">
          {{ jobMeta.emoji }} {{ jobMeta.label }}
        </span>
      </div>

      <!-- 📋 현재 마을 과업 (Task) -->
      <div class="status-row task-row" v-if="entity.currentTask">
        <span class="label">Duty:</span>
        <div class="task-info">
          <span class="task-type">{{ getTaskLabel(entity.currentTask.type) }}</span>
          <span class="task-priority" :class="getPriorityClass(entity.currentTask.priority)">
            P{{ entity.currentTask.priority }}
          </span>
        </div>
      </div>
      <div class="status-row" v-if="entity.rank !== undefined">
        <span class="label">Hierarchy Rank:</span>
        <span class="value" style="color: #ef5350">👑 {{ entity.rank }}</span>
      </div>

      <!-- 🎯 AI 타겟 표시 (상시 표시하여 상태 확인 가능케 함) -->
      <div class="status-row target-row" v-if="entity.jobType || entity.state !== 'Normal'">
        <span class="label">Target:</span>
        <span class="value target-text" :class="{ 'is-searching': entity.targetName === 'Searching...' }">
          📍 {{ entity.targetName }}
        </span>
      </div>

      <!-- 🥩 동물/인간 공통 상태 (위장/허기, 피로도, 나이) -->
      <template v-if="entity.maxHunger !== undefined">
        <!-- ⏳ 나이 및 성장 단계 -->
        <div class="status-row age-row" v-if="entity.age !== undefined">
          <span class="label">Age:</span>
          <span class="value age-text">
            {{ Math.floor(entity.age) }}y <span class="stage-tag">{{ entity.growthStage }}</span>
          </span>
        </div>

        <div class="status-row">
          <span class="label">Hunger:</span>
          <div class="progress-bar">
            <div class="fill stomach" :style="{ width: getPercentage(entity.hunger, entity.maxHunger) + '%' }"></div>
          </div>
          <span class="value-sm">{{ (entity.hunger || 0).toFixed(0) }}%</span>
        </div>

        <div class="status-row" v-if="entity.fatigue !== undefined">
          <span class="label">Fatigue:</span>
          <div class="progress-bar">
            <div class="fill fatigue" :style="{ width: entity.fatigue + '%' }"></div>
          </div>
          <span class="value-sm">{{ Math.floor(entity.fatigue) }}%</span>
        </div>

        <!-- 🧠 AI 상태 스택 (인터럽트 확인용) -->
        <div class="status-row" v-if="entity.modeStackCount > 0">
          <span class="label">Waiting Tasks:</span>
          <span class="value stack-count">⏳ {{ entity.modeStackCount }} stored</span>
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

      <!-- 🎒 인벤토리 섹션 (새로 추가) -->
      <template v-if="entity.inventory">
        <div class="divider"></div>
        <div class="inventory-section">
          <div class="section-header">
            <span class="label">Inventory</span>
            <span class="value-sm">{{ entity.inventory.total }} / {{ entity.inventory.capacity }}</span>
          </div>
          <div class="inventory-bar">
            <div class="fill inventory" :style="{ width: getPercentage(entity.inventory.total, entity.inventory.capacity) + '%' }"></div>
          </div>
          <div class="item-grid">
            <div v-for="(amount, type) in entity.inventory.items" :key="type" class="item-tag" v-show="amount > 0">
              <span class="item-icon">{{ getItemEmoji(type) }}</span>
              <span class="item-count">{{ Math.floor(amount) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 💀 KILL BUTTON (God Power) -->
      <div class="divider"></div>
      <div class="action-section">
        <button class="kill-btn" @click="handleKill">
          <span class="kill-icon">💀</span> ELIMINATE
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useWorldboxStore } from '../store/worldboxStore';
import { JobMeta, JobTypes } from '../../engine/config/JobTypes.js';

const store = useWorldboxStore();
const entity = computed(() => store.selectedEntity);

const closePanel = () => {
  store.clearSelection();
};

const handleKill = () => {
  if (entity.value && confirm(`Are you sure you want to eliminate ${entity.value.name}?`)) {
    store.killEntity(entity.value.id);
  }
};

// 직업 메타데이터 (이모지, 한글명, 색상)
const jobMeta = computed(() => {
  const jt = entity.value?.jobType || JobTypes.UNEMPLOYED;
  const meta = JobMeta[jt] || JobMeta[JobTypes.UNEMPLOYED];
  return {
    emoji: meta.emoji,
    label: meta.label,
    color: meta.color,
    bg:    meta.color + '22', // 색상 + 투명도
  };
});

const getTaskLabel = (type) => {
  const labels = {
    'build': '🏗️ Construction',
    'gather_wood': '🪵 Woodcutting',
    'gather_food': '🍎 Gathering',
    'hunt': '🏹 Hunting'
  };
  return labels[type] || type;
};

const getPriorityClass = (p) => {
  if (p >= 80) return 'high';
  if (p >= 40) return 'medium';
  return 'low';
};

const getIcon = (type, subType) => {
  if (subType === 'beehive') return '🍯';
  if (subType === 'fruit') return '🍎';
  if (type === 'tiger') return '🐅';
  if (type === 'lion') return '🦁';
  if (type === 'bear') return '🐻';
  if (type === 'fox') return '🦊';
  if (type === 'crocodile') return '🐊';
  if (type === 'deer') return '🦌';
  if (type === 'rabbit') return '🐇';
  if (type === 'horse') return '🐎';
  if (type === 'elephant') return '🐘';
  if (type === 'goat') return '🐐';
  
  const icons = {
    sheep: '🐑', cow: '🐄', human: '👤', bee: '🐝', wolf: '🐺',
    hyena: '🐾', wild_dog: '🐕',
    tree: '🌲', flower: '🌸', grass: '🌾', unknown: '❓'
  };
  return icons[type] || '❓';
};

const getPercentage = (val, max) => {
  if (!max) return 0;
  return Math.min(100, Math.max(0, (val / max) * 100));
};

const getItemEmoji = (type) => {
  const emojis = {
    wood: '🪵',
    food: '🍖',
    stone: '🪨',
    meat: '🥩',
    berry: '🫐',
    wheat: '🌾'
  };
  return emojis[type.toLowerCase()] || '📦';
};
</script>

<style scoped>
.entity-status-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 250px;
  max-height: 85vh;
  overflow-y: auto;
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

/* Custom Scrollbar */
.entity-status-panel::-webkit-scrollbar {
  width: 4px;
}
.entity-status-panel::-webkit-scrollbar-track {
  background: transparent;
}
.entity-status-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}
.entity-status-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

.panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 10px; }
.title-wrap { display: flex; align-items: center; gap: 8px; }
.title-wrap h3 { margin: 0; font-size: 1.1rem; color: #fff; }
.chief-tag {
  font-size: 1.1rem;
  filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.5));
  animation: float 2s ease-in-out infinite;
}
.icon { font-size: 1.2rem; }
.close-btn { background: none; border: none; color: #888; font-size: 1.2rem; cursor: pointer; }
.close-btn:hover { color: #fff; }

.panel-body { display: flex; flex-direction: column; gap: 8px; }
.status-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
.task-row {
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 10px;
  border-radius: 8px;
  border-left: 3px solid #4fc3f7;
}
.task-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.task-type {
  font-weight: bold;
  color: #fff;
  font-size: 0.8rem;
}
.task-priority {
  font-size: 0.65rem;
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 800;
}
.task-priority.high { background: #ef5350; color: #fff; }
.task-priority.medium { background: #ffa726; color: #fff; }
.task-priority.low { background: #66bb6a; color: #fff; }

.label { color: #aaa; width: 80px; }
.value { font-weight: bold; }
.value-sm { font-size: 0.75rem; color: #ccc; min-width: 45px; text-align: right; }

.state-badge.healthy, .state-badge.blooming { background: rgba(76, 175, 80, 0.3); color: #81c784; }

/* 🥩 Diet Badges */
.diet-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}
.diet-badge.carnivore { background: rgba(211, 47, 47, 0.2); color: #ff8a80; border: 1px solid rgba(211, 47, 47, 0.3); }
.diet-badge.herbivore { background: rgba(76, 175, 80, 0.2); color: #a5d6a7; border: 1px solid rgba(76, 175, 80, 0.3); }

.species-text {
  text-transform: capitalize;
  color: #fff;
  letter-spacing: 0.5px;
}

/* 🏷️ 직업 뱃지 */
.job-badge {
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  border: 1px solid currentColor;
  opacity: 0.95;
}

.progress-bar { flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 0 10px; overflow: hidden; }
.fill { height: 100%; transition: width 0.2s ease; }
.fill.stomach { background: #ff9800; }
.fill.fatigue { background: #9c27b0; } /* 😴 세련된 보라색 피로도 바 */
.fill.fertility { background: #4caf50; }
.fill.inventory { background: #2196f3; }

.inventory-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 5px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.inventory-bar {
  width: 100%;
  height: 6px;
  background: rgba(255,255,255,0.05);
  border-radius: 3px;
  overflow: hidden;
}

.item-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 5px;
}

.item-tag {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 2px 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
}

.item-icon { font-size: 0.9rem; }
.item-count { font-weight: bold; color: #fff; }

.divider { height: 1px; background: rgba(255,255,255,0.1); margin: 5px 0; }
.mt-1 { margin-top: 5px; }
.honey-text { color: #ffca28; font-size: 1rem; }
.yield-text { color: #ffab91; font-size: 0.85rem; }

.target-row {
  margin-top: 4px;
  padding: 4px 0;
  border-top: 1px dashed rgba(255,255,255,0.1);
}
.target-text {
  color: #4fc3f7;
  font-size: 0.8rem;
  font-style: italic;
}
.target-text.is-searching {
  color: #ffca28;
  animation: blink 1.5s infinite;
}

/* ⏳ Age & AI Stack Styles */
.age-row {
  margin-bottom: 4px;
}
.age-text {
  color: #fff;
  display: flex;
  align-items: center;
  gap: 6px;
}
.stage-tag {
  font-size: 0.65rem;
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  text-transform: uppercase;
  color: #81d4fa;
  border: 1px solid rgba(129, 212, 250, 0.3);
}
.stack-count {
  color: #ce93d8;
  font-size: 0.8rem;
}

/* 💀 God Power: KILL Button */
.action-section {
  margin-top: 10px;
  display: flex;
  justify-content: center;
}

.kill-btn {
  width: 100%;
  background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.3);
}

.kill-btn:hover {
  filter: brightness(1.2);
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(211, 47, 47, 0.4);
}

.kill-btn:active {
  transform: translateY(0);
}

.kill-icon {
  font-size: 1rem;
}

@keyframes blink {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
</style>