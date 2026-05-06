import Component from '../../core/Component.js';

/**
 * 📊 Base Stats Component
 * 
 * 개체의 기본 능력치 및 생존 수치(식성, 포만감, 피로도 등)를 관리합니다.
 */
export default class BaseStats extends Component {
    constructor(options = {}) {
        super('BaseStats');

        this.diet = options.diet || 'herbivore'; 

        // 🚀 [Expert Optimization] TypedArray 버퍼 연결을 위한 내부 변수
        this._health = options.health || 100;
        this._maxHealth = options.maxHealth || 100;
        this._hunger = options.hunger !== undefined ? options.hunger : 50;
        this.maxHunger = options.maxHunger || 100;
        this._fatigue = options.fatigue !== undefined ? options.fatigue : 0;
        this.maxFatigue = options.maxFatigue || 100;
        this._speed = options.speed || 1.0;
        
        this._buffer = null;
        this._index = -1;

        // 배설 대기량 (Waste) 💩
        this.waste = options.waste !== undefined ? options.waste : 0;
        this.maxWaste = options.maxWaste || 100;
        this.storedFertility = 0; 
        this.digestionQuality = 0.5; 

        // 기타 기본 스탯
        this.strength = options.strength || 10;
        this.defense = options.defense || 0; 

        // 🤕 [Injury System] 피격 시 속도 저하 효과
        this.injurySlowMultiplier = 1.0; 
        this.injurySlowTimer = 0;        
    }

    /** 🚀 버퍼 연결 */
    linkBuffer(buffer, index) {
        this._buffer = buffer;
        this._index = index;
        if (this._buffer) {
            this._buffer[this._index] = this._health;
            this._buffer[this._index + 1] = this._hunger;
            this._buffer[this._index + 2] = this._fatigue;
            this._buffer[this._index + 3] = this._speed;
        }
    }

    get health() { return this._buffer ? this._buffer[this._index] : this._health; }
    set health(v) { 
        if (this._buffer) this._buffer[this._index] = v;
        else this._health = v;
    }

    get hunger() { return this._buffer ? this._buffer[this._index + 1] : this._hunger; }
    set hunger(v) { 
        if (this._buffer) this._buffer[this._index + 1] = v;
        else this._hunger = v;
    }

    get fatigue() { return this._buffer ? this._buffer[this._index + 2] : this._fatigue; }
    set fatigue(v) { 
        if (this._buffer) this._buffer[this._index + 2] = v;
        else this._fatigue = v;
    }

    get speed() { return this._buffer ? this._buffer[this._index + 3] : this._speed; }
    set speed(v) { 
        if (this._buffer) this._buffer[this._index + 3] = v;
        else this._speed = v;
    }

    get maxHealth() { return this._maxHealth; }
    set maxHealth(v) { this._maxHealth = v; }

    /**
     * 엔티티 재사용(Pooling) 또는 삭제 시 속성을 초기화합니다.
     */
    reset() {
        this.diet = 'herbivore';
        this.hunger = 50;
        this.fatigue = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.strength = 10;
        this.speed = 1.0;
        this.defense = 0;
        this.injurySlowMultiplier = 1.0;
        this.injurySlowTimer = 0;
    }

    /**
     * 방어력을 고려하여 데미지를 적용합니다. (최대 80% 경감)
     * @param {number} amount 기본 공격력
     * @returns {number} 실제 적용된 데미지
     */
    takeDamage(amount) {
        const mitigation = Math.min(0.8, this.defense / 100);
        const finalDamage = Math.max(1, amount * (1 - mitigation));
        this.health = Math.max(0, this.health - finalDamage);

        // 🤕 [Injury Logic] 공격 당하면 일시적으로 속도가 50% 느려짐 (2초간)
        this.injurySlowMultiplier = 0.5;
        this.injurySlowTimer = 2.0;

        return finalDamage;
    }
}
