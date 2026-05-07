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
        this.maxWaste = options.maxWaste || 100;

        // 🚀 [Expert Optimization] TypedArray 버퍼 연결을 위한 내부 변수
        this._health = options.health || 100;
        this._maxHealth = options.maxHealth || 100;
        this._hunger = options.hunger !== undefined ? options.hunger : 50;
        this._maxHunger = options.maxHunger || 100;
        this._fatigue = options.fatigue !== undefined ? options.fatigue : 0;
        this._maxFatigue = options.maxFatigue || 100;
        this._strength = options.strength || 10;
        this._defense = options.defense || 0;
        
        this._speed = options.speed || 1.0;
        this._digestionQuality = options.digestionQuality || 0.5;
        this._waste = options.waste !== undefined ? options.waste : 0;
        this._storedFertility = 0;

        this._buffer = null;      // Int32Buffer [hp, maxHp, hunger, maxHunger, fatigue, maxFatigue, str, def]
        this._fBuffer = null;     // Float32Buffer [speed, digestion, waste, fertility]
        this._index = -1;
        this._fIndex = -1;

        // 🤕 [Injury System] 피격 시 속도 저하 효과
        this.injurySlowMultiplier = 1.0; 
        this.injurySlowTimer = 0;        
    }

    /** 🚀 [Expert Optimization] 이중 버퍼 연결 (정수/실수 분리) */
    linkBuffer(buffer, index, fBuffer, fIndex) {
        const isFirstLink = (this._buffer === null);
        this._buffer = buffer;
        this._index = index;
        this._fBuffer = fBuffer;
        this._fIndex = fIndex;
        
        if (isFirstLink && this._buffer) {
            // Int32 Slots
            this._buffer[this._index] = this._health;
            this._buffer[this._index + 1] = this._maxHealth;
            this._buffer[this._index + 2] = this._hunger;
            this._buffer[this._index + 3] = this._maxHunger;
            this._buffer[this._index + 4] = this._fatigue;
            this._buffer[this._index + 5] = this._maxFatigue;
            this._buffer[this._index + 6] = this._strength;
            this._buffer[this._index + 7] = this._defense;

            // Float32 Slots
            if (this._fBuffer) {
                this._fBuffer[this._fIndex] = this._speed;
                this._fBuffer[this._fIndex + 1] = this._digestionQuality;
                this._fBuffer[this._fIndex + 2] = this._waste;
                this._fBuffer[this._fIndex + 3] = this._storedFertility;
            }
        }
    }

    get health() { return this._buffer ? this._buffer[this._index] : this._health; }
    set health(v) { 
        if (this._buffer) this._buffer[this._index] = Math.round(v);
        else this._health = v;
    }

    get maxHealth() { return this._buffer ? this._buffer[this._index + 1] : this._maxHealth; }
    set maxHealth(v) { 
        if (this._buffer) this._buffer[this._index + 1] = Math.round(v);
        else this._maxHealth = v;
    }

    get hunger() { return this._buffer ? this._buffer[this._index + 2] : this._hunger; }
    set hunger(v) { 
        if (this._buffer) this._buffer[this._index + 2] = Math.round(v);
        else this._hunger = v;
    }

    get maxHunger() { return this._buffer ? this._buffer[this._index + 3] : this._maxHunger; }
    set maxHunger(v) { 
        if (this._buffer) this._buffer[this._index + 3] = Math.round(v);
        else this._maxHunger = v;
    }

    get fatigue() { return this._buffer ? this._buffer[this._index + 4] : this._fatigue; }
    set fatigue(v) { 
        if (this._buffer) this._buffer[this._index + 4] = Math.round(v);
        else this._fatigue = v;
    }

    get maxFatigue() { return this._buffer ? this._buffer[this._index + 5] : this._maxFatigue; }
    set maxFatigue(v) { 
        if (this._buffer) this._buffer[this._index + 5] = Math.round(v);
        else this._maxFatigue = v;
    }

    get strength() { return this._buffer ? this._buffer[this._index + 6] : this._strength; }
    set strength(v) { 
        if (this._buffer) this._buffer[this._index + 6] = Math.round(v);
        else this._strength = v;
    }

    get defense() { return this._buffer ? this._buffer[this._index + 7] : this._defense; }
    set defense(v) { 
        if (this._buffer) this._buffer[this._index + 7] = Math.round(v);
        else this._defense = v;
    }

    get speed() { return this._fBuffer ? this._fBuffer[this._fIndex] : this._speed; }
    set speed(v) { 
        if (this._fBuffer) this._fBuffer[this._fIndex] = v;
        else this._speed = v;
    }

    get digestionQuality() { return this._fBuffer ? this._fBuffer[this._fIndex + 1] : this._digestionQuality; }
    set digestionQuality(v) { 
        if (this._fBuffer) this._fBuffer[this._fIndex + 1] = v;
        else this._digestionQuality = v;
    }

    get waste() { return this._fBuffer ? this._fBuffer[this._fIndex + 2] : this._waste; }
    set waste(v) { 
        if (this._fBuffer) this._fBuffer[this._fIndex + 2] = v;
        else this._waste = v;
    }

    get storedFertility() { return this._fBuffer ? this._fBuffer[this._fIndex + 3] : this._storedFertility; }
    set storedFertility(v) { 
        if (this._fBuffer) this._fBuffer[this._fIndex + 3] = v;
        else this._storedFertility = v;
    }

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
