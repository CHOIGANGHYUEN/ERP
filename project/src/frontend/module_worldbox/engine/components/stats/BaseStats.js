import Component from '../../core/Component.js';

/**
 * 📊 Base Stats Component
 * 
 * 개체의 기본 능력치 및 생존 수치(식성, 포만감, 피로도 등)를 관리합니다.
 */
export default class BaseStats extends Component {
    constructor(options = {}) {
        super('BaseStats');

        this.diet = options.diet || 'herbivore'; // DietType 참조 ('herbivore', 'carnivore', 'omnivore')

        // 포만감 (Hunger)
        this.hunger = options.hunger !== undefined ? options.hunger : 50;
        this.maxHunger = options.maxHunger || 100;

        // 피로도 (Fatigue)
        this.fatigue = options.fatigue !== undefined ? options.fatigue : 0;
        this.maxFatigue = options.maxFatigue || 100;

        // 배설 대기량 (Waste) 💩
        this.waste = options.waste !== undefined ? options.waste : 0;
        this.maxWaste = options.maxWaste || 100;
        this.storedFertility = 0; // 🧪 섭취한 고품질 영양분 축적 (배설 시 비옥도 환원용)
        this.digestionQuality = 0.5; // 🥨 현재 위장 속 음식의 평균 품질

        // 기타 기본 스탯
        this.health = options.health || 100;
        this.maxHealth = options.maxHealth || 100;
        this.strength = options.strength || 10;
        this.speed = options.speed || 1.0;
        this.defense = options.defense || 0; // 방어력 추가
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
        return finalDamage;
    }
}
