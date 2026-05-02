/**
 * 📝 Blackboard.js
 * 시뮬레이션 내의 전략적 정보를 캐싱하는 공유 저장소입니다.
 * 개체들이 개별적으로 연산하기 무거운 정보들을 매니저가 이곳에 업데이트합니다.
 */
export default class Blackboard {
    constructor() {
        this.globalData = new Map();
        this.storages = []; // [{ id, pos, resources }]
        this.resourceNodes = new Map(); // Type -> [ { id, pos } ]
        this.zoneInfo = new Map(); // ZoneID -> Data
    }

    set(key, value) {
        this.globalData.set(key, value);
    }

    get(key) {
        return this.globalData.get(key);
    }

    /**
     * 특정 자원 타입의 창고 중 가장 재고가 많은 곳 또는 빈 곳을 찾기 위한 캐시 업데이트
     */
    updateStorages(storageEntities) {
        this.storages = storageEntities;
    }

    /**
     * 자원 노드 캐시 업데이트 (TargetManager에서 사용)
     */
    updateResourceNodes(type, nodes) {
        this.resourceNodes.set(type, nodes);
    }

    clear() {
        this.globalData.clear();
        this.storages = [];
        this.resourceNodes.clear();
        this.zoneInfo.clear();
    }
}
