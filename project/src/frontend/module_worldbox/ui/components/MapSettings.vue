<template>
  <div class="map-settings-overlay">
    <div class="settings-card">
      <div class="card-header">
        <div class="title-group">
          <h2>WORLD CONFIGURATION</h2>
          <div class="subtitle">ADJUST THE LAWS OF YOUR UNIVERSE</div>
        </div>
        <div class="header-decoration"></div>
      </div>

      <div class="settings-body">
        <!-- 🌍 WORLD SCALE -->
        <div class="setting-section">
          <label>WORLD SCALE</label>
          <div class="size-options">
            <button 
              v-for="size in sizeOptions" 
              :key="size.id"
              :class="{ active: settings.worldSize === size.id }"
              @click="settings.worldSize = size.id"
            >
              <span class="size-icon">{{ size.icon }}</span>
              <div class="size-info">
                <span class="size-label">{{ size.label }}</span>
                <span class="size-pixels" v-if="size.id !== 'custom'">{{ size.width }} x {{ size.height }}</span>
                <span class="size-pixels" v-else>VARIABLE</span>
              </div>
            </button>
          </div>

          <!-- 🛠️ Custom Size Inputs -->
          <Transition name="slide-fade">
            <div v-if="settings.worldSize === 'custom'" class="custom-size-grid">
              <div class="custom-input-group">
                <label>WIDTH (PX)</label>
                <input type="number" v-model="settings.customWidth" step="100" min="800" max="8000" />
              </div>
              <div class="custom-input-group">
                <label>HEIGHT (PX)</label>
                <input type="number" v-model="settings.customHeight" step="100" min="800" max="8000" />
              </div>
            </div>
          </Transition>
        </div>

        <div class="divider"></div>

        <!-- 📊 DENSITY SETTINGS -->
        <div class="grid-settings">
          <div class="setting-item">
            <div class="item-header">
              <label>🏔️ LANDMASS SCALE</label>
              <span class="value">{{ settings.landmassScale }}%</span>
            </div>
            <input type="range" min="30" max="300" v-model="settings.landmassScale" />
            <div class="item-desc">Island archipelago vs Massive continents</div>
          </div>

          <div class="setting-item">
            <div class="item-header">
              <label>🌿 NATURE DENSITY</label>
              <span class="value">{{ settings.natureDensity }}%</span>
            </div>
            <input type="range" min="10" max="200" v-model="settings.natureDensity" />
            <div class="item-desc">Trees, Grass, and Vegetation</div>
          </div>

          <div class="setting-item">
            <div class="item-header">
              <label>💎 MINERAL RICHNESS</label>
              <span class="value">{{ settings.mineralDensity }}%</span>
            </div>
            <input type="range" min="10" max="200" v-model="settings.mineralDensity" />
            <div class="item-desc">Ores, Stones, and Treasures</div>
          </div>

          <div class="setting-item">
            <div class="item-header">
              <label>🐏 ANIMAL POPULATION</label>
              <span class="value">{{ settings.animalDensity }}%</span>
            </div>
            <input type="range" min="0" max="200" v-model="settings.animalDensity" />
            <div class="item-desc">Sheep, Rabbits, and Wildlife</div>
          </div>

          <div class="setting-item">
            <div class="item-header">
              <label>🧍 STARTING CITIZENS</label>
              <span class="value">{{ settings.humanCount }}</span>
            </div>
            <input type="range" min="0" max="50" v-model="settings.humanCount" />
            <div class="item-desc">Initial human pioneers</div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <button class="cancel-btn" @click="$emit('cancel')">BACK</button>
        <button class="create-btn" @click="confirmSettings">
          <span class="btn-shine"></span>
          CREATE WORLD
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';

const emit = defineEmits(['cancel', 'confirm']);

const sizeOptions = [
  { id: 'small', label: 'SMALL', icon: '🏝️', width: 1600, height: 1600 },
  { id: 'medium', label: 'STANDARD', icon: '🌍', width: 2400, height: 2400 },
  { id: 'large', label: 'GIGANTIC', icon: '🌌', width: 4000, height: 4000 },
  { id: 'custom', label: 'CUSTOM', icon: '🛠️', width: 2400, height: 2400 }
];

const settings = reactive({
  worldSize: 'medium',
  customWidth: 2400,
  customHeight: 2400,
  landmassScale: 100,
  natureDensity: 100,
  mineralDensity: 100,
  animalDensity: 100,
  humanCount: 10
});

const confirmSettings = () => {
  const isCustom = settings.worldSize === 'custom';
  const selectedSize = isCustom ? { width: settings.customWidth, height: settings.customHeight } : sizeOptions.find(s => s.id === settings.worldSize);
  
  if (!selectedSize) {
    console.error("❌ Invalid world size selected:", settings.worldSize);
    return;
  }

  const finalConfig = {
    ...settings,
    width: Number(selectedSize.width),
    height: Number(selectedSize.height)
  };
  
  emit('confirm', finalConfig);
};
</script>

<style scoped>
.map-settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(15px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  pointer-events: auto;
  animation: fadeIn 0.4s ease;
}

.settings-card {
  width: 600px;
  background: rgba(20, 20, 20, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 100px rgba(76, 175, 80, 0.1);
  overflow: hidden;
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-header {
  padding: 30px 40px;
  background: linear-gradient(to right, rgba(46, 125, 50, 0.2), transparent);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
}

.title-group h2 {
  font-size: 1.5rem;
  letter-spacing: 4px;
  color: #fff;
  margin: 0;
  font-weight: 900;
}

.subtitle {
  font-size: 0.7rem;
  color: #4caf50;
  letter-spacing: 2px;
  font-weight: bold;
  margin-top: 5px;
}

.settings-body {
  padding: 30px 40px;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.setting-section label {
  display: block;
  font-size: 0.75rem;
  color: #888;
  letter-spacing: 2px;
  font-weight: bold;
  margin-bottom: 15px;
}

.size-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.custom-size-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 20px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

.custom-input-group label {
  font-size: 0.6rem !important;
  color: #4caf50 !important;
  margin-bottom: 5px !important;
}

.custom-input-group input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px;
  color: #fff;
  font-family: monospace;
  font-size: 0.8rem;
}

.custom-input-group input:focus {
  outline: none;
  border-color: #4caf50;
  background: rgba(0, 0, 0, 0.5);
}

.size-options button {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #fff;
}

.size-options button:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

.size-options button.active {
  background: rgba(76, 175, 80, 0.15);
  border-color: #4caf50;
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.2);
}

.size-icon { font-size: 1.5rem; }
.size-info { display: flex; flex-direction: column; align-items: center; }
.size-label { font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; }
.size-pixels { font-size: 0.6rem; color: #666; margin-top: 2px; }

.divider { height: 1px; background: rgba(255, 255, 255, 0.05); }

.grid-settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.item-header label { margin: 0; font-size: 0.7rem; color: #fff; }
.item-header .value { color: #4caf50; font-weight: bold; font-family: monospace; }

.item-desc {
  font-size: 0.6rem;
  color: #555;
  margin-top: 8px;
}

input[type="range"] {
  width: 100%;
  accent-color: #4caf50;
}

.card-footer {
  padding: 25px 40px;
  background: rgba(0,0,0,0.2);
  display: flex;
  justify-content: flex-end;
  gap: 15px;
}

.cancel-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.1);
  color: #777;
  padding: 10px 25px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  letter-spacing: 1px;
  transition: all 0.3s;
}

.cancel-btn:hover {
  color: #fff;
  border-color: rgba(255,255,255,0.3);
}

.create-btn {
  position: relative;
  background: #2e7d32;
  color: #fff;
  border: none;
  padding: 12px 35px;
  border-radius: 8px;
  font-weight: 900;
  letter-spacing: 2px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s;
}

.create-btn:hover {
  background: #388e3c;
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(76, 175, 80, 0.3);
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
</style>
