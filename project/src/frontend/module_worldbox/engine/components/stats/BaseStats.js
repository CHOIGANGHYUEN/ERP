import Component from '../../core/Component.js';

/**
 * 🚀 [Performance Overhaul] BaseStats (DOD Proxy)
 * 개체의 핵심 수치 데이터를 BufferManager의 TypedArray로 관리합니다.
 * GC 부하를 줄이고 데이터 지향 연산을 가능하게 합니다.
 */
export default class BaseStats extends Component {
    constructor(options = {}, entityId = -1, bufferManager = null) {
        super('BaseStats');
        this.entityId = entityId;
        this.bufferManager = bufferManager;

        this.diet = options.diet || 'herbivore';

        // 버퍼가 제공되면 초기값을 버퍼에 기록
        if (bufferManager && entityId !== -1) {
            const idx = entityId;
            bufferManager.hp[idx] = options.health || 100;
            bufferManager.maxHp[idx] = options.maxHealth || 100;
            bufferManager.hunger[idx] = options.hunger !== undefined ? options.hunger : 50;
            bufferManager.fatigue[idx] = options.fatigue !== undefined ? options.fatigue : 0;
            bufferManager.strength[idx] = options.strength || 10;
            bufferManager.defense[idx] = options.defense || 0;
            bufferManager.speed[idx] = options.speed || 1.0;
        } else {
            // 폴백용 내부 데이터
            this._hp = options.health || 100;
            this._maxHp = options.maxHealth || 100;
            this._hunger = options.hunger !== undefined ? options.hunger : 50;
            this._fatigue = options.fatigue !== undefined ? options.fatigue : 0;
            this._strength = options.strength || 10;
            this._defense = options.defense || 0;
            this._speed = options.speed || 1.0;
        }

        // 비정형 데이터는 그대로 유지
        this.maxHunger = options.maxHunger || 100;
        this.maxFatigue = options.maxFatigue || 100;
        this.maxWaste = options.maxWaste || 100;
        this.waste = options.waste !== undefined ? options.waste : 0;
        this.storedFertility = 0;
        this.digestionQuality = 0.5;
        this.injurySlowMultiplier = 1.0;
        this.injurySlowTimer = 0;
    }

    // 📊 [Getter/Setter] 버퍼와 객체 속성 투명하게 연결
    get health() { return this.bufferManager ? this.bufferManager.hp[this.entityId] : this._hp; }
    set health(v) { if (this.bufferManager) this.bufferManager.hp[this.entityId] = v; else this._hp = v; }

    get maxHealth() { return this.bufferManager ? this.bufferManager.maxHp[this.entityId] : this._maxHp; }
    set maxHealth(v) { if (this.bufferManager) this.bufferManager.maxHp[this.entityId] = v; else this._maxHp = v; }

    get hunger() { return this.bufferManager ? this.bufferManager.hunger[this.entityId] : this._hunger; }
    set hunger(v) { if (this.bufferManager) this.bufferManager.hunger[this.entityId] = v; else this._hunger = v; }

    get fatigue() { return this.bufferManager ? this.bufferManager.fatigue[this.entityId] : this._fatigue; }
    set fatigue(v) { if (this.bufferManager) this.bufferManager.fatigue[this.entityId] = v; else this._fatigue = v; }

    get strength() { return this.bufferManager ? this.bufferManager.strength[this.entityId] : this._strength; }
    set strength(v) { if (this.bufferManager) this.bufferManager.strength[this.entityId] = v; else this._strength = v; }

    get defense() { return this.bufferManager ? this.bufferManager.defense[this.entityId] : this._defense; }
    set defense(v) { if (this.bufferManager) this.bufferManager.defense[this.entityId] = v; else this._defense = v; }

    get speed() { return this.bufferManager ? this.bufferManager.speed[this.entityId] : this._speed; }
    set speed(v) { if (this.bufferManager) this.bufferManager.speed[this.entityId] = v; else this._speed = v; }

    reset() {
        this.health = 100;
        this.hunger = 50;
        this.fatigue = 0;
        this.injurySlowMultiplier = 1.0;
        this.injurySlowTimer = 0;
    }

    takeDamage(amount) {
        const mitigation = Math.min(0.8, this.defense / 100);
        const finalDamage = Math.max(1, amount * (1 - mitigation));
        this.health = Math.max(0, this.health - finalDamage);

        this.injurySlowMultiplier = 0.5;
        this.injurySlowTimer = 2.0;
        return finalDamage;
    }
}
