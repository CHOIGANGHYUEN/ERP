<template>
  <Transition name="panel-fade">
    <div v-if="store.showJobMonitor" class="job-monitor-overlay">
      <div class="monitor-container">
        <!-- 🏔️ Header -->
        <div class="monitor-header">
          <div class="title-group">
            <span class="icon">📊</span>
            <h2>JOB BEHAVIOR MONITOR</h2>
          </div>
          <button class="close-btn" @click="close">×</button>
        </div>

        <!-- 📈 Global Overview -->
        <div v-if="globalStats" class="global-overview">
          <div class="stat-card">
            <div class="stat-label">EQUIP RATE</div>
            <div class="stat-value" :style="{ color: getRateColor(globalStats.equipRate) }">
              {{ globalStats.equipRate }}%
            </div>
            <div class="stat-bar">
              <div class="bar-fill" :style="{ width: globalStats.equipRate + '%', background: getRateColor(globalStats.equipRate) }"></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">BUFF COVERAGE</div>
            <div class="stat-value" :style="{ color: getRateColor(globalStats.buffRate) }">
              {{ globalStats.buffRate }}%
            </div>
            <div class="stat-bar">
              <div class="bar-fill" :style="{ width: globalStats.buffRate + '%', background: getRateColor(globalStats.buffRate) }"></div>
            </div>
          </div>
        </div>

        <!-- 🏛️ Village List -->
        <div class="village-list scrollbar-custom">
          <div v-for="(vData, vId) in villageData" :key="vId" class="village-card">
            <div class="village-header">
              <span class="village-name">{{ vData.name }}</span>
              <span class="member-count">👥 {{ vData.members.length }}</span>
            </div>

            <!-- Job Chips -->
            <div class="job-distribution">
              <div v-for="(count, job) in vData.jobs" :key="job" class="job-chip">
                <span class="job-icon">{{ getJobIcon(job) }}</span>
                <span class="job-name">{{ job }}</span>
                <span class="job-count">{{ count }}</span>
              </div>
            </div>

            <!-- Individual Table -->
            <div class="member-table-wrapper">
              <table class="member-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>JOB</th>
                    <th>MODE</th>
                    <th>STATE</th>
                    <th>TOOL</th>
                    <th>BUFF</th>
                    <th>LOYALTY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in vData.members" :key="m.id">
                    <td>#{{ m.id }}</td>
                    <td class="job-cell"><span class="job-icon-small">{{ getJobIcon(m.job) }}</span> {{ m.job }}</td>
                    <td><span class="mode-tag" :class="m.mode.toLowerCase()">{{ m.mode }}</span></td>
                    <td class="state-cell">{{ m.jobState }}</td>
                    <td :class="{ 'no-tool': m.tool === '없음' }">{{ m.tool }}</td>
                    <td class="buff-cell">
                      <span v-if="m.buffed" class="buff-active" title="Chief's Aura Active">👑</span>
                      <span v-else class="buff-inactive">-</span>
                    </td>
                    <td>
                      <div class="loyalty-container">
                        <div class="loyalty-bg"><div class="loyalty-fill" :style="{ width: m.loyalty + '%' }"></div></div>
                        <span class="loyalty-text">{{ m.loyalty }}%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-if="!villageData || Object.keys(villageData).length === 0" class="no-data">
          📡 Awaiting civilization data...
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import { useWorldboxStore } from '../store/worldboxStore';

const store = useWorldboxStore();

const globalStats = computed(() => store.jobMonitor?.global || null);
const villageData = computed(() => store.jobMonitor?.byVillage || {});

const close = () => {
  store.showJobMonitor = false;
  // Sync back to tool if necessary, but ToggleTool usually handles its own state.
};

const getJobIcon = (job) => {
  const icons = {
    chief: '👑',
    warrior: '⚔️',
    soldier: '🛡️',
    logger: '🪵',
    miner: '⛏️',
    farmer: '🌾',
    gatherer: '🧺',
    architect: '🔨',
    transporter: '🚚',
    unemployed: '👤'
  };
  return icons[job.toLowerCase()] || '👤';
};

const getRateColor = (rate) => {
  if (rate > 80) return '#4caf50';
  if (rate > 50) return '#ffeb3b';
  if (rate > 20) return '#ff9800';
  return '#f44336';
};
</script>

<style scoped>
.job-monitor-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 950px;
  max-width: 95vw;
  height: 650px;
  max-height: 85vh;
  background: rgba(10, 10, 15, 0.9);
  backdrop-filter: blur(40px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  z-index: 2100;
  pointer-events: auto;
  box-shadow: 0 40px 100px rgba(0,0,0,0.8), inset 0 2px 20px rgba(255, 255, 255, 0.05);
  color: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', system-ui, sans-serif;
}

.monitor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.monitor-header {
  padding: 24px 32px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.title-group .icon {
  font-size: 1.8rem;
  filter: drop-shadow(0 0 10px rgba(76, 175, 80, 0.4));
}

.title-group h2 {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: 3px;
  font-weight: 900;
  color: #a5d6a7;
  text-transform: uppercase;
  text-shadow: 0 2px 5px rgba(0,0,0,0.5);
}

.close-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover { 
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
  border-color: rgba(255, 82, 82, 0.4);
  transform: scale(1.1);
  box-shadow: 0 0 10px rgba(255, 82, 82, 0.3);
}

.global-overview {
  padding: 20px 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.stat-card {
  background: rgba(255, 255, 255, 0.03);
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
}

.stat-label {
  font-size: 0.7rem;
  color: #aaa;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 900;
  margin: 8px 0 12px 0;
  font-family: monospace;
  text-shadow: 0 0 15px currentColor;
}

.stat-bar {
  height: 6px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.05);
}

.bar-fill {
  height: 100%;
  transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}
.bar-fill::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
  animation: shimmer 2s infinite;
}

.village-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.village-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 24px;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.5);
}

.village-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 12px;
}

.village-name {
  font-size: 1.2rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: 1px;
}

.member-count {
  font-size: 0.85rem;
  color: #81d4fa;
  font-weight: 800;
  background: rgba(129, 212, 250, 0.15);
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid rgba(129, 212, 250, 0.3);
}

.job-distribution {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 24px;
}

.job-chip {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 6px 14px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  transition: transform 0.2s, background 0.2s;
}
.job-chip:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.08);
}

.job-count {
  font-weight: 900;
  color: #a5d6a7;
  background: rgba(76, 175, 80, 0.2);
  padding: 2px 8px;
  border-radius: 8px;
  font-family: monospace;
}

.member-table-wrapper {
  overflow-x: auto;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  background: rgba(255,255,255,0.02);
}

.member-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  text-align: left;
}

.member-table th {
  color: #888;
  padding: 12px 16px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0,0,0,0.4);
  font-size: 0.7rem;
}

.member-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.02);
  color: #ccc;
  font-weight: 500;
}

.member-table tr:hover td {
  background: rgba(255,255,255,0.03);
}

.job-cell { color: #fff; font-weight: 700; }
.job-icon-small { font-size: 1rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }

.mode-tag {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255,255,255,0.1);
}

.mode-tag.gathering, .mode-tag.mining, .mode-tag.building { color: #81c784; background: rgba(76, 175, 80, 0.15); border-color: rgba(76, 175, 80, 0.3); }
.mode-tag.engaging { color: #e57373; background: rgba(244, 67, 54, 0.15); border-color: rgba(244, 67, 54, 0.3); }
.mode-tag.idle { color: #999; }

.state-cell { font-family: monospace; color: #aaa; font-size: 0.75rem; }

.no-tool { color: #555; font-style: italic; }

.buff-cell { text-align: center; }
.buff-active { color: #ffd700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.6); font-size: 1.1rem; }

.loyalty-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loyalty-bg {
  width: 60px;
  height: 6px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.loyalty-fill {
  height: 100%;
  background: linear-gradient(90deg, #29b6f6, #4fc3f7);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(79, 195, 247, 0.5);
}

.loyalty-text {
  font-weight: 800;
  font-family: monospace;
  color: #fff;
}

.no-data {
  padding: 100px;
  text-align: center;
  color: #666;
  font-style: italic;
  font-size: 1.2rem;
  letter-spacing: 2px;
}

/* Scrollbar */
.scrollbar-custom::-webkit-scrollbar { width: 6px; }
.scrollbar-custom::-webkit-scrollbar-track { background: transparent; }
.scrollbar-custom::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 3px; }
.scrollbar-custom::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }

/* Transitions */
.panel-fade-enter-active, .panel-fade-leave-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-fade-enter-from, .panel-fade-leave-to { opacity: 0; transform: translate(-50%, -40%) scale(0.95); filter: blur(10px); }

@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
</style>
