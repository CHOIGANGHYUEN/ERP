<template>
  <Transition name="slide-right">
    <div v-if="store.showNationInfo" class="nation-panel">
      <div class="panel-header">
        <div class="header-main">
          <span class="icon">🚩</span>
          <h2>EMPIRE OVERVIEW</h2>
        </div>
        <button class="close-btn" @click="closePanel">×</button>
      </div>

      <div class="panel-content custom-scrollbar">
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
          </div>

          <div class="resource-section">
            <div class="section-title">🏛️ NATIONAL TREASURY</div>
            <div class="resource-grid">
              <div class="res-item">
                <span class="res-icon">🪵</span>
                <span class="res-val">{{ Math.floor(nation.resources.wood) }}</span>
              </div>
              <div class="res-item">
                <span class="res-icon">🍎</span>
                <span class="res-val">{{ Math.floor(nation.resources.food) }}</span>
              </div>
              <div class="res-item">
                <span class="res-icon">🪨</span>
                <span class="res-val">{{ Math.floor(nation.resources.stone) }}</span>
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
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useWorldboxStore } from '../store/worldboxStore';
const store = useWorldboxStore();

const closePanel = () => {
  store.showNationInfo = false;
  if (window.gameEngine) {
    window.gameEngine.toggleView('view_nation');
  }
};
</script>

<style scoped>
.nation-panel {
  position: absolute;
  top: 80px;
  right: 20px;
  width: 320px;
  max-height: calc(100% - 150px);
  background: rgba(10, 15, 25, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 15px 50px rgba(0,0,0,0.6);
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
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-main h2 {
  margin: 0;
  font-size: 0.9rem;
  letter-spacing: 2px;
  font-weight: 800;
  color: #4fc3f7;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover { color: #fff; }

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
