import { defineStore } from 'pinia';

export const useWorldboxStore = defineStore('worldbox', {
  state: () => ({
    selectedEntity: null,
    villages: [], // 🏘️ 마을 정보 목록
    nations: [],  // 🚩 국가 정보 목록
    showVillageInfo: false, // 📋 마을 상세 정보창 표시 여부
    showNationInfo: false,  // 👑 국가 상세 정보창 표시 여부
  }),
  actions: {
    updateVillageStats(villages) {
      // 🏘️ 브릿지 데이터를 스토어에 반영 (영토 리스트 등 무거운 변환 제거)
      this.villages = villages;
    },
    updateNationStats(nations) {
      this.nations = nations;
    },
    closeVillageInfo() {
      this.showVillageInfo = false;
      // ❌ 도구모음 상태와 엉켜서 창이비정상적으로 다시 열리는 현상을 방지합니다.
      if (window.eventBus) {
        window.eventBus.emit('DESELECT_TOOL');
        window.eventBus.emit('TOOL_CHANGED', null);
      }
      // 명시적으로 엔진의 타일 렌더링 플래그도 끄기
      if (window.gameEngine) {
        window.gameEngine.viewFlags = window.gameEngine.viewFlags || {};
        window.gameEngine.viewFlags.showVillageInfo = false;
        window.gameEngine.viewFlags.VILLAGETILE = false;
      }
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