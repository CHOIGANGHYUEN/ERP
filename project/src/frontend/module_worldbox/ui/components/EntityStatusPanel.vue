<template>
  <Transition name="slide-fade">
    <div v-if="isOpen && entity" class="entity-status-panel">
      <template v-if="entity">
        <div class="panel-header">
          <div class="entity-icon">{{ getIcon }}</div>
          <div class="entity-info">
            <h3>{{ entity.type?.toUpperCase() }}</h3>
            <span class="entity-id">#{{ entity.id }}</span>
          </div>
          <button @click="close" class="close-btn">×</button>
        </div>

        <div class="panel-body">
          <div class="status-grid">
            <div class="status-item">
              <label>MODE</label>
              <div class="value mode" :class="entity.mode?.toLowerCase()">{{ entity.mode }}</div>
            </div>
            <div class="status-item">
              <label>AGE</label>
              <div class="value">{{ entity.isBaby ? 'Baby' : 'Adult' }}</div>
            </div>
          </div>

          <div class="meter-section">
            <label>STOMACH (Undigested)</label>
            <div class="meter-container">
              <div class="meter-fill stomach" :style="{ width: (entity.stomach / (entity.maxStomach || 2) * 100) + '%' }"></div>
            </div>
            <div class="meter-labels">
              <span>Empty</span>
              <span>{{ (entity.stomach || 0).toFixed(2) }} / {{ entity.maxStomach || 2 }}</span>
              <span>Full</span>
            </div>
          </div>

          <div class="meter-section">
            <label>WASTE (Ready to Excrete)</label>
            <div class="meter-container">
              <div class="meter-fill" :style="{ width: (entity.fertility * 50) + '%', background: getFertilityColor }"></div>
            </div>
            <div class="meter-labels">
              <span>Low</span>
              <span>{{ (entity.fertility || 0).toFixed(2) }} / 1.0</span>
              <span>Crit</span>
            </div>
          </div>

          <div class="trait-section" v-if="entity.diet">
            <label>DIET</label>
            <div class="trait-tag">{{ entity.diet?.toUpperCase() }}</div>
          </div>

          <div class="action-section">
            <p v-if="entity.mode === 'eat'" class="action-desc">Searching for tasty grass...</p>
            <p v-if="entity.mode === 'wander'" class="action-desc">Exploring the world...</p>
            <p v-if="entity.isPooping" class="action-desc warning">⚠️ Metabolizing... shaking eyes!</p>
          </div>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import { useWorldboxStore } from '../store/worldboxStore';

const store = useWorldboxStore();
const entity = computed(() => store.selectedEntity);
const isOpen = computed(() => store.isPanelOpen);

const getIcon = computed(() => {
  if (entity.value?.type === 'sheep') return '🐑';
  if (entity.value?.type === 'human') return '👤';
  return '❓';
});

const getFertilityColor = computed(() => {
  const f = entity.value?.fertility || 0;
  if (f > 1.5) return 'linear-gradient(90deg, #4caf50, #8bc34a)';
  if (f > 0.5) return 'linear-gradient(90deg, #ffeb3b, #fbc02d)';
  return 'linear-gradient(90deg, #ff7043, #d84315)';
});

const close = () => store.closePanel();
</script>

<style scoped>
.entity-status-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 280px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  color: white;
  padding: 20px;
  z-index: 1000;
  font-family: 'Inter', sans-serif;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 15px;
}

.entity-icon {
  font-size: 32px;
  background: rgba(255, 255, 255, 0.05);
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.entity-info h3 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 1px;
}

.entity-id {
  font-size: 12px;
  color: #94a3b8;
}

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover { color: white; }

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
}

.status-item label {
  display: block;
  font-size: 10px;
  color: #64748b;
  margin-bottom: 5px;
  letter-spacing: 0.5px;
}

.value {
  font-weight: 600;
  font-size: 14px;
}

.value.mode {
  color: #60a5fa;
}

.meter-section {
  margin-bottom: 20px;
}

.meter-section label {
  font-size: 10px;
  color: #64748b;
  display: block;
  margin-bottom: 8px;
}

.meter-container {
  height: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}

.meter-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.meter-fill.stomach {
  background: linear-gradient(90deg, #ffb74d, #ffa726);
}

.meter-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #475569;
}

.trait-tag {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.action-desc {
  font-size: 13px;
  color: #cbd5e1;
  font-style: italic;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.action-desc.warning { color: #fbbf24; }

/* Transitions */
.slide-fade-enter-active { transition: all 0.3s ease-out; }
.slide-fade-leave-active { transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1); }
.slide-fade-enter-from, .slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
