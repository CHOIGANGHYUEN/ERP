import Component from '../../core/Component.js';

/**
 * 🚀 [Performance Overhaul] Visual (DOD Proxy)
 * 렌더링에 필요한 비주얼 데이터를 BufferManager의 TypedArray로 관리합니다.
 */
export const VISUAL_TYPES = [
    'fallback', 'human', 'human_baby', 'sheep', 'cow', 'wolf', 'hyena', 'wild_dog', 'tiger', 'lion', 
    'bear', 'fox', 'crocodile', 'deer', 'rabbit', 'horse', 'elephant', 'goat', 'bee',
    'tree', 'tree_oak', 'tree_pine', 'tree_palm', 'tree_tropical_fruit', 'tree_mahogany',
    'item', 'building', 'resource', 'dropped_item',
    'grass', 'flower', 'berry', 'mushroom', 'cactus', 'shrub', 'vine', 'medicinal_herb', 'snow_flower',
    'stone', 'iron', 'gold', 'coal', 'silver', 'copper', 'obsidian', 'gems', 'meat', 'poop', 'bones',
    'lotus', 'seaweed', 'kelp', 'reed', 'waterweed'
];

export default class Visual extends Component {
    constructor(options = {}, entityId = -1, bufferManager = null) {
        super('Visual');
        this.entityId = entityId;
        this.bufferManager = bufferManager;

        // 초기 속성들 (일부는 버퍼로, 일부는 객체에 유지)
        this.subtype = options.subtype || '';
        this.alpha = options.alpha !== undefined ? options.alpha : 1.0;
        this.itemType = options.itemType || '';
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.flipX = false;
        this.facing = 0;

        // 버퍼 주입 시 초기값 설정
        if (bufferManager && entityId !== -1) {
            const idx = entityId;
            if (options.type) bufferManager.vType[idx] = VISUAL_TYPES.indexOf(options.type);
            if (options.size !== undefined) bufferManager.vSize[idx] = options.size;
            if (options.color) bufferManager.vColor[idx] = this.packColor(options.color);
        } else {
            this._type = options.type || 'fallback';
            this._size = options.size || 10;
            this._color = options.color || '#ffffff';
        }

        // 애니메이션 데이터는 시각적 개별성을 위해 객체에 유지 (나중에 최적화 가능)
        this.animations = options.animations || {
            'wander': { frames: [0, 1, 0, 2], speed: 200 },
            'walk':   { frames: [0, 1, 0, 2], speed: 150 },
            'die':    { frames: [5], speed: 1000, loop: false }
        };
    }

    // 🎨 [DOD Proxy Getters/Setters]
    get type() {
        if (!this.bufferManager) return this._type;
        return VISUAL_TYPES[this.bufferManager.vType[this.entityId]] || 'fallback';
    }
    set type(val) {
        if (this.bufferManager) {
            this.bufferManager.vType[this.entityId] = VISUAL_TYPES.indexOf(val);
        } else {
            this._type = val;
        }
    }

    get size() {
        return this.bufferManager ? this.bufferManager.vSize[this.entityId] : this._size;
    }
    set size(val) {
        if (this.bufferManager) this.bufferManager.vSize[this.entityId] = val;
        else this._size = val;
    }

    get color() {
        if (!this.bufferManager) return this._color;
        return this.unpackColor(this.bufferManager.vColor[this.entityId]);
    }
    set color(val) {
        if (this.bufferManager) this.bufferManager.vColor[this.entityId] = this.packColor(val);
        else this._color = val;
    }

    // 🛠️ Utility: Hex String <-> Uint32
    packColor(hex) {
        if (typeof hex === 'number') return hex;
        const cleanHex = hex.replace('#', '');
        return parseInt(cleanHex, 16);
    }
    unpackColor(num) {
        return '#' + num.toString(16).padStart(6, '0');
    }
}