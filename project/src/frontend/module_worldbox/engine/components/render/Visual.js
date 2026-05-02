import Component from '../../core/Component.js';

export default class Visual extends Component {
    constructor(options = {}) {
        super('Visual');
        this.type = options.type || 'fallback';
        this.subtype = options.subtype || ''; // 🏠 Added subtype support for buildings/resources
        this.color = options.color || '#ffffff';
        this.alpha = options.alpha !== undefined ? options.alpha : 1.0;
        this.size = options.size || 1.0;
        
        // 🎞️ 애니메이션 제어 데이터
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.flipX = false;
        
        // 📊 상태별 애니메이션 메타데이터
        this.animations = {
            'wander': { frames: [0, 1, 0, 2], speed: 200 }, // IDLE/WANDER
            'walk':   { frames: [0, 1, 0, 2], speed: 150 },
            'run':    { frames: [0, 1, 0, 2], speed: 80  },
            'flee':   { frames: [0, 1, 0, 2], speed: 80  },
            'hunt':   { frames: [0, 1, 0, 2], speed: 100 },
            'forage': { frames: [0, 1, 0, 2], speed: 180 },
            'eat':    { frames: [0, 3, 0, 3], speed: 250 },

            'sleep':  { frames: [4],           speed: 1000 },
            'die':    { frames: [5],           speed: 1000, loop: false }
        };

        // 시각적 상태 플래그 (기존 로직 유지)
        this.isEating = false;
        this.isInside = false;
        this.isPooping = false;
        this.isCulled = false;
        this.isSleeping = false;
    }


}