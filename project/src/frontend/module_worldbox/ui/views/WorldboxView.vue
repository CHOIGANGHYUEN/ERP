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
          Total Fertility: {{ (totalFertility / 1000).toFixed(1) }}k / 1M
        </div>
      </div>

      <div class="top-bar">
        <h1>Worldbox Simulation</h1>
      </div>
      
      <!-- Bottom Tool Menu -->
      <div class="bottom-controls" :class="{ 'open': isMenuOpen }">
        <!-- BRUSH SIZE CONTROL (Side Panel) -->
        <div v-if="activeToolData?.isBrush" class="brush-settings">
          <div class="setting-title">BRUSH SIZE: {{ brushSize }}</div>
          <input type="range" min="2" max="100" v-model="brushSize" @input="updateBrushSize" />
          <div class="brush-preview" :style="{ width: brushSize + 'px', height: brushSize + 'px' }"></div>
        </div>

        <div class="tool-tabs">
          <button 
            v-for="cat in toolCategories" 
            :key="cat"
            :class="{ active: activeCategory === cat }"
            @click="activeCategory = cat"
          >
            {{ cat }}
          </button>
        </div>

        <div class="tool-belt">
          <div v-for="tool in filteredTools" :key="tool.id" 
               class="tool-item" 
               :class="{ active: activeTool === tool.id }"
               @click="selectTool(tool)">
            <div class="tool-icon">{{ tool.icon }}</div>
            <div class="tool-name">{{ tool.name }}</div>
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
const activeCategory = ref('Earth');
const brushSize = ref(15);
const spreadSpeed = ref(10);
const spreadAmount = ref(3000);
const fps = ref(0);
const entityCount = ref(0);
const totalFertility = ref(0);
let engine = null;
let resizeObserver = null;

const toolCategories = ['Earth', 'Life', 'View'];

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
  }
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  if (engine) {
    engine.onEntitySelect = null;
    engine.monitor.onUpdate = null;
    engine.stop();
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
  z-index: 1001;
  background: #388e3c;
  border: 2px solid white;
  color: white;
  padding: 10px 40px;
  border-radius: 30px;
  cursor: pointer;
  font-weight: bold;
  pointer-events: auto;
  box-shadow: 0 4px 15px rgba(0,0,0,0.4);
}

.bottom-controls {
  position: absolute;
  bottom: -350px;
  left: 0;
  width: 100%;
  transition: bottom 0.4s ease;
  z-index: 1000;
}

.bottom-controls.open {
  bottom: 0;
}

/* Brush Settings */
.brush-settings {
  position: absolute;
  left: 20px;
  bottom: 150px;
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
  animation: slide-in 0.3s ease;
}

@keyframes slide-in {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

.setting-title {
  font-size: 0.6rem;
  letter-spacing: 1px;
  color: #888;
}

.brush-preview {
  border: 1px solid #4caf50;
  border-radius: 50%;
  background: rgba(76, 175, 80, 0.2);
}

input[type="range"] {
  width: 120px;
  accent-color: #4caf50;
}

.tool-tabs {
  background: rgba(20, 20, 20, 0.95);
  display: flex;
  justify-content: center;
  gap: 15px;
  padding: 10px 0;
  border-top: 1px solid rgba(255,255,255,0.1);
  pointer-events: auto;
}

.tool-tabs button {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 900;
  padding: 5px 15px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;
}

.tool-tabs button:hover {
  color: #ccc;
}

.tool-tabs button.active {
  color: #fff;
  background: rgba(255,255,255,0.1);
}

.tool-belt {
  background: rgba(15, 15, 15, 0.95);
  backdrop-filter: blur(20px);
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 30px 20px 80px 20px; /* Leave space for toggle button */
  pointer-events: auto;
  border-top: 2px solid #333;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  opacity: 0.5;
  cursor: pointer;
  color: #eee;
}

.tool-item.active {
  opacity: 1;
  color: #4caf50;
  transform: scale(1.1);
}

.tool-icon {
  font-size: 2.5rem;
}

.tool-name {
  font-size: 0.7rem;
}

.top-bar {
  padding: 20px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
}
</style>
