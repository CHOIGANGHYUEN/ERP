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
        
        // 기타 기본 스탯
        this.health = options.health || 100;
        this.maxHealth = options.maxHealth || 100;
        this.strength = options.strength || 10;
        this.speed = options.speed || 1.0;
    }
}