<template>
  <div class="worldbox-container" ref="worldboxContainer">
    <canvas ref="gameCanvas" id="worldbox-canvas"></canvas>
    
    <!-- UI Overlay - Always on top -->
    <div class="ui-overlay" :class="{ 'menu-active': isMenuOpen }">
      <!-- Detailed Inspection Panel -->
      <EntityStatusPanel />

      <!-- TOP LEFT DEBUG PANEL -->
      <div class="debug-panel">
        <div class="debug-header">🔬 SIMULATION DEBUG</div>
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

      <div class="top-bar">
        <h1>Worldbox Simulation</h1>
      </div>
      
      <!-- Bottom Tool Menu -->
      <div class="bottom-controls" :class="{ 'open': isMenuOpen }">
        <!-- BRUSH SIZE CONTROL (Side Panel) -->
        <Transition name="fade">
          <div v-if="activeToolData?.isBrush" class="brush-settings">
            <div class="setting-title">BRUSH SIZE: {{ brushSize }}</div>
            <input type="range" min="2" max="100" v-model="brushSize" @input="updateBrushSize" />
            <div class="brush-preview" :style="{ width: brushSize + 'px', height: brushSize + 'px' }"></div>
          </div>
        </Transition>

        <div class="controls-panel">
          <div class="tool-tabs">
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
      <button class="fixed-toggle-btn" @click="toggleMenu">
        <span class="icon">{{ isMenuOpen ? '▼' : '▲' }}</span>
        TOOLS
      </button>
    </div>
  </div>
</template>



<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import Engine from '../../engine/core/Engine.js';
import { DefaultTools } from '../../engine/core/ToolRegistry.js';

import { useWorldboxStore } from '../store/worldboxStore';
import EntityStatusPanel from '../components/EntityStatusPanel.vue';

const worldboxContainer = ref(null);
const gameCanvas = ref(null);
const isMenuOpen = ref(false);
const activeTool = ref('move_hand');
const brushSize = ref(15);
const spreadSpeed = ref(10);
const spreadAmount = ref(3000);
const fps = ref(0);
const entityCount = ref(0);
const totalFertility = ref(0);
const totalMaxFertility = ref(0);

let engine = null;
let resizeObserver = null;

const handleMouseMove = (e) => {
  if (engine) {
    // Basic engine mouse move logic (if any specific Vue-side handling was needed)
  }
};



const toolCategories = [
  { name: 'Landscape', icon: '🌍' },
  { name: 'Nature', icon: '🌱' },
  { name: 'Resources', icon: '⛏️' },
  { name: 'Life', icon: '🐑' },
  { name: 'View', icon: '👁️' }
];

const activeCategory = ref('Landscape');

const filteredTools = computed(() => {
  return DefaultTools.filter(t => t.category === activeCategory.value);
});

const activeToolData = computed(() => {
  return DefaultTools.find(t => t.id === activeTool.value);
});

const updateBrushSize = () => {
  if (engine) engine.brushSize = Number(brushSize.value);
};

const updateSimParams = () => {
  if (engine) {
    engine.simParams.spreadSpeed = Number(spreadSpeed.value) / 100;
    engine.simParams.spreadAmount = Number(spreadAmount.value);
  }
};

const selectTool = (tool) => {
  if (tool.isInstant && tool.id.startsWith('view_')) {
    if (engine) engine.toggleView(tool.id);
    return;
  }
  activeTool.value = tool.id;
  if (engine) engine.setActiveTool(tool);
};



const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

onMounted(() => {
  if (gameCanvas.value && worldboxContainer.value) {
    engine = new Engine(gameCanvas.value);
    const store = useWorldboxStore();
    
    engine.onEntitySelect = (data) => {
      store.selectEntity(data);
    };
    
    engine.start();
    
    // Set default tool to Move
    const initialTool = DefaultTools.find(t => t.id === 'move_hand');
    engine.setActiveTool(initialTool);

    // Set initial debug params
    updateSimParams();

    engine.monitor.onUpdate = (stats) => {
      if (!stats) return;
      fps.value = stats.fps;
      entityCount.value = stats.entityCount;
      totalFertility.value = Math.floor(stats.totalFertility);
      totalMaxFertility.value = Math.floor(stats.totalMaxFertility);
    };


    resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Check if container has actual height
        if (height < 100) return; 
        
        gameCanvas.value.width = width;
        gameCanvas.value.height = height;
        if (engine) engine.handleResize(width, height);
      }
    });

    resizeObserver.observe(worldboxContainer.value);
    
    // Add mouse move listener
    window.addEventListener('mousemove', handleMouseMove);
  }
});


onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  window.removeEventListener('mousemove', handleMouseMove);
  if (engine) {

    engine.onEntitySelect = null;
    engine.monitor.onUpdate = null;
    engine.destroy();
  }
});

const handleGodPower = (toolId) => {
  activeTool.value = toolId;
  const tool = DefaultTools.find(t => t.id === toolId);
  if (engine) engine.setActiveTool(tool);
};
</script>

<style scoped>
.worldbox-container {
  width: 100%;
  height: 100%;
  min-height: 500px; /* Force minimum height if parent is auto */
  position: relative;
  background: #111;
  overflow: hidden;
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
}

.debug-header {
  border-bottom: 1px solid #333;
  padding-bottom: 5px;
  font-weight: bold;
  color: #fff;
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
  background: linear-gradient(to bottom, rgba(20, 20, 20, 0.9), rgba(10, 10, 10, 0.98));
  backdrop-filter: blur(25px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 -10px 40px rgba(0,0,0,0.6);
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
  justify-content: center;
  gap: 5px;
  padding: 12px 0;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: auto;
}

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
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 0 10px rgba(255,255,255,0.05);
}

.tool-tabs button.active .cat-icon {
  filter: grayscale(0);
  transform: scale(1.1);
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
</style>


