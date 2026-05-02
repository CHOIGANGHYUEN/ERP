import Component from '../../core/Component.js';

/**
 * 🎯 Target Component
 * 개체가 현재 목표로 하고 있는 대상에 대한 정보를 저장합니다.
 */
export default class Target extends Component {
    constructor(targetId = null, targetType = null) {
        super('Target');
        this.id = targetId; // 목표 엔티티 ID
        this.type = targetType; // 'RESOURCE', 'STORAGE', 'ENTITY' 등
        this.pos = { x: 0, y: 0 }; // 목표 좌표 캐시
        this.isReached = false;
        this.lastUpdated = 0;
    }

    setTarget(id, x, y, type) {
        this.id = id;
        this.pos.x = x;
        this.pos.y = y;
        this.type = type;
        this.isReached = false;
        this.lastUpdated = Date.now();
    }

    clear() {
        this.id = null;
        this.type = null;
        this.isReached = false;
    }
}