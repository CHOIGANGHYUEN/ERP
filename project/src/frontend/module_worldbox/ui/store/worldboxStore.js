import { defineStore } from 'pinia';

export const useWorldboxStore = defineStore('worldbox', {
  state: () => ({
    selectedEntity: null,
    villages: [], // 🏘️ 마을 정보 목록
  }),
  actions: {
    updateVillageStats(villages) {
      this.villages = villages;
    },
    selectEntity(data) {
      // null이 들어오면 선택 해제
      this.selectedEntity = data;
    },
    clearSelection() {
      this.selectedEntity = null;
    },
    killEntity(id) {
      if (window.eventBus) {
        window.eventBus.emit('ENTITY_KILL_REQUEST', id);
        this.clearSelection();
      }
    }
  }
});