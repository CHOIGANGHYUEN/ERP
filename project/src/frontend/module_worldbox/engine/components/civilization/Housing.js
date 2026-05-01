import Component from '../../core/Component.js';

/**
 * 🏠 Housing Component
 * 주거지의 거주자 정보와 소유권을 관리합니다.
 */
export default class Housing extends Component {
    constructor(options = {}) {
        super('Housing');
        this.ownerId = options.ownerId || null;
        this.residentIds = options.residentIds || [];
        this.capacity = options.capacity || 4; // 기본 4인 가구
        this.quality = options.quality || 1.0;  // 거주 만족도에 영향
    }

    addResident(id) {
        if (this.residentIds.length < this.capacity) {
            this.residentIds.push(id);
            return true;
        }
        return false;
    }

    removeResident(id) {
        const index = this.residentIds.indexOf(id);
        if (index !== -1) {
            this.residentIds.splice(index, 1);
            return true;
        }
        return false;
    }
}
