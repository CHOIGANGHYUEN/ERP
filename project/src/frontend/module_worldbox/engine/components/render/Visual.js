import Component from '../../core/Component.js';

export default class Visual extends Component {
    constructor(options = {}) {
        super('Visual');
        
        // 🚀 [Critical Fix] 전달받은 모든 옵션을 인스턴스에 복사 (itemType 등 누락 방지)
        Object.assign(this, options);

        this._type = options.type || 'fallback';
        this._subtype = options.subtype || ''; 
        this._color = options.color || '#ffffff';
        this._alpha = options.alpha !== undefined ? options.alpha : 1.0;
        this._size = options.size || 10.0;
        this.itemType = options.itemType || '';

        this._currentFrame = 0;
        this._frameTimer = 0;
        this._flipX = false;
        this._facing = 0;

        this._buffer = null;
        this._index = -1;

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
        
        // 💥 Impact & Squash/Stretch Metadata
        this.impactTime = 0; // 시뮬레이션 절대 시간 기준
        this.impactType = ''; // 'attack', 'hit', 'gather' 등
    }

    /** 🚀 [Expert Optimization] 버퍼 연결 */
    linkBuffer(buffer, index) {
        const isFirstLink = (this._buffer === null);
        this._buffer = buffer;
        this._index = index;
        
        if (isFirstLink && this._buffer) {
            this._buffer[this._index + 2] = this._currentFrame;
            this._buffer[this._index + 3] = this._flipX ? 1 : 0;
            this._buffer[this._index + 4] = Math.round(this._size);
            this._buffer[this._index + 5] = Math.round(this._alpha * 255);
            this._buffer[this._index + 6] = this._facing;
        }
    }

    get currentFrame() { return this._buffer ? this._buffer[this._index + 2] : this._currentFrame; }
    set currentFrame(v) { 
        if (this._buffer) this._buffer[this._index + 2] = v;
        else this._currentFrame = v;
    }

    get flipX() { return this._buffer ? (this._buffer[this._index + 3] === 1) : this._flipX; }
    set flipX(v) { 
        if (this._buffer) this._buffer[this._index + 3] = v ? 1 : 0;
        else this._flipX = v;
    }

    get size() { return this._buffer ? this._buffer[this._index + 4] : this._size; }
    set size(v) { 
        if (this._buffer) this._buffer[this._index + 4] = Math.round(v);
        else this._size = v;
    }

    get alpha() { return this._buffer ? (this._buffer[this._index + 5] / 255) : this._alpha; }
    set alpha(v) { 
        if (this._buffer) this._buffer[this._index + 5] = Math.round(v * 255);
        else this._alpha = v;
    }

    get facing() { return this._buffer ? this._buffer[this._index + 6] : this._facing; }
    set facing(v) { 
        if (this._buffer) this._buffer[this._index + 6] = v;
        else this._facing = v;
    }
    
    get type() { return this._type; }
    set type(v) { this._type = v; }
    
    get subtype() { return this._subtype; }
    set subtype(v) { this._subtype = v; }

    get frameTimer() { return this._frameTimer; }
    set frameTimer(v) { this._frameTimer = v; }
}