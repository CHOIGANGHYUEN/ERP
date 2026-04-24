<template>
  <div class="hud-bottom-center">
    <div v-if="showToolMenu" class="tool-menu-panel dock-style">
      <div class="tool-group">
        <span class="tool-group-label">모니터링 패널</span>
        <button class="tool-btn" :class="{ active: showInspectorPanel }" @click="$emit('update:showInspectorPanel', !showInspectorPanel)">
          <span class="icon">🔍</span><span>인스펙터</span>
        </button>
        <button class="tool-btn" :class="{ active: showLogsPanel }" @click="$emit('update:showLogsPanel', !showLogsPanel)">
          <span class="icon">💬</span><span>이벤트/로그</span>
        </button>
        <button class="tool-btn" :class="{ active: showTerritoryLayer }" @click="$emit('update:showTerritoryLayer', !showTerritoryLayer)">
          <span class="icon">🏁</span><span>영토 레이어</span>
        </button>
        <button class="tool-btn" :class="{ active: showVillageArea }" @click="$emit('update:showVillageArea', !showVillageArea)">
          <span class="icon">⭕</span><span>마을 영역</span>
        </button>
      </div>

      <div class="tool-divider"></div>

      <div class="tool-group">
        <span class="tool-group-label">창조 도구</span>
        <button class="tool-btn" :class="{ active: activeTool === 'human' }" @click="$emit('toggleTool', 'human')">
          <span class="icon">🧑</span><span>인간</span>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'herbivore' }" @click="$emit('toggleTool', 'herbivore')">
          <span class="icon">🐰</span><span>초식동물</span>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'carnivore' }" @click="$emit('toggleTool', 'carnivore')">
          <span class="icon">🐅</span><span>육식동물</span>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'tree' }" @click="$emit('toggleTool', 'tree')">
          <span class="icon">🌳</span><span>나무</span>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'crop' }" @click="$emit('toggleTool', 'crop')">
          <span class="icon">🌾</span><span>농작물</span>
        </button>
      </div>
      
      <div class="tool-divider"></div>

      <div class="tool-group">
        <span class="tool-group-label">건축 도구</span>
        <button class="tool-btn" :class="{ active: activeTool === 'fence' }" @click="$emit('toggleTool', 'fence')">
          <span class="icon">🚧</span><span>울타리</span>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'fence_gate' }" @click="$emit('toggleTool', 'fence_gate')">
          <span class="icon">🚪</span><span>울타리 문</span>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'fence_lock' }" @click="$emit('toggleTool', 'fence_lock')">
          <span class="icon">🔒</span><span>잠금 토글</span>
        </button>
      </div>
      
      <div class="tool-divider"></div>

      <div class="tool-group">
        <span class="tool-group-label">재앙 도구 (타겟)</span>
        <button class="tool-btn" :class="{ active: activeTool === 'tornado' }" @click="$emit('toggleTool', 'tornado')">
          <span class="icon">🌪️</span><span>토네이도</span>
        </button>
      </div>

      <div class="tool-divider"></div>

      <div class="tool-group">
        <span class="tool-group-label">자연/환경 통제 (즉시)</span>
        <button class="tool-btn" @click="$emit('handleAction', 'earthquake')">
          <span class="icon">🌋</span><span>대지진</span>
        </button>
        <button class="tool-btn" @click="$emit('handleAction', 'fertility')">
          <span class="icon">🌿</span><span>비옥도+</span>
        </button>
        <button class="tool-btn" @click="$emit('handleAction', 'weather_clear')">
          <span class="icon">☀️</span><span>맑음</span>
        </button>
        <button class="tool-btn" @click="$emit('handleAction', 'weather_rain')">
          <span class="icon">🌧️</span><span>비</span>
        </button>
        <button class="tool-btn" @click="$emit('handleAction', 'weather_fog')">
          <span class="icon">🌫️</span><span>안개</span>
        </button>
      </div>
    </div>
    <button class="tool-toggle-btn" :class="{ active: showToolMenu }" @click="$emit('update:showToolMenu', !showToolMenu)">
      {{ showToolMenu ? '도구 모음 닫기 ▼' : '창조/환경 도구 열기 ▲' }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  showToolMenu: Boolean,
  showTopUI: Boolean,
  showInspectorPanel: Boolean,
  showInteractionPanel: Boolean,
  showLogsPanel: Boolean,
  showMinimapPanel: Boolean,
  showTerritoryLayer: Boolean,
  showVillageArea: Boolean,
  activeTool: String
})
defineEmits([
  'update:showToolMenu',
  'update:showTopUI',
  'update:showInspectorPanel',
  'update:showInteractionPanel',
  'update:showLogsPanel',
  'update:showMinimapPanel',
  'update:showTerritoryLayer',
  'update:showVillageArea',
  'toggleTool',
  'handleAction'
])
</script>
