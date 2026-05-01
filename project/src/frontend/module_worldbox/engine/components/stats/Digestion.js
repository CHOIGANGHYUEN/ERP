import Component from '../../core/Component.js';

/**
 * 🍖 Digestion Component
 * 식사 시 포만감 회복 및 감정 변화를 관리합니다.
 */
export default class Digestion extends Component {
    constructor(options = {}) {
        super('Digestion');
        this.digestionSpeed = options.digestionSpeed || 0.15;
        this.fullnessEfficiency = options.fullnessEfficiency || 1.0;
        this.lastMealTime = 0;
    }

    /**
     * 식사 이벤트 발생 시 호출
     * @param {Object} stats - BaseStats 컴포넌트
     * @param {Object} emotion - Emotion 컴포넌트 (있을 경우)
     * @param {number} amount - 섭취량
     */
    onEat(stats, emotion, amount) {
        if (stats) {
            stats.hunger = Math.min(stats.maxHunger, stats.hunger + amount * this.fullnessEfficiency);
        }

        // 😊 기분 좋아짐! (인간 등 Emotion 컴포넌트가 있는 경우)
        if (emotion) {
            emotion.happiness = Math.min(100, emotion.happiness + (amount * 0.5));
            emotion.stress = Math.max(0, emotion.stress - (amount * 0.2));
            emotion.calculateMood();
        }
    }
}
