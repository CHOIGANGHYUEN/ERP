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

      <!-- TOP LEFT DEBUG PANEL -->
      <div class="debug-panel" :class="{ 'collapsed': isMobile && !showDebugCollapse }">
        <div class="debug-header" @click="showDebugCollapse = !showDebugCollapse">
          <span>🔬 SIMULATION DEBUG</span>
          <span v-if="isMobile" class="collapse-icon">{{ showDebugCollapse ? '▼' : '▶' }}</span>
        </div>
        <div class="debug-content" v-show="!isMobile || showDebugCollapse">
          <div class="debug-item">
            <span>Spread Speed (Hz): {{ spreadSpeed }}</span>
            <input type="range" min="1" max="100" v-model="spreadSpeed" @input="updateSimParams" />
          </div>
          <div class="debug-item">
            <span>Spread Power: {{ spreadAmount }}</span>
            <input type="range" min="100" max="10000" step="100" v-model="spreadAmount" @input="updateSimParams" />
          </div>
          <div class="debug-stats" v-if="engine">
            FPS: {{ fps }} | Entities: {{ entityCount }} <br/>
            Fertility: {{ (totalFertility / 100).toLocaleString() }} / {{ (totalMaxFertility / 100).toLocaleString() }} ({{ ((totalFertility / totalMaxFertility) * 100).toFixed(1) }}%)
          </div>
        </div>
      </div>

      <VillageDetailPanel />
      <NationDetailPanel />

      <div class="top-bar">
        <h1>Worldbox Simulation</h1>
      </div>
      
      <!-- Bottom Tool Menu -->
      <div class="bottom-controls" :class="{ 'open': isMenuOpen }">
        <!-- BRUSH SIZE CONTROL (Side Panel) -->
        <Transition name="fade">
          <div v-if="showBrushSettings" class="brush-settings">
            <div class="setting-title">BRUSH SIZE: {{ brushSize }}</div>
            <input type="range" min="2" max="100" v-model="brushSize" @input="updateBrushSize" />
            <div class="brush-preview" :style="{ width: brushSize + 'px', height: brushSize + 'px' }"></div>
          </div>
        </Transition>

        <div class="controls-panel">
          <!-- 📖 [Expert UI] Tool Information Panel -->
          <Transition name="slide-up">
            <div v-if="hoveredTool || activeToolData" class="tool-info-overlay">
              <div class="info-icon">{{ hoveredTool?.icon || activeToolData?.icon }}</div>
              <div class="info-text">
                <div class="info-name">{{ hoveredTool?.name || activeToolData?.name }}</div>
                <div class="info-desc">{{ hoveredTool?.description || activeToolData?.description }}</div>
              </div>
            </div>
          </Transition>

          <div class="tool-tabs" ref="toolTabsContainer" @wheel="handleWheelScroll">
            <button 
              v-for="cat in toolCategories" 
              :key="cat.name"
              :class="{ active: activeCategory === cat.name }"
              @click="activeCategory = cat.name"
            >
              <span class="cat-icon">{{ cat.icon }}</span>
              <span class="cat-name">{{ cat.name }}</span>
            </button>
          </div>

          <div class="tool-grid-container">
            <TransitionGroup name="tool-list" tag="div" class="tool-belt">
              <div v-for="tool in filteredTools" :key="tool.id" 
                   class="tool-item" 
                   :class="{ active: activeTool === tool.id }"
                   @mouseenter="hoveredTool = tool"
                   @mouseleave="hoveredTool = null"
                   @click="selectTool(tool)">
                <div class="tool-icon-wrapper">
                  <div class="tool-icon">{{ tool.icon }}</div>
                </div>
                <div class="tool-name">{{ tool.name }}</div>
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>

      <!-- Toggle Button - INSIDE Overlay for better event flow -->
      <button v-if="isGameStarted" class="fixed-toggle-btn" @click="toggleMenu">
        <span class="icon">{{ isMenuOpen ? '▼' : '▲' }}</span>
        TOOLS
      </button>

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

const worldboxContainer = ref(null);
const gameCanvas = ref(null);
const toolTabsContainer = ref(null); // 📜 Mouse wheel scroll reference
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
const hoveredTool = ref(null);

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
  { name: 'View', icon: '👁️' }
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
  return allTools.value.find(t => t.id === activeTool.value) || null;
});

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
  if (tool.isInstant && tool.id.startsWith('view_')) {
    if (tool.id === 'view_village') {
      store.showVillageInfo = !store.showVillageInfo;
    }
    if (tool.id === 'view_nation') {
      store.showNationInfo = !store.showNationInfo;
    }
    if (engine.value) engine.value.toggleView(tool.id);
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
    engine.value.viewFlags.VILLAGETILE = isOpen;
    if (isOpen) {
        engine.value.viewFlags.NATIONTILE = false;
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
    engine.value.viewFlags.NATIONTILE = isOpen;
    if (isOpen) {
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
    
    // 🏘️ Store 동기화
    if (stats.villages) {
      store.updateVillageStats(stats.villages);
    }
    if (stats.nations) {
      store.updateNationStats(stats.nations);
    }
  };

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

/* Debug Panel */
.debug-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 15px;
  border-radius: 8px;
  pointer-events: auto;
  color: #00ff00;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.debug-panel.collapsed {
  width: 40px;
  height: 40px;
  overflow: hidden;
  padding: 10px;
}

.debug-header {
  border-bottom: 1px solid #333;
  padding-bottom: 5px;
  font-weight: bold;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.debug-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.debug-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.debug-stats {
  margin-top: 5px;
  color: #aaa;
  font-size: 0.65rem;
}


input[type="range"] {
  accent-color: #2e7d32;
}

.fixed-toggle-btn {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1005;
  background: rgba(46, 125, 50, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 8px 30px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 2px;
  pointer-events: auto;
  box-shadow: 0 4px 15px rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fixed-toggle-btn:hover {
  background: #388e3c;
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.5);
}

.fixed-toggle-btn .icon {
  font-size: 0.6rem;
  transition: transform 0.4s ease;
}

.menu-active .fixed-toggle-btn .icon {
  transform: rotate(180deg);
}

.bottom-controls {
  position: absolute;
  bottom: -450px;
  left: 0;
  width: 100%;
  transition: bottom 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 1000;
  padding-bottom: 80px;
}

.bottom-controls.open {
  bottom: 0;
}

.controls-panel {
  position: relative;
  background: linear-gradient(to bottom, rgba(15, 15, 15, 0.85), rgba(5, 5, 5, 0.95));
  backdrop-filter: blur(30px) saturate(150%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 -15px 50px rgba(0,0,0,0.8);
  border-radius: 24px 24px 0 0;
  margin: 0 10px;
}

/* Tool Info Overlay */
.tool-info-overlay {
  position: absolute;
  top: -85px;
  left: 20px;
  right: 20px;
  background: rgba(20, 20, 20, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  color: white;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  pointer-events: none;
  z-index: 1001;
}

.info-icon {
  font-size: 2rem;
  text-shadow: 0 0 15px rgba(255,255,255,0.3);
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-name {
  font-size: 0.9rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #4caf50;
}

.info-desc {
  font-size: 0.75rem;
  color: #ccc;
  line-height: 1.4;
  max-width: 600px;
}

/* Brush Settings */
.brush-settings {
  position: absolute;
  left: 20px;
  bottom: 180px;
  background: rgba(10, 10, 10, 0.9);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 15px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.setting-title {
  font-size: 0.6rem;
  letter-spacing: 1px;
  color: #888;
  font-weight: bold;
}

.brush-preview {
  border: 2px solid #4caf50;
  border-radius: 50%;
  background: rgba(76, 175, 80, 0.15);
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
}

.tool-tabs {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: auto;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.tool-tabs::-webkit-scrollbar { display: none; }

.tool-tabs button {
  background: none;
  border: none;
  color: #777;
  cursor: pointer;
  padding: 8px 20px;
  border-radius: 12px;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.tool-tabs button .cat-icon {
  font-size: 1.1rem;
  filter: grayscale(1);
  transition: all 0.3s;
}

.tool-tabs button .cat-name {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tool-tabs button:hover {
  color: #bbb;
  background: rgba(255, 255, 255, 0.05);
}

.tool-tabs button.active {
  color: #fff;
  background: rgba(76, 175, 80, 0.15);
  border: 1px solid rgba(76, 175, 80, 0.3);
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.1);
}

.tool-tabs button.active .cat-icon {
  filter: grayscale(0);
  transform: scale(1.2) rotate(-5deg);
}

.tool-grid-container {
  max-height: 280px;
  overflow-y: auto;
  pointer-events: auto;
}

.tool-belt {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 15px;
  padding: 25px 40px;
  max-width: 1000px;
  margin: 0 auto;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.tool-icon-wrapper {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.tool-icon {
  font-size: 1.8rem;
  transition: transform 0.3s;
}

.tool-name {
  font-size: 0.65rem;
  font-weight: 500;
  color: #999;
  text-align: center;
  white-space: nowrap;
}

.tool-item:hover .tool-icon-wrapper {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-5px);
}

.tool-item:hover .tool-icon {
  transform: scale(1.1);
}

.tool-item.active .tool-icon-wrapper {
  background: rgba(76, 175, 80, 0.2);
  border-color: #4caf50;
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.2);
}

.tool-item.active .tool-icon {
  transform: scale(1.15);
}

.tool-item.active .tool-name {
  color: #4caf50;
  font-weight: 700;
}

/* Animations */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.tool-list-move,
.tool-list-enter-active,
.tool-list-leave-active {
  transition: all 0.4s cubic-bezier(0.55, 0, 0.1, 1);
}

.tool-list-enter-from,
.tool-list-leave-to {
  opacity: 0;
  transform: scale(0.5) translateY(30px);
}

.tool-list-leave-active {
  position: absolute;
}

/* Slide Up Animation */
.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@media (max-width: 768px) {
  .tool-belt {
    grid-template-columns: repeat(auto-fill, minmax(65px, 1fr));
    gap: 10px;
    padding: 15px 10px;
  }
  .tool-icon-wrapper {
    width: 48px;
    height: 48px;
  }
  .tool-icon {
    font-size: 1.4rem;
  }
  .tool-tabs button {
    padding: 6px 12px;
    white-space: nowrap;
  }
  .tool-tabs button .cat-name {
    display: none; /* Hide names to save space on very small screens, or just keep icons */
  }
  .bottom-controls {
    bottom: -400px;
  }
  .top-bar {
    padding: 10px 20px;
  }
  .top-bar h1 {
    font-size: 0.9rem;
  }
  .tool-info-overlay {
    top: -70px;
    left: 10px;
    right: 10px;
    padding: 8px 15px;
  }
  .info-icon {
    font-size: 1.5rem;
  }
  .info-desc {
    font-size: 0.65rem;
  }
  .brush-settings {
    bottom: 140px;
    left: 10px;
    padding: 10px;
  }
}

.top-bar {
  padding: 20px 40px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.9), transparent);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.top-bar h1 {
  font-size: 1.2rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: #fff;
  margin: 0;
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
