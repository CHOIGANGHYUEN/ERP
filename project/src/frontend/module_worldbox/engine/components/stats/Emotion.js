import Component from '../../core/Component.js';

/**
 * 😊 Emotion Component
 * 인간 개체의 행복도, 스트레스 등 심리적 상태를 관리합니다.
 */
export default class Emotion extends Component {
    constructor(options = {}) {
        super('Emotion');
        this.happiness = options.happiness || 50; // 0 ~ 100
        this.stress = options.stress || 0;        // 0 ~ 100
        this.loyalty = options.loyalty || 50;     // 세력에 대한 충성도
        this.mood = 'neutral'; // neutral, happy, angry, sad, stressed
    }

    /** 종합적인 기분 상태 업데이트 */
    calculateMood() {
        if (this.stress > 70) this.mood = 'stressed';
        else if (this.happiness > 80) this.mood = 'happy';
        else if (this.happiness < 30) this.mood = 'sad';
        else if (this.stress > 40) this.mood = 'angry';
        else this.mood = 'neutral';
    }
}
