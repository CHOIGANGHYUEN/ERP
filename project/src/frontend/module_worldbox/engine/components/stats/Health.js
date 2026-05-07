import Component from '../../core/Component.js';

/**
 * 🏥 Health Component
 * 엔티티의 체력 상태와 피격 시각 효과 상태를 관리합니다.
 */
export default class Health extends Component {
    constructor(maxHp = 100) {
        super('Health');
        this._currentHp = maxHp;
        this._maxHp = maxHp;
        
        this._buffer = null;
        this._index = -1;

        // 🤕 피격 피드백 관련 상태
        this.isHit = false;     // 현재 프레임에서 타격받았는지 여부
        this.hitTimer = 0;      // 피격 애니메이션(흔들림, 틴트) 지속 시간
        this.lastHitTime = 0;   // 마지막 피격 타임스탬프
    }

    /** 🚀 [Expert Optimization] 버퍼 연결 */
    linkBuffer(buffer, index) {
        const isFirstLink = (this._buffer === null);
        this._buffer = buffer;
        this._index = index;
        
        if (isFirstLink && this._buffer) {
            this._buffer[this._index] = this._currentHp;
            this._buffer[this._index + 1] = this._maxHp;
        }
    }

    get currentHp() { return this._buffer ? this._buffer[this._index] : this._currentHp; }
    set currentHp(v) { 
        if (this._buffer) this._buffer[this._index] = v;
        else this._currentHp = v;
    }

    get health() { return this.currentHp; }
    set health(v) { this.currentHp = v; }

    get maxHp() { return this._buffer ? this._buffer[this._index + 1] : this._maxHp; }
    set maxHp(v) { 
        if (this._buffer) this._buffer[this._index + 1] = v;
        else this._maxHp = v;
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
