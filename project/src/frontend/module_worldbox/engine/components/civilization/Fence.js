/**
 * 🧱 Fence Component
 * 울타리의 재질, 레벨, 연결 상태를 관리합니다.
 */
export default class Fence {
    constructor(data = {}) {
        // 'wood', 'stone', 'iron'
        this.material = data.material || 'wood';
        this.level = data.level || 1;
        this.villageId = data.villageId || -1;
        
        // 🔗 오토 타일링을 위한 주변 연결 상태 (Bitmask: 0-15)
        // 1: North, 2: East, 4: South, 8: West
        this.connections = 0;
        
        // 건설 상태 (0.0 ~ 1.0)
        this.buildProgress = data.buildProgress !== undefined ? data.buildProgress : 1.0;
        this.isBlueprint = data.isBlueprint || false;
    }

    reset() {
        this.material = 'wood';
        this.level = 1;
        this.villageId = -1;
        this.connections = 0;
        this.buildProgress = 1.0;
        this.isBlueprint = false;
    }
}
