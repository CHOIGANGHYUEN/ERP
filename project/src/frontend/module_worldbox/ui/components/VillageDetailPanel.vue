<template>
  <Transition name="panel-slide">
    <div class="village-detail-panel" v-if="isOpen && villages.length > 0">
      <div class="panel-header">
        <div class="title">
          <span class="icon">🏘️</span>
          <h2>VILLAGE COMMAND CENTER</h2>
        </div>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <div class="panel-content">
        <div v-for="v in villages" :key="v.id" class="village-entry">
          <!-- 🏷️ Village Basic Info -->
          <div class="entry-header">
            <div class="v-main-info">
              <span class="v-name">{{ v.name }}</span>
              <div class="v-chief" v-if="v.chiefName">
                <span class="chief-label">CHIEF:</span>
                <span class="chief-name">👑 {{ v.chiefName }}</span>
              </div>
            </div>
            <div class="v-pop">
              <span class="pop-icon">👤</span>
              <span class="pop-count">{{ v.population }}</span>
            </div>
          </div>

          <div class="divider"></div>

          <!-- 📊 Resource & Logistics -->
          <div class="stats-section">
            <div class="section-title">LOGISTICS & STOCK</div>
            <div class="res-grid">
              <div class="res-item" :class="{ 'critical': v.food < v.foodNeed }">
                <div class="res-info">
                  <span class="res-icon">🍖</span>
                  <span class="res-label">Food</span>
                  <span class="res-values">{{ v.food }} / {{ v.foodNeed }}</span>
                </div>
                <div class="res-progress-bg">
                  <div class="res-progress-fill food" :style="{ width: Math.min(100, (v.food/150)*100) + '%' }"></div>
                </div>
              </div>

              <div class="res-item" :class="{ 'critical': v.wood < v.woodNeed }">
                <div class="res-info">
                  <span class="res-icon">🪵</span>
                  <span class="res-label">Wood</span>
                  <span class="res-values">{{ v.wood }} / {{ v.woodNeed }}</span>
                </div>
                <div class="res-progress-bg">
                  <div class="res-progress-fill wood" :style="{ width: Math.min(100, (v.wood/150)*100) + '%' }"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 🏗️ Infrastructure -->
          <div class="stats-section">
            <div class="section-title">INFRASTRUCTURE</div>
            <div class="infra-stats">
              <div class="infra-item">
                <span class="infra-icon">🏠</span>
                <span class="infra-label">Houses</span>
                <span class="infra-count">{{ v.houses }}</span>
              </div>
              <div class="infra-item">
                <span class="infra-icon">🏗️</span>
                <span class="infra-label">Buildings</span>
                <span class="infra-count">{{ v.buildings?.length || 0 }}</span>
              </div>
            </div>
          </div>

          <!-- 📋 Task Board (Detailed) -->
          <div class="stats-section" v-if="v.taskStats">
            <div class="section-title">STRATEGIC TASK BOARD</div>
            <div class="task-summary">
              <div class="task-stat">
                <span class="stat-val">{{ v.taskStats.available }}</span>
                <span class="stat-label">WAITING</span>
              </div>
              <div class="task-stat">
                <span class="stat-val">{{ v.taskStats.inProgress }}</span>
                <span class="stat-label">ACTIVE</span>
              </div>
              <div class="task-stat">
                <span class="stat-val">{{ v.taskStats.total }}</span>
                <span class="stat-label">TOTAL</span>
              </div>
            </div>

            <div class="task-list">
              <div v-for="task in v.tasks" :key="task.id" class="task-row">
                <span class="task-icon">{{ getTaskIcon(task.type) }}</span>
                <span class="task-name">{{ getTaskLabel(task.type) }}</span>
                <div class="task-meta">
                  <span class="task-priority" :class="getPriorityClass(task.priority)">P{{ task.priority }}</span>
                  <span class="task-status" :class="task.status.toLowerCase()">{{ task.status }}</span>
                </div>
              </div>
              <div v-if="v.taskStats.total > 5" class="more-tasks">
                and {{ v.taskStats.total - 5 }} more active tasks...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import { useWorldboxStore } from '../store/worldboxStore';

const store = useWorldboxStore();
const villages = computed(() => store.villages);
const isOpen = computed(() => store.showVillageInfo);

const close = () => {
  store.showVillageInfo = false;
};

const getTaskIcon = (type) => {
  const icons = {
    'build': '🏗️',
    'gather_wood': '🪵',
    'gather_food': '🍎',
    'hunt': '🏹'
  };
  return icons[type] || '📝';
};

const getTaskLabel = (type) => {
  const labels = {
    'build': 'Construction',
    'gather_wood': 'Woodcutting',
    'gather_food': 'Gathering',
    'hunt': 'Hunting'
  };
  return labels[type] || type;
};

const getPriorityClass = (p) => {
  if (p >= 80) return 'high';
  if (p >= 40) return 'medium';
  return 'low';
};
</script>

<style scoped>
.village-detail-panel {
  position: absolute;
  top: 20px;
  right: 280px; /* Offset from Inspector */
  width: 340px;
  max-height: 90vh;
  background: rgba(15, 15, 25, 0.85);
  backdrop-filter: blur(25px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  color: #fff;
  z-index: 1080;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8), 
              inset 0 0 20px rgba(255,255,255,0.02);
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}

.panel-header {
  padding: 18px 24px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title { display: flex; align-items: center; gap: 12px; }
.title h2 { 
  margin: 0; 
  font-size: 0.8rem; 
  letter-spacing: 3px; 
  font-weight: 900; 
  color: #81c784;
  text-transform: uppercase;
}
.icon { font-size: 1.3rem; filter: drop-shadow(0 0 5px rgba(129, 199, 132, 0.4)); }

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.close-btn:hover { 
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
  border-color: rgba(255, 82, 82, 0.3);
  transform: rotate(90deg);
}

.panel-content {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.village-entry { display: flex; flex-direction: column; gap: 15px; }

.entry-header { display: flex; justify-content: space-between; align-items: flex-start; }
.v-main-info { display: flex; flex-direction: column; gap: 4px; }
.v-name { font-size: 1.2rem; font-weight: 800; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
.v-chief { display: flex; align-items: center; gap: 6px; }
.chief-label { font-size: 0.6rem; color: #888; font-weight: bold; }
.chief-name { font-size: 0.75rem; color: #ffca28; font-weight: bold; }

.v-pop {
  background: rgba(76, 175, 80, 0.15);
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid rgba(76, 175, 80, 0.3);
  display: flex;
  align-items: center;
  gap: 6px;
}
.pop-count { font-weight: 900; font-size: 0.9rem; color: #81c784; }

.divider { height: 1px; background: linear-gradient(to right, rgba(255,255,255,0.1), transparent); }

.stats-section { display: flex; flex-direction: column; gap: 10px; }
.section-title { font-size: 0.65rem; font-weight: 800; letter-spacing: 1px; color: #555; }

.res-grid { display: flex; flex-direction: column; gap: 12px; }
.res-item { display: flex; flex-direction: column; gap: 6px; }
.res-info { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
.res-label { flex: 1; color: #bbb; }
.res-values { font-family: monospace; font-weight: bold; color: #eee; }

.res-progress-bg { height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; }
.res-progress-fill { height: 100%; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.res-progress-fill.food { background: linear-gradient(to right, #f57c00, #ffb74d); }
.res-progress-fill.wood { background: linear-gradient(to right, #5d4037, #8d6e63); }

.res-item.critical .res-values { color: #ff5252; }
.res-item.critical .res-progress-bg { background: rgba(255, 82, 82, 0.1); }

.infra-stats { display: flex; gap: 20px; }
.infra-item { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; flex: 1; }
.infra-label { font-size: 0.7rem; color: #888; flex: 1; }
.infra-count { font-weight: bold; font-size: 0.9rem; }

.task-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
  border-radius: 8px;
  text-align: center;
}
.task-stat { display: flex; flex-direction: column; gap: 2px; }
.stat-val { font-size: 1rem; font-weight: 900; color: #fff; }
.stat-label { font-size: 0.55rem; color: #666; font-weight: bold; }

.task-list { display: flex; flex-direction: column; gap: 6px; margin-top: 5px; }
.task-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.03);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
}
.task-name { flex: 1; font-weight: 500; color: #ccc; }
.task-meta { display: flex; gap: 8px; align-items: center; }

.task-priority { font-size: 0.6rem; font-weight: 800; padding: 1px 4px; border-radius: 4px; }
.task-priority.high { background: rgba(239, 83, 80, 0.2); color: #ef5350; }
.task-priority.medium { background: rgba(255, 167, 38, 0.2); color: #ffa726; }
.task-priority.low { background: rgba(102, 187, 106, 0.2); color: #66bb6a; }

.task-status { font-size: 0.6rem; opacity: 0.6; text-transform: uppercase; }
.task-status.claimed { color: #4fc3f7; opacity: 1; }

.more-tasks { font-size: 0.65rem; color: #444; text-align: center; margin-top: 5px; }

/* Animations */
.panel-slide-enter-active, .panel-slide-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(-50px); opacity: 0; }

.panel-content::-webkit-scrollbar { width: 4px; }
.panel-content::-webkit-scrollbar-track { background: transparent; }
.panel-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
</style>
