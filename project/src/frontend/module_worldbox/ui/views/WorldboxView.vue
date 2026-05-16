<template>
  <div class="worldbox-container" ref="worldboxContainer">
    <canvas ref="gameCanvas" id="worldbox-canvas"></canvas>
    
    <!-- 🎭 Cinematic Overlay -->
    <div class="vignette-overlay"></div>
    <div class="color-grade-layer"></div>
    
    <!-- UI Overlay - Always on top -->
    <div class="ui-overlay" :class="{ 'menu-active': isMenuOpen }">
      <!-- Detailed Inspection Panel -->
      <EntityStatusPanel />
      <JobMonitorPanel />

      <!-- TOP HUD (Global Status Bar) -->
      <Transition name="fade">
        <div class="top-hud" v-if="isGameStarted">
          <div class="hud-left">
            <span class="hud-logo">WORLD<span class="hl">BOX</span></span>
          </div>
          <div class="hud-center">
            <div class="hud-badge"><span class="icon">⏱️</span> {{ fps }} FPS</div>
            <div class="hud-badge"><span class="icon">👥</span> {{ entityCount }} Ents</div>
            <div class="hud-badge" v-if="dodStats"><span class="icon">💾</span> {{ dodStats.bufferMemoryMB }} MB</div>
          </div>
          <div class="hud-right">
            <!-- Time Controls -->
            <div class="time-controls">
              <button v-for="speed in [1, 2, 3, 5]" :key="speed" 
                :class="{ active: currentGameSpeed === speed }"
                @click="setGameSpeed(speed)" class="speed-btn">
                {{ speed }}x
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <VillageDetailPanel />
      <NationDetailPanel />

      <!-- PREMIUM DOCK (macOS Style) -->
      <div class="premium-dock" v-if="isGameStarted">
        <!-- Sub Dock (Tools) -->
        <Transition name="slide-up">
          <div v-if="activeCategory && isMenuOpen" class="sub-dock">
            <div v-for="tool in filteredTools" :key="tool.id" 
                 class="dock-item tool"
                 :class="{ active: activeTool === tool.id }"
                 @click="selectTool(tool)">
              <div class="icon">{{ tool.icon }}</div>
              <div class="tooltip">{{ tool.name }}</div>
              <div class="active-dot" v-if="activeTool === tool.id"></div>
            </div>
            
            <div v-if="showBrushSettings" class="dock-divider"></div>
            <div v-if="showBrushSettings" class="dock-brush-slider">
              <span class="slider-label">SIZE: {{ brushSize }}</span>
              <input type="range" min="2" max="100" v-model="brushSize" @input="updateBrushSize" />
            </div>
          </div>
        </Transition>

        <!-- Main Dock (Categories) -->
        <div class="main-dock">
           <div class="dock-bg"></div>
           
           <button class="dock-item menu-toggle" :class="{ active: isMenuOpen }" @click="toggleMenu">
             <div class="icon">{{ isMenuOpen ? '▼' : '🛠️' }}</div>
             <div class="tooltip">Toggle Tools</div>
           </button>
           
           <Transition name="fade-slide-horizontal">
             <div class="dock-categories" v-show="isMenuOpen">
               <div class="dock-divider"></div>
               <div v-for="cat in toolCategories" :key="cat.name" 
                    class="dock-item category"
                    :class="{ active: activeCategory === cat.name }"
                    @click="activeCategory = cat.name">
                 <div class="icon" :style="{ filter: activeCategory === cat.name ? 'grayscale(0)' : 'grayscale(100%)' }">{{ cat.icon }}</div>
                 <div class="tooltip">{{ cat.name }}</div>
                 <div class="active-dot" v-if="activeCategory === cat.name"></div>
               </div>
             </div>
           </Transition>
        </div>
      </div>

      <!-- 🚀 [Expert Design] Intro / Start Screen -->
      <Transition name="fade-scale">
        <div v-if="!isGameStarted && !showMapSettings" class="intro-screen">
          <div class="intro-content">
            <div class="logo-wrapper">
              <h1 class="logo-text">WORLD<span>BOX</span></h1>
              <div class="logo-sub">CREATIVE SIMULATION ENGINE</div>
            </div>
            
            <div class="intro-desc">
              A high-performance ecological and civilization sandbox. <br/>
              Create biomes, nurture life, and observe the rise of empires.
            </div>

            <button class="start-btn" @click="showMapSettings = true">
              <span class="btn-shine"></span>
              <span class="btn-text">INITIALIZE UNIVERSE</span>
              <span class="btn-icon">⚡</span>
            </button>
            
            <div class="version-tag">STABLE BUILD V2.5.0</div>
          </div>
        </div>
      </Transition>

    </div> <!-- End of UI Overlay -->

    <!-- 🗺️ Map Settings Modal - Moved outside overlay for better isolation -->
    <Transition name="fade">
      <MapSettings 
        v-if="showMapSettings" 
        @cancel="showMapSettings = false"
        @confirm="handleMapConfirm"
      />
    </Transition>

    <!-- 📂 Hidden File Input for Save Import -->
    <input 
      type="file" 
      ref="saveFileInput" 
      style="display: none" 
      accept=".json" 
      @change="onSaveFileSelected"
    />
  </div>
</template>



<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Engine from '../../engine/core/Engine.js';
import { DefaultTools } from '../../engine/core/ToolRegistry.js';

import { useWorldboxStore } from '../store/worldboxStore';
import EntityStatusPanel from '../components/EntityStatusPanel.vue';
import VillageDetailPanel from '../components/VillageDetailPanel.vue';
import NationDetailPanel from '../components/NationDetailPanel.vue';
import MapSettings from '../components/MapSettings.vue';
import JobMonitorPanel from '../components/JobMonitorPanel.vue';

const worldboxContainer = ref(null);
const gameCanvas = ref(null);
const toolTabsContainer = ref(null); // 📜 Mouse wheel scroll reference
const saveFileInput = ref(null); // 📂 Save file input reference
const isMenuOpen = ref(false);
const activeTool = ref('move_hand');
const showMapSettings = ref(false);
const isGameStarted = ref(false);
const brushSize = ref(15);
const spreadSpeed = ref(10);
const spreadAmount = ref(3000);
const fps = ref(0);
const entityCount = ref(0);
const totalFertility = ref(0);
const totalMaxFertility = ref(0);
const dodStats = ref(null);
const hoveredTool = ref(null);
const currentGameSpeed = ref(1);

const engine = ref(null);
const allTools = ref([]);
const isMobile = ref(window.innerWidth <= 768);
const showDebugCollapse = ref(false);
let resizeObserver = null;

const store = useWorldboxStore();

// 🖱️ Mouse wheel to Horizontal Scroll
const handleWheelScroll = (e) => {
  if (toolTabsContainer.value) {
    e.preventDefault();
    // Scroll faster for better UX
    toolTabsContainer.value.scrollLeft += e.deltaY * 1.5;
  }
};

const scrollToActiveTab = () => {
  const activeBtn = toolTabsContainer.value?.querySelector('button.active');
  if (activeBtn) {
    activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
};

const handleMouseMove = (e) => {
  if (engine.value) {
    // Basic engine mouse move logic (if any specific Vue-side handling was needed)
  }
};



const toolCategories = [
  { name: 'Landscape', icon: '🌍' },
  { name: 'Nature', icon: '🌱' },
  { name: 'Resources', icon: '⛏️' },
  { name: 'Items', icon: '📦' },
  { name: 'Life', icon: '🐑' },
  { name: 'Civilization', icon: '🏘️' },
  { name: 'God Powers', icon: '⚡' },
  { name: 'Interaction', icon: '🤝' },
  { name: 'View', icon: '👁️' },
  { name: 'System', icon: '⚙️' }
];

const activeCategory = ref('Landscape');

const filteredTools = computed(() => {
  return allTools.value.filter(t => t.category === activeCategory.value);
});

// 📱 탭 변경 시 자동 스크롤
watch(activeCategory, () => {
  setTimeout(scrollToActiveTab, 50);
});

// 🔄 도구 변경 시 UI 브러쉬 크기 동기화
watch(activeTool, (newId) => {
  const tool = allTools.value.find(t => t.id === newId);
  if (tool && tool.isBrush && tool.brushSize) {
    brushSize.value = tool.brushSize;
    if (engine.value) engine.value.brushSize = tool.brushSize;
  }
});

const activeToolData = computed(() => {
  return allTools.value.find(t => t.id === activeTool.value);
});

const setGameSpeed = (speed) => {
  currentGameSpeed.value = speed;
  if (engine.value) {
    engine.value.dispatchCommand({
      type: 'SET_GAME_SPEED',
      payload: { speed }
    });
  }
};


const showBrushSettings = computed(() => {
  const tool = activeToolData.value;
  if (!tool) return false;
  // 🎨 명시적 속성 체크 또는 ID 패턴 매칭 (보강됨)
  return tool.isBrush === true || 
         tool.id?.includes('paint_') || 
         tool.id?.includes('spawn_') || 
         tool.id?.includes('fill_');
});

const updateBrushSize = () => {
  if (engine.value) {
    engine.value.brushSize = Number(brushSize.value);
    console.log(`🎨 Brush Size Updated in Engine: ${engine.value.brushSize}`);
  }
};

const updateSimParams = () => {
  if (engine.value) {
    engine.value.simParams.spreadSpeed = Number(spreadSpeed.value) / 100;
    engine.value.simParams.spreadAmount = Number(spreadAmount.value);
  }
};

const selectTool = (tool) => {
  console.log(`🎯 Tool Selected: ${tool.name} (${tool.id}), isBrush: ${tool.isBrush}`);
  
  // ⚡ [Expert UI] Instant tools (Save, Load, Toggle, etc.)
  if (tool.isInstant) {
    if (tool.execute) {
      tool.execute({ engine: engine.value });
    }

    // 🚀 [Time Control Sync] SpeedTool인 경우 전역 상태 업데이트
    if (tool.speed !== undefined) {
      currentGameSpeed.value = tool.speed;
    }

    if (tool.id.startsWith('view_')) {
      const panelView = tool.id === 'view_village' || tool.id === 'view_nation' || tool.id === 'view_job_monitor';
      if (tool.id === 'view_village') store.showVillageInfo = !store.showVillageInfo;
      if (tool.id === 'view_nation') store.showNationInfo = !store.showNationInfo;
      if (tool.id === 'view_job_monitor') store.showJobMonitor = !store.showJobMonitor;
      
      // 🚀 [BugFix] tool.execute() 내부에서 이미 toggleView를 호출하므로 여기서 중복 호출 금지 (이중 토글 방지)
      // 활성화 상태 하이라이트를 위해 activeTool 값 업데이트
      if (engine.value && !panelView) {
        const flagName = tool.flagName || tool.id.replace('view_', '');
        // 약간의 지연을 주어 엔진의 상태 변화가 반영된 후 체크 (또는 수동 동기화)
        setTimeout(() => {
          if (engine.value.viewFlags[flagName]) {
            activeTool.value = tool.id;
          } else {
            activeTool.value = 'move_hand';
          }
        }, 10);
      }
    }
    return;
  }

  activeTool.value = tool.id;
  if (engine.value) {
    engine.value.setActiveTool(tool);
    // 도구 선택 시 브러쉬 크기 즉시 엔진에 동기화
    if (tool.isBrush) {
      if (tool.brushSize && !brushSize.value) brushSize.value = tool.brushSize;
      engine.value.brushSize = Number(brushSize.value);
    }
  }
};

// 💡 Store의 마을 정보창 상태를 감지하여 렌더링 타일 플래그와 UI 도구 상태를 자동 동기화
watch(() => store.showVillageInfo, (isOpen) => {
  if (engine.value) {
    engine.value.viewFlags = engine.value.viewFlags || {};
    engine.value.viewFlags.showVillageInfo = false;
    engine.value.viewFlags.showVillages = false;
    engine.value.viewFlags.village = isOpen;
    engine.value.viewFlags.VILLAGETILE = isOpen;
    if (isOpen) {
        engine.value.viewFlags.NATIONTILE = false;
        engine.value.viewFlags.nation = false;
        engine.value.viewFlags.influence = false;
        store.showNationInfo = false;
    }
    // 강제 리프레시를 위해 preRenderTerrain 호출 필요할 수 있음 (toggleView 내부 로직 참조)
    if (engine.value.preRenderTerrain) engine.value.preRenderTerrain();
  }
  
  if (isOpen) {
    const villageTool = allTools.value.find(t => t.id === 'view_village');
    if (villageTool) activeTool.value = villageTool.id;
  } else if (activeTool.value === 'view_village') {
    activeTool.value = 'move_hand';
    const defaultTool = allTools.value.find(t => t.id === 'move_hand');
    if (engine.value && defaultTool) engine.value.setActiveTool(defaultTool);
  }
});

// 💡 국가 정보창 상태 동기화
watch(() => store.showNationInfo, (isOpen) => {
  if (engine.value) {
    engine.value.viewFlags = engine.value.viewFlags || {};
    engine.value.viewFlags.nation = isOpen;
    engine.value.viewFlags.NATIONTILE = isOpen;
    engine.value.viewFlags.influence = isOpen;
    if (isOpen) {
        engine.value.viewFlags.village = false;
        engine.value.viewFlags.VILLAGETILE = false;
        store.showVillageInfo = false;
    }
    if (engine.value.preRenderTerrain) engine.value.preRenderTerrain();
  }

  if (isOpen) {
    const nationTool = allTools.value.find(t => t.id === 'view_nation');
    if (nationTool) activeTool.value = nationTool.id;
  } else if (activeTool.value === 'view_nation') {
    activeTool.value = 'move_hand';
    const defaultTool = allTools.value.find(t => t.id === 'move_hand');
    if (engine.value && defaultTool) engine.value.setActiveTool(defaultTool);
  }
});


const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const handleMapConfirm = (settings) => {
  showMapSettings.value = false;
  isGameStarted.value = true;
  initEngine(settings);
};

const initEngine = (mapSettings = {}) => {
  if (!gameCanvas.value || !worldboxContainer.value) return;
  
  engine.value = new Engine(gameCanvas.value, mapSettings);
  allTools.value = DefaultTools(engine.value);
  
  // 🌍 Global access for UI components
  window.gameEngine = engine.value;
  window.eventBus = engine.value.eventBus;
  
  engine.value.onEntitySelect = (data) => {
    store.selectEntity(data);
  };
  
  engine.value.start();
  
  // Set default tool to Move
  const initialTool = allTools.value.find(t => t.id === 'move_hand');
  if (initialTool) {
      engine.value.setActiveTool(initialTool);
  }

  // Set initial debug & brush params
  updateSimParams();
  updateBrushSize();

  engine.value.monitor.onUpdate = (stats) => {
    if (!stats) return;
    fps.value = stats.fps;
    entityCount.value = stats.entityCount;
    totalFertility.value = Math.floor(stats.totalFertility);
    totalMaxFertility.value = Math.floor(stats.totalMaxFertility);
    dodStats.value = stats.dodStats;
    
    // 🏘️ Store 동기화
    if (stats.villages) {
      store.updateVillageStats(stats.villages);
    }
    if (stats.nations) {
      store.updateNationStats(stats.nations);
    }
    if (stats.jobMonitor) {
      // 📊 Direct assignment is more robust against HMR lag
      store.jobMonitor = stats.jobMonitor;
    }
  };

  // 📡 [Persistence] UI Import Trigger
  engine.value.eventBus.on('UI_TRIGGER_IMPORT', () => {
    if (saveFileInput.value) saveFileInput.value.click();
  });

  resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect;
      if (height < 100) return; 
      
      gameCanvas.value.width = width;
      gameCanvas.value.height = height;
      if (engine.value) engine.value.handleResize(width, height);
    }
  });

  resizeObserver.observe(worldboxContainer.value);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('resize', handleGlobalResize);
};

const handleGlobalResize = () => {
  isMobile.value = window.innerWidth <= 768;
};

onMounted(() => {
  console.log("🌌 Worldbox View Mounted. Awaiting User Initialization...");
});

const onSaveFileSelected = async (event) => {
  const file = event.target.files[0];
  if (!file || !engine.value) return;
  
  try {
    await engine.value.importSave(file);
    // Reset input so the same file can be loaded again if needed
    event.target.value = ''; 
    isMenuOpen.value = false;
  } catch (err) {
    console.error("Failed to import save:", err);
  }
};


onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('resize', handleGlobalResize);
  if (engine.value) {
    engine.value.onEntitySelect = null;
    if (engine.value.monitor) {
      engine.value.monitor.onUpdate = null;
    }
    engine.value.destroy();
  }
});

const handleGodPower = (toolId) => {
  activeTool.value = toolId;
  const tool = allTools.value.find(t => t.id === toolId);
  if (engine.value && tool) engine.value.setActiveTool(tool);
};
</script>

<style scoped>
.worldbox-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
  position: relative;
  background: #0a0a0a;
  overflow: hidden;
  box-shadow: inset 0 0 100px rgba(0,0,0,0.8);
}

/* 🎭 Cinematic Visual FX */
.vignette-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: radial-gradient(circle, transparent 40%, rgba(0, 0, 0, 0.4) 100%);
  z-index: 500;
}

.color-grade-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  backdrop-filter: saturate(1.1) contrast(1.05) brightness(1.02);
  z-index: 501;
}

#worldbox-canvas {
  display: block;
  touch-action: none;
}

.ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

/* 💎 TOP HUD (Premium Status Bar) */
.top-hud {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 1200px;
  height: 48px;
  background: rgba(10, 10, 15, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
  pointer-events: auto;
  z-index: 1005;
}

.hud-left .hud-logo {
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 4px;
  color: #fff;
  text-shadow: 0 0 10px rgba(255,255,255,0.2);
}
.hud-logo .hl { color: #4caf50; text-shadow: 0 0 10px rgba(76, 175, 80, 0.4); }

.hud-center {
  display: flex;
  gap: 15px;
}

.hud-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.05);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #ccc;
  font-family: 'Inter', monospace;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}

.hud-badge .icon { font-size: 0.85rem; }

/* 💎 PREMIUM DOCK (macOS Style) */
.premium-dock {
  position: absolute;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  z-index: 1010;
  pointer-events: none;
}

.main-dock, .sub-dock {
  display: flex;
  align-items: center;
  background: rgba(20, 20, 25, 0.75);
  backdrop-filter: blur(30px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 8px;
  gap: 8px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15);
  pointer-events: auto;
}

.dock-categories {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.dock-divider {
  width: 1px;
  height: 30px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
}

.dock-item {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: transparent;
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dock-item .icon {
  font-size: 1.6rem;
  transition: all 0.3s ease;
}

.dock-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.25) translateY(-5px);
  z-index: 10;
}

.dock-item:hover .icon {
  transform: scale(1.1);
}

.dock-item:active {
  transform: scale(0.95);
}

.dock-item.active {
  background: rgba(76, 175, 80, 0.15);
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.active-dot {
  position: absolute;
  bottom: -4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #4caf50;
  box-shadow: 0 0 8px #4caf50;
}

/* Tooltip */
.tooltip {
  position: absolute;
  top: -35px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 1px;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition: all 0.2s;
  border: 1px solid rgba(255,255,255,0.1);
}

.dock-item:hover .tooltip {
  opacity: 1;
  transform: translateY(0);
}

/* Brush Slider in Dock */
.dock-brush-slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
}
.slider-label {
  font-size: 0.6rem;
  color: #888;
  font-weight: bold;
}
input[type="range"] {
  width: 80px;
  accent-color: #4caf50;
}

/* Animations */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-enter-from { opacity: 0; transform: translateY(20px) scale(0.9); }
.slide-up-leave-to { opacity: 0; transform: translateY(10px) scale(0.9); pointer-events: none; }

.fade-slide-horizontal-enter-active, .fade-slide-horizontal-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.fade-slide-horizontal-enter-from, .fade-slide-horizontal-leave-to { opacity: 0; transform: translateX(-20px); max-width: 0; }

@media (max-width: 768px) {
  .top-hud { width: 95%; height: auto; flex-direction: column; gap: 10px; padding: 10px; }
  .hud-center { flex-wrap: wrap; justify-content: center; }
  .dock-item { width: 40px; height: 40px; }
  .dock-item .icon { font-size: 1.2rem; }
  .sub-dock { flex-wrap: wrap; max-width: 95vw; justify-content: center; }
}

/* 🚀 Intro Screen Styles */
.intro-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, #1a1a1a 0%, #050505 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  pointer-events: auto;
}

.intro-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.logo-text {
  font-size: 5rem;
  font-weight: 900;
  letter-spacing: 15px;
  color: #fff;
  margin: 0;
  text-shadow: 0 0 30px rgba(255,255,255,0.2);
}

.logo-text span {
  color: #4caf50;
  text-shadow: 0 0 30px rgba(76, 175, 80, 0.4);
}

.logo-sub {
  font-size: 0.9rem;
  letter-spacing: 8px;
  color: #666;
  font-weight: bold;
  margin-top: -10px;
}

.intro-desc {
  font-size: 1rem;
  color: #aaa;
  line-height: 1.6;
  max-width: 500px;
  margin-top: 10px;
}

.start-btn {
  position: relative;
  background: #2e7d32;
  color: white;
  border: none;
  padding: 18px 50px;
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 3px;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  gap: 15px;
}

.start-btn:hover {
  transform: scale(1.05) translateY(-5px);
  background: #388e3c;
  box-shadow: 0 15px 50px rgba(76, 175, 80, 0.3);
}

.start-btn:active {
  transform: scale(0.98);
}

.btn-icon {
  font-size: 1.3rem;
  animation: pulse 2s infinite;
}

.version-tag {
  font-size: 0.6rem;
  color: #444;
  letter-spacing: 2px;
  margin-top: 20px;
}

/* Animations */
@keyframes pulse {
  0% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0.5; transform: scale(0.9); }
}

.fade-scale-enter-active, .fade-scale-leave-active {
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-scale-enter-from {
  opacity: 0;
  transform: scale(1.1);
}

.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
  filter: blur(20px);
}
</style>
