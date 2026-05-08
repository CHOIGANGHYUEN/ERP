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
  width: 900px;
  max-width: 95vw;
  height: 600px;
  max-height: 85vh;
  background: rgba(10, 10, 10, 0.95);
  backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  z-index: 2100;
  pointer-events: auto;
  box-shadow: 0 30px 100px rgba(0,0,0,0.8), 0 0 40px rgba(76, 175, 80, 0.1);
  color: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.monitor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.monitor-header {
  padding: 20px 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-group .icon {
  font-size: 1.5rem;
}

.title-group h2 {
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: 2px;
  font-weight: 800;
  color: #4caf50;
}

.close-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 2rem;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover { color: white; }

.global-overview {
  padding: 20px 30px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  background: rgba(255, 255, 255, 0.02);
}

.stat-card {
  background: rgba(255, 255, 255, 0.03);
  padding: 15px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-label {
  font-size: 0.65rem;
  color: #888;
  font-weight: bold;
  letter-spacing: 1px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 900;
  margin: 5px 0;
}

.stat-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  transition: width 1s ease;
}

.village-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px 30px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.village-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 20px;
}

.village-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.village-name {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
}

.member-count {
  font-size: 0.8rem;
  color: #888;
}

.job-distribution {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.job-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4px 12px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
}

.job-count {
  font-weight: 800;
  color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
  padding: 0 6px;
  border-radius: 10px;
}

.member-table-wrapper {
  overflow-x: auto;
}

.member-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  text-align: left;
}

.member-table th {
  color: #555;
  padding: 8px;
  font-weight: 800;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.member-table td {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  color: #bbb;
}

.job-cell { color: white; font-weight: 600; }
.job-icon-small { font-size: 0.9rem; }

.mode-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.05);
}

.mode-tag.gathering, .mode-tag.mining, .mode-tag.building { color: #4caf50; background: rgba(76, 175, 80, 0.1); }
.mode-tag.engaging { color: #f44336; background: rgba(244, 67, 54, 0.1); }
.mode-tag.idle { color: #888; }

.state-cell { font-family: monospace; color: #888; font-size: 0.7rem; }

.no-tool { color: #555; opacity: 0.5; }

.buff-cell { text-align: center; }
.buff-active { color: #ffd700; text-shadow: 0 0 8px rgba(255, 215, 0, 0.5); }

.loyalty-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loyalty-bg {
  width: 50px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  position: relative;
}

.loyalty-fill {
  height: 100%;
  background: #4fc3f7;
  border-radius: 2px;
}

.no-data {
  padding: 100px;
  text-align: center;
  color: #555;
  font-style: italic;
}

/* Scrollbar */
.scrollbar-custom::-webkit-scrollbar { width: 6px; }
.scrollbar-custom::-webkit-scrollbar-track { background: transparent; }
.scrollbar-custom::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
.scrollbar-custom::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

/* Transitions */
.panel-fade-enter-active, .panel-fade-leave-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-fade-enter-from, .panel-fade-leave-to { opacity: 0; transform: translate(-50%, -40%) scale(0.95); }
</style>
