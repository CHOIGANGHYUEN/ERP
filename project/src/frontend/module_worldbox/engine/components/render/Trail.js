import Component from '../../core/Component.js';

/**
 * 🌠 Trail Component
 * 투사체나 고속 이동 개체의 궤적 데이터를 관리합니다.
 */
export default class Trail extends Component {
    constructor(options = {}) {
        super('Trail');
        this.points = [];
        this.maxPoints = options.maxPoints || 10;
        this.color = options.color || 'rgba(255, 255, 255, 0.4)';
        this.width = options.width || 2;
        this.fadeSpeed = options.fadeSpeed || 0.1;
    }

    addPoint(x, y) {
        this.points.push({ x, y, time: performance.now() });
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
    }

    reset() {
        this.points = [];
    }
}