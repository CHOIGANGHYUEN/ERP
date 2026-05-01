import Component from '../../core/Component.js';

/**
 * ⏳ Age Component
 * 개체의 현재 나이와 최대 수명을 관리합니다.
 */
export default class Age extends Component {
    constructor(options = {}) {
        super('Age');
        this.currentAge = options.currentAge || 0; // 현재 나이 (단위: 년)
        this.maxAge = options.maxAge || (60 + Math.random() * 40); // 최대 수명 (평균 60~100년)
        this.birthTime = options.birthTime || Date.now(); // 태어난 시간
        this.growthStage = options.growthStage || 'infant'; // infant, juvenile, adult, elder
    }

    /** 나이에 따른 성장 단계 업데이트 */
    updateStage() {
        const lifeRatio = this.currentAge / this.maxAge;
        if (lifeRatio < 0.1) this.growthStage = 'infant';
        else if (lifeRatio < 0.3) this.growthStage = 'juvenile';
        else if (lifeRatio < 0.8) this.growthStage = 'adult';
        else this.growthStage = 'elder';
    }
}
