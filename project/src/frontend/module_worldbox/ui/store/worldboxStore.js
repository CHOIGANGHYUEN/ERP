import { defineStore } from 'pinia';

export const useWorldboxStore = defineStore('worldbox', {
  state: () => ({
    selectedEntity: null,
    isPanelOpen: false
  }),
  actions: {
    selectEntity(entityData) {
      this.selectedEntity = entityData;
      this.isPanelOpen = !!entityData;
    },
    closePanel() {
      this.selectedEntity = null;
      this.isPanelOpen = false;
    }
  }
});
