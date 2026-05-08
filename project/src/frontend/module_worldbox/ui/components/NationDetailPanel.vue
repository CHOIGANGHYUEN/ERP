<template>
  <Transition name="slide-right">
    <div 
      v-if="store.showNationInfo" 
      class="nation-panel"
      :style="panelStyle"
      :class="{ 'minimized': isMinimized }"
    >
      <div class="panel-header" @mousedown="startDrag">
        <div class="header-main">
          <span class="icon">🚩</span>
          <h2>EMPIRE OVERVIEW</h2>
        </div>
        <div class="header-actions">
          <button class="action-btn minimize-btn" @click.stop="isMinimized = !isMinimized">{{ isMinimized ? '□' : '−' }}</button>
          <button class="action-btn close-btn" @click.stop="closePanel">×</button>
        </div>
      </div>

      <div class="panel-content custom-scrollbar" v-show="!isMinimized">
        <div v-if="store.nations.length === 0" class="empty-state">
          No nations founded yet. Expand your territory!
        </div>

        <div v-for="nation in store.nations" :key="nation.id" class="nation-card">
          <div class="nation-banner" :style="{ backgroundColor: nation.color }">
            <div class="nation-name">{{ nation.name }}</div>
            <div class="nation-id">#{{ nation.id }}</div>
          </div>

          <div class="nation-stats-grid">
            <div class="stat-box">
              <div class="stat-label">POPULATION</div>
              <div class="stat-value">{{ nation.population }}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">VILLAGES</div>
              <div class="stat-value">{{ nation.villageCount }}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">TERRITORY</div>
              <div class="stat-value">{{ nation.territorySize || 0 }}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">STABILITY</div>
              <div class="stat-value">{{ nation.stability ?? 70 }}%</div>
            </div>
          </div>

          <div v-if="nation.resources" class="resource-section">
            <div class="section-title">🏛️ NATIONAL TREASURY</div>
            <div class="resource-grid">
              <div class="res-item">
                <span class="res-icon">🪵</span>
                <span class="res-val">{{ Math.floor(nation.resources.wood || 0) }}</span>
              </div>
              <div class="res-item">
                <span class="res-icon">🍎</span>
                <span class="res-val">{{ Math.floor(nation.resources.food || 0) }}</span>
              </div>
              <div class="res-item">
                <span class="res-icon">🪨</span>
                <span class="res-val">{{ Math.floor(nation.resources.stone || 0) }}</span>
              </div>
              <div class="res-item">
                <span class="res-icon">💰</span>
                <span class="res-val">{{ Math.floor(nation.resources.gold || 0) }}</span>
              </div>
            </div>
            <div class="tax-info">
              Tax Rate: {{ (nation.taxRate * 100).toFixed(0) }}% per cycle
            </div>
          </div>

          <div class="progress-section">
            <div class="metric-row">
              <span>Culture</span>
              <strong>{{ nation.culture || 0 }}</strong>
            </div>
            <div class="metric-row">
              <span>Tech</span>
              <strong>{{ nation.tech || 0 }}</strong>
            </div>
            <div class="metric-row">
              <span>Prestige</span>
              <strong>{{ nation.prestige || 0 }}</strong>
            </div>
          </div>

          <div v-if="nation.diplomacy && nation.diplomacy.length" class="diplomacy-section">
            <div class="section-title">DIPLOMACY</div>
            <div v-for="rel in nation.diplomacy" :key="rel.nationId" class="relation-row">
              <span class="relation-dot" :style="{ backgroundColor: rel.color }"></span>
              <span class="relation-name">{{ rel.name }}</span>
              <span class="relation-state" :class="stateClass(rel.state)">
                {{ stateLabel(rel.state) }} {{ rel.opinion }}
              </span>
            </div>
          </div>

          <div v-if="nation.villages && nation.villages.length" class="village-section">
            <div class="section-title">VILLAGES</div>
            <div v-for="village in nation.villages" :key="village.id" class="village-row">
              <div>
                <strong>{{ village.name }}</strong>
                <span>{{ village.population }} pop · {{ village.territorySize }} tiles</span>
              </div>
              <div class="loyalty-pill" :class="{ low: village.loyalty < 35 }">
                {{ village.loyalty }}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useWorldboxStore } from '../store/worldboxStore';
const store = useWorldboxStore();

// --- Window Management ---
const isMinimized = ref(false);
const position = ref({ x: 20, y: 80 }); // Initial offset
const isDragging = ref(false);
let dragOffset = { x: 0, y: 0 };

const panelStyle = computed(() => ({
  top: `${position.value.y}px`,
  right: `${position.value.x}px`,
}));

const startDrag = (e) => {
  isDragging.value = true;
  dragOffset = {
    x: e.clientX + position.value.x,
    y: e.clientY - position.value.y
  };
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
};

const onDrag = (e) => {
  if (!isDragging.value) return;
  position.value = {
    x: dragOffset.x - e.clientX,
    y: e.clientY - dragOffset.y
  };
};

const stopDrag = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
};
// -------------------------

const stateLabel = (state) => {
  if (state === 'war') return 'WAR';
  if (state === 'ally') return 'ALLY';
  if (state === 'hostile') return 'HOSTILE';
  return 'NEUTRAL';
};

const stateClass = (state) => ({
  war: state === 'war',
  ally: state === 'ally',
  hostile: state === 'hostile'
});

const closePanel = () => {
  store.closeNationInfo();
  if (window.gameEngine) {
    if (window.gameEngine.preRenderTerrain) window.gameEngine.preRenderTerrain();
  }
};
</script>

<style scoped>
.nation-panel {
  position: absolute;
  width: 320px;
  max-height: calc(100% - 150px);
  background: rgba(10, 15, 25, 0.9);
  backdrop-filter: blur(25px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 40px 100px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.01);
  z-index: 1100;
  pointer-events: auto;
  color: #fff;
  overflow: hidden;
}

@media (max-width: 768px) {
  .nation-panel {
    top: auto;
    right: 10px;
    left: 10px;
    bottom: 100px;
    width: auto;
    max-height: 50vh;
    border-radius: 16px;
  }
}

.panel-header {
  padding: 15px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: grab;
}
.panel-header:active { cursor: grabbing; }

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-main h2 {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 2px;
  font-weight: 900;
  color: #4fc3f7;
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn:hover { 
  background: rgba(255,255,255,0.1);
  color: #fff;
  transform: scale(1.1);
}

.close-btn:hover { color: #ff5252; background: rgba(255,82,82,0.2); border-color: rgba(255,82,82,0.3); }

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.nation-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 20px;
  overflow: hidden;
}

.nation-banner {
  padding: 12px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.nation-name {
  font-weight: 900;
  font-size: 1.1rem;
  letter-spacing: 1px;
}

.nation-id {
  font-size: 0.7rem;
  opacity: 0.7;
  font-weight: bold;
}

.nation-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.stat-box {
  background: rgba(10, 15, 25, 0.6);
  padding: 12px;
  text-align: center;
}

.stat-label {
  font-size: 0.6rem;
  color: #888;
  font-weight: bold;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 800;
  color: #4fc3f7;
}

.resource-section {
  padding: 15px;
}

.section-title {
  font-size: 0.65rem;
  font-weight: 800;
  color: #ffeb3b;
  margin-bottom: 12px;
  letter-spacing: 1px;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.res-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 12px;
  border-radius: 8px;
}

.res-val {
  font-family: 'Cascadia Code', monospace;
  font-weight: 700;
  font-size: 0.9rem;
}

.tax-info {
  margin-top: 12px;
  font-size: 0.65rem;
  color: #666;
  text-align: right;
  font-style: italic;
}

.progress-section,
.diplomacy-section,
.village-section {
  padding: 0 15px 15px;
}

.metric-row,
.relation-row,
.village-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 28px;
  font-size: 0.72rem;
  color: #cfd8dc;
}

.metric-row strong {
  color: #ffffff;
  font-family: 'Cascadia Code', monospace;
}

.relation-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.relation-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.relation-state,
.loyalty-pill {
  border-radius: 8px;
  padding: 3px 7px;
  background: rgba(255, 255, 255, 0.08);
  color: #b0bec5;
  font-size: 0.62rem;
  font-weight: 800;
}

.relation-state.ally { color: #81c784; }
.relation-state.hostile { color: #ffb74d; }
.relation-state.war,
.loyalty-pill.low { color: #ff8a80; }

.village-row div:first-child {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.village-row strong {
  color: #ffffff;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.village-row span {
  color: #78909c;
  font-size: 0.62rem;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 0.8rem;
  font-style: italic;
}

/* Animations */
.slide-right-enter-active, .slide-right-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-right-enter-from, .slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
</style>
