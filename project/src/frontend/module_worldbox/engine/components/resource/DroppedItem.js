import Component from '../../core/Component.js';

/**
 * 📦 DroppedItem Component
 * 월드 바닥에 드랍된 아이템의 데이터와 수명을 관리합니다.
 */
export default class DroppedItem extends Component {
    constructor(itemType, amount = 1, decaySeconds = 600, displayName = '') {
        super('DroppedItem');
        this.itemType = itemType; 
        this.amount = amount;
        
        // 🏷️ [Cohesion Boost] 아이템 스스로 자신의 이름을 기억함
        this.displayName = displayName || itemType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        
        // ⏳ 자연 소멸(Decay) 로직
        this.decayTimer = decaySeconds;
        this.maxDecayTime = decaySeconds;
    }

    /**
     * 다른 아이템과 병합합니다.
     */
    merge(otherAmount) {
        this.amount += otherAmount;
        // 병합 시 신선도(수명)를 어느 정도 회복시켜주는 로직 (선택 사항)
        this.decayTimer = Math.min(this.maxDecayTime, this.decayTimer + 60); 
    }

    update(dt) {
        if (this.decayTimer > 0) {
            this.decayTimer -= dt;
        }
    }

    get isDecayed() {
        return this.decayTimer <= 0;
    }
}
