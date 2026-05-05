import Component from '../../core/Component.js';

/**
 * 🏥 Health Component
 * 엔티티의 체력 상태와 피격 시각 효과 상태를 관리합니다.
 */
export default class Health extends Component {
    constructor(maxHp = null, entityId = -1, bufferManager = null) {
        super('Health');
        this.entityId = entityId;
        this.bufferManager = bufferManager;

        if (bufferManager && entityId !== -1) {
            if (maxHp !== null) {
                bufferManager.hp[entityId] = maxHp;
                bufferManager.maxHp[entityId] = maxHp;
            }
        } else {
            this._maxHp = maxHp ?? 100;
            this._currentHp = this._maxHp;
        }
        
        // 🤕 피격 피드백 관련 상태 (로컬 유지 가능)
        this.isHit = false;
        this.hitTimer = 0;
        this.lastHitTime = 0;
    }

    get currentHp() {
        return this.bufferManager ? this.bufferManager.hp[this.entityId] : this._currentHp;
    }
    set currentHp(val) {
        if (this.bufferManager) this.bufferManager.hp[this.entityId] = val;
        else this._currentHp = val;
    }

    get maxHp() {
        return this.bufferManager ? this.bufferManager.maxHp[this.entityId] : this._maxHp;
    }
    set maxHp(val) {
        if (this.bufferManager) this.bufferManager.maxHp[this.entityId] = val;
        else this._maxHp = val;
    }

    /**
     * 데미지를 입힙니다.
     * @param {number} amount - 데미지 양
     */
    takeDamage(amount) {
        this.currentHp = Math.max(0, this.currentHp - amount);
        this.isHit = true;
        this.hitTimer = 0.2; // 0.2초간 피격 효과 유지
        this.lastHitTime = Date.now();
        return this.currentHp <= 0; // 사망 여부 반환
    }

    /**
     * 체력을 회복합니다.
     */
    heal(amount) {
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    }

    update(dt) {
        if (this.hitTimer > 0) {
            this.hitTimer -= dt;
            if (this.hitTimer <= 0) {
                this.isHit = false;
                this.hitTimer = 0;
            }
        }
    }
}
