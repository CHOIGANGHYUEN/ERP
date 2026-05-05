import Component from '../../core/Component.js';
import { TYPE_NAME_TO_ID, ENTITY_FLAGS, SHARED_LAYOUT, VISUAL_FLAGS } from '../../core/Constants.js';

export default class Visual extends Component {
    constructor(options = {}) {
        super('Visual');
        
        // 🚀 [Critical Fix] 전달받은 모든 옵션을 인스턴스에 복사 (itemType 등 누락 방지)
        Object.assign(this, options);

        this._type = options.type || 'fallback';
        this.subtype = options.subtype || ''; 
        this.color = options.color || '#ffffff';
        this._alpha = options.alpha !== undefined ? options.alpha : 1.0;
        this._size = options.size || 1.0;
        this.itemType = options.itemType || ''; // 명시적으로도 할당

        // 🛰️ Shared Buffer Support
        this.sharedData = null;
        this.sharedIntData = null;
        this.stride = 0;
        this.index = -1;
        this._flags = ENTITY_FLAGS.NONE;

        // 🎞️ 애니메이션 제어 데이터
        this.currentFrame = 0;
        this.frameTimer = 0;
        
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

        // 시각적 상태 플래그 (세터를 통해 공유 버퍼와 동기화됨)
        this._isEating = false;
        this._isSleeping = false;
        this.isInside = false;
        this.isPooping = false;
        this.isCulled = false;
    }

    get isEating() { 
        return this.sharedIntData ? (this.flags & ENTITY_FLAGS.IS_EATING) !== 0 : this._isEating; 
    }
    set isEating(val) {
        this._isEating = val;
        this.setFlag(ENTITY_FLAGS.IS_EATING, val);
    }

    get isSleeping() { 
        return this.sharedIntData ? (this.flags & ENTITY_FLAGS.IS_SLEEPING) !== 0 : this._isSleeping; 
    }
    set isSleeping(val) {
        this._isSleeping = val;
        this.setFlag(ENTITY_FLAGS.IS_SLEEPING, val);
    }

    setSharedData(data, intData, stride, index) {
        this.sharedData = data;
        this.sharedIntData = intData;
        this.stride = stride;
        this.index = index;
        this.syncAll();
    }

    syncAll() {
        if (this.index === -1 || !this.sharedData) return;
        const offset = this.index * this.stride;
        const L = SHARED_LAYOUT;
        this.sharedData[offset + L.SIZE] = this._size;
        this.sharedData[offset + L.ALPHA] = this._alpha;
        this.sharedIntData[offset + L.TYPE_ID] = TYPE_NAME_TO_ID[this._type] || 0;
        this.sharedIntData[offset + L.FLAGS] = this._flags;
    }

    // --- 🛰️ Shared Data Getters (Main Thread) ---
    get flags() { return this.sharedIntData ? this.sharedIntData[this.index * this.stride + SHARED_LAYOUT.FLAGS] : this._flags; }
    
    // 🧬 Bitwise Flag Unpacking
    get isBaby() { return (this.flags & VISUAL_FLAGS.IS_BABY) !== 0; }
    get isFemale() { return (this.flags & VISUAL_FLAGS.IS_FEMALE) !== 0; }
    get isChopping() { return (this.flags & VISUAL_FLAGS.IS_CHOPPING) !== 0; }
    get carryingWood() { return (this.flags & VISUAL_FLAGS.CARRYING_WOOD) !== 0; }
    get carryingFood() { return (this.flags & VISUAL_FLAGS.CARRYING_FOOD) !== 0; }
    get isStarving() { return (this.flags & VISUAL_FLAGS.IS_STARVING) !== 0; }
    get isKing() { return (this.flags & VISUAL_FLAGS.IS_KING) !== 0; }
    get isSleeping() { return (this.flags & VISUAL_FLAGS.IS_SLEEPING) !== 0; }

    // --- ⚙️ Worker Thread Methods ---
    setFlag(flag, value) {
        if (value) {
            this._flags |= flag;
        } else {
            this._flags &= ~flag;
        }
        this.syncFlags();
    }

    get size() { return this._size; }
    set size(val) {
        this._size = val;
        if (this.sharedData && this.index !== -1) {
            this.sharedData[this.index * this.stride + SHARED_LAYOUT.SIZE] = val;
        }
    }

    get alpha() { return this._alpha; }
    set alpha(val) {
        this._alpha = val;
        if (this.sharedData && this.index !== -1) {
            this.sharedData[this.index * this.stride + SHARED_LAYOUT.ALPHA] = val;
        }
    }

    get type() { return this._type; }
    set type(val) {
        this._type = val;
        if (this.sharedIntData && this.index !== -1) {
            this.sharedIntData[this.index * this.stride + SHARED_LAYOUT.TYPE_ID] = TYPE_NAME_TO_ID[val] || 0;
        }
    }

    get flipX() { return (this._flags & ENTITY_FLAGS.FLIP_X) !== 0; }
    set flipX(val) {
        if (val) this._flags |= ENTITY_FLAGS.FLIP_X;
        else this._flags &= ~ENTITY_FLAGS.FLIP_X;
        this.syncFlags();
    }

    syncFlags() {
        if (this.sharedIntData && this.index !== -1) {
            this.sharedIntData[this.index * this.stride + SHARED_LAYOUT.FLAGS] = this._flags;
        }
    }
}