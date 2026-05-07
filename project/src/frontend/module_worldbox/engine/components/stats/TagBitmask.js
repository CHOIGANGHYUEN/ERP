import Component from '../../core/Component.js';

/**
 * 🏷️ TagBitmask Component
 * 비트마스크를 사용하여 엔티티의 속성을 분류하고 고속 필터링을 지원합니다.
 */
export default class TagBitmask extends Component {
    // Bitmask Constants
    static NONE       = 0;
    static HUMAN      = 1 << 0;
    static ANIMAL     = 1 << 1;
    static CARNIVORE  = 1 << 2;
    static HERBIVORE  = 1 << 3;
    static PREY       = 1 << 4;
    static RESOURCE   = 1 << 5;
    static BUILDING   = 1 << 6;

    constructor(mask = TagBitmask.NONE) {
        super('TagBitmask');
        this._mask = mask;
        this._buffer = null;
        this._index = -1;
    }

    /** 🚀 [Expert Optimization] 버퍼 연결 */
    linkBuffer(buffer, index) {
        const isFirstLink = (this._buffer === null);
        this._buffer = buffer;
        this._index = index;
        
        if (isFirstLink && this._buffer) {
            this._buffer[this._index] = this._mask;
        }
    }

    get mask() { return this._buffer ? this._buffer[this._index] : this._mask; }
    set mask(v) {
        if (this._buffer) this._buffer[this._index] = v;
        else this._mask = v;
    }

    add(tag) { this.mask |= tag; }
    remove(tag) { this.mask &= ~tag; }
    has(tag) { return (this.mask & tag) === tag; }
}