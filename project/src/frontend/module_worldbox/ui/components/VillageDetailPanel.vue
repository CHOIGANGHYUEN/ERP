<template>
  <Transition name="panel-slide">
    <div 
      class="village-detail-panel" 
      v-if="isOpen && villages.length > 0"
      :style="panelStyle"
      :class="{ 'minimized': isMinimized }"
    >
      <div class="panel-header" @mousedown="startDrag">
        <div class="title">
          <span class="icon">🏘️</span>
          <h2>VILLAGE COMMAND CENTER</h2>
        </div>
        <div class="header-actions">
          <button class="action-btn minimize-btn" @click.stop="isMinimized = !isMinimized">{{ isMinimized ? '□' : '−' }}</button>
          <button class="action-btn close-btn" @click.stop="close">✕</button>
        </div>
      </div>
 
      <div class="panel-content" v-show="!isMinimized">
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
              <div v-if="v.food !== undefined" class="res-item" :class="{ 'critical': v.food < v.foodNeed }">
                <div class="res-info">
                  <span class="res-icon">🍖</span>
                  <span class="res-label">Food</span>
                  <span class="res-values">{{ Math.floor(v.food) }} / {{ Math.floor(v.foodNeed || 0) }}</span>
                </div>
                <div class="res-progress-bg">
                  <div class="res-progress-fill food" :style="{ width: Math.min(100, (v.food/150)*100) + '%' }"></div>
                </div>
              </div>

              <div v-if="v.wood !== undefined" class="res-item" :class="{ 'critical': v.wood < v.woodNeed }">
                <div class="res-info">
                  <span class="res-icon">🪵</span>
                  <span class="res-label">Wood</span>
                  <span class="res-values">{{ Math.floor(v.wood) }} / {{ Math.floor(v.woodNeed || 0) }}</span>
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
                <span class="infra-icon">🗺️</span>
                <span class="infra-label">Territory</span>
                <span class="infra-count">{{ v.territorySize || 1 }} Tiles</span>
              </div>
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

          <!-- 🗺️ Territory Mini Map (Vue 패널 내부 타일 시각화) -->
          <div class="stats-section" v-if="v.territoryList && v.territoryList.length">
            <div class="section-title">TERRITORY MAP</div>
            <div class="territory-map-container">
              <svg class="mini-map-svg" :viewBox="getTerritoryViewBox(v.territoryList)">
                <rect v-for="(t, i) in getTerritoryCoords(v.territoryList)" :key="i"
                      :x="t.x" :y="t.y" width="1" height="1" rx="0.1"
                      fill="rgba(76, 175, 80, 0.4)" stroke="#81c784" stroke-width="0.05" />
                <!-- 마을 중심점(촌장) -->
                <circle v-if="v.centerX" :cx="v.centerX / 16" :cy="v.centerY / 16" r="0.3" fill="#ffca28" stroke="#333" stroke-width="0.05"/>
              </svg>
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
import { computed, watch, ref } from 'vue';
import { useWorldboxStore } from '../store/worldboxStore';
 
const store = useWorldboxStore();
const villages = computed(() => store.villages);
const isOpen = computed(() => store.showVillageInfo);

// --- Window Management ---
const isMinimized = ref(false);
const position = ref({ x: 300, y: 20 }); // Initial offset
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

// 💡 사용자의 정확한 지적대로, 패널 내부에서 직접 엔진 렌더링 플래그를 통제합니다!
watch(isOpen, (val) => {
  if (window.gameEngine) {
    window.gameEngine.viewFlags = window.gameEngine.viewFlags || {};
    // ❌ 원형 디버그 뷰를 이 패널에서 강제로 완전히 꺼버립니다.
    window.gameEngine.viewFlags.showVillageInfo = false;
    window.gameEngine.viewFlags.showVillages = false;
    // ✅ 오직 타일 렌더링(VILLAGETILE)만 작동하도록 지시합니다.
    window.gameEngine.viewFlags.VILLAGETILE = val;
  }
}, { immediate: true });

const close = () => {
  store.closeVillageInfo();
};

const getTerritoryCoords = (list) => {
  if(!list) return [];
  return list.map(key => {
    const x = key & 0xFFFF;
    const y = key >> 16;
    return { x, y };
  });
};

const getTerritoryViewBox = (list) => {
  if(!list || !list.length) return "0 0 10 10";
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  list.forEach(key => {
    const x = key & 0xFFFF;
    const y = key >> 16;
    if(x<minX) minX=x; if(y<minY) minY=y;
    if(x>maxX) maxX=x; if(y>maxY) maxY=y;
  });
  const width = Math.max(4, maxX - minX + 2);
  const height = Math.max(4, maxY - minY + 2);
  return `${minX - 0.5} ${minY - 0.5} ${width} ${height}`;
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
  width: 360px;
  max-height: 90vh;
  background: rgba(10, 10, 15, 0.7);
  backdrop-filter: blur(30px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  color: #fff;
  z-index: 1080;
  pointer-events: auto;
  box-shadow: 0 40px 80px rgba(0,0,0,0.8), inset 0 2px 20px rgba(255,255,255,0.05);
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (max-width: 768px) {
  .village-detail-panel {
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
  padding: 18px 24px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.08), transparent);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: grab;
}
.panel-header:active { cursor: grabbing; }

.title { display: flex; align-items: center; gap: 12px; }
.title h2 { 
  margin: 0; 
  font-size: 0.85rem; 
  letter-spacing: 3px; 
  font-weight: 900; 
  color: #a5d6a7;
  text-transform: uppercase;
}
.icon { font-size: 1.3rem; filter: drop-shadow(0 0 8px rgba(165, 214, 167, 0.6)); }

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
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

.action-btn:hover { 
  background: rgba(255,255,255,0.15);
  color: #fff;
  transform: scale(1.1);
}

.close-btn:hover { 
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
  border-color: rgba(255, 82, 82, 0.4);
  box-shadow: 0 0 15px rgba(255, 82, 82, 0.3);
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
.v-name { font-size: 1.3rem; font-weight: 900; color: #fff; text-shadow: 0 2px 10px rgba(255,255,255,0.2); }
.v-chief { display: flex; align-items: center; gap: 6px; }
.chief-label { font-size: 0.6rem; color: #888; font-weight: bold; }
.chief-name { font-size: 0.75rem; color: #ffd54f; font-weight: bold; text-shadow: 0 0 8px rgba(255, 213, 79, 0.4); }

.v-pop {
  background: rgba(76, 175, 80, 0.15);
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid rgba(76, 175, 80, 0.4);
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.15);
}
.pop-count { font-weight: 900; font-size: 0.95rem; color: #a5d6a7; }

.divider { height: 1px; background: linear-gradient(to right, rgba(255,255,255,0.15), transparent); }

.stats-section { display: flex; flex-direction: column; gap: 10px; }
.section-title { font-size: 0.65rem; font-weight: 800; letter-spacing: 1px; color: #777; text-transform: uppercase; }

.res-grid { display: flex; flex-direction: column; gap: 12px; }
.res-item { display: flex; flex-direction: column; gap: 6px; }
.res-info { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
.res-label { flex: 1; color: #ddd; font-weight: 500; }
.res-values { font-family: monospace; font-weight: bold; color: #fff; }

.res-progress-bg { height: 8px; background: rgba(0,0,0,0.4); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); }
.res-progress-fill { height: 100%; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 4px; position: relative; }
.res-progress-fill::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shimmer 2s infinite;
}
@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

.res-progress-fill.food { background: linear-gradient(90deg, #f57c00, #ffb74d); box-shadow: 0 0 10px rgba(255, 183, 77, 0.5); }
.res-progress-fill.wood { background: linear-gradient(90deg, #5d4037, #8d6e63); box-shadow: 0 0 10px rgba(141, 110, 99, 0.5); }

.res-item.critical .res-values { color: #ff5252; text-shadow: 0 0 8px rgba(255, 82, 82, 0.5); }
.res-item.critical .res-progress-bg { background: rgba(255, 82, 82, 0.15); border-color: rgba(255, 82, 82, 0.3); }

.infra-stats { display: flex; gap: 10px; }
.infra-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(255,255,255,0.03); padding: 12px 5px; border-radius: 12px; flex: 1; text-align: center; border: 1px solid rgba(255,255,255,0.05); transition: transform 0.2s; }
.infra-item:hover { transform: translateY(-2px); background: rgba(255,255,255,0.06); }
.infra-label { font-size: 0.65rem; color: #999; font-weight: bold; text-transform: uppercase; }
.infra-count { font-weight: 900; font-size: 0.9rem; color: #fff; }

.territory-map-container {
  width: 100%;
  height: 120px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  box-sizing: border-box;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
}
.mini-map-svg {
  width: 100%;
  height: 100%;
  max-height: 110px;
  filter: drop-shadow(0 0 8px rgba(76, 175, 80, 0.3));
}

.task-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(255,255,255,0.05);
}
.task-stat { display: flex; flex-direction: column; gap: 2px; }
.stat-val { font-size: 1.1rem; font-weight: 900; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.2); }
.stat-label { font-size: 0.55rem; color: #888; font-weight: bold; letter-spacing: 1px; }

.task-list { display: flex; flex-direction: column; gap: 8px; margin-top: 5px; }
.task-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255,255,255,0.04);
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.8rem;
  border: 1px solid rgba(255,255,255,0.03);
  transition: transform 0.2s, background 0.2s;
}
.task-row:hover { transform: translateX(4px); background: rgba(255,255,255,0.08); }
.task-name { flex: 1; font-weight: 600; color: #eee; }
.task-meta { display: flex; gap: 8px; align-items: center; }

.task-priority { font-size: 0.6rem; font-weight: 900; padding: 2px 6px; border-radius: 6px; letter-spacing: 0.5px; }
.task-priority.high { background: rgba(239, 83, 80, 0.15); color: #ef5350; border: 1px solid rgba(239, 83, 80, 0.3); }
.task-priority.medium { background: rgba(255, 167, 38, 0.15); color: #ffa726; border: 1px solid rgba(255, 167, 38, 0.3); }
.task-priority.low { background: rgba(102, 187, 106, 0.15); color: #66bb6a; border: 1px solid rgba(102, 187, 106, 0.3); }

.task-status { font-size: 0.6rem; opacity: 0.7; text-transform: uppercase; font-weight: bold; }
.task-status.claimed { color: #4fc3f7; opacity: 1; text-shadow: 0 0 5px rgba(79, 195, 247, 0.4); }

.more-tasks { font-size: 0.65rem; color: #666; text-align: center; margin-top: 8px; font-weight: 500; }

/* 💎 Premium 3D Animations */
.panel-slide-enter-active, .panel-slide-leave-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-enter-from, .panel-slide-leave-to { 
  transform: translateX(-30px) scale(0.95); 
  opacity: 0; 
  filter: blur(10px);
}

.panel-content::-webkit-scrollbar { width: 4px; }
.panel-content::-webkit-scrollbar-track { background: transparent; }
.panel-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
</style>
