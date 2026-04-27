import { defineStore } from 'pinia';

export const useWorldboxStore = defineStore('worldbox', {
  state: () => ({
    selectedEntity: null,
  }),
  actions: {
    selectEntity(data) {
      // null이 들어오면 선택 해제
      this.selectedEntity = data;
    },
    clearSelection() {
      this.selectedEntity = null;
    }
  }
});