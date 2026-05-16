export default class Velocity {
    constructor(vx = 0, vy = 0) {
        this._vx = vx;
        this._vy = vy;
        this._ax = 0;
        this._ay = 0;
        this._buffer = null;
        this._index = -1;
    }

    reset() {
        this._vx = 0;
        this._vy = 0;
        this._ax = 0;
        this._ay = 0;
        this._buffer = null;
        this._index = -1;
    }

    /** 🚀 [Expert Optimization] TypedArray 버퍼 연결 */
    linkBuffer(buffer, index) {
        const isFirstLink = (this._buffer === null);
        this._buffer = buffer;
        this._index = index;
        
        if (isFirstLink && this._buffer) {
            this._buffer[this._index] = this._vx;
            this._buffer[this._index + 1] = this._vy;
            this._buffer[this._index + 2] = this._ax;
            this._buffer[this._index + 3] = this._ay;
        }
    }

    get vx() { return this._buffer ? this._buffer[this._index] : this._vx; }
    set vx(value) {
        if (this._buffer) this._buffer[this._index] = value;
        else this._vx = value;
    }

    get vy() { return this._buffer ? this._buffer[this._index + 1] : this._vy; }
    set vy(value) {
        if (this._buffer) this._buffer[this._index + 1] = value;
        else this._vy = value;
    }

    get ax() { return this._buffer ? this._buffer[this._index + 2] : this._ax; }
    set ax(value) {
        if (this._buffer) this._buffer[this._index + 2] = value;
        else this._ax = value;
    }

    get ay() { return this._buffer ? this._buffer[this._index + 3] : this._ay; }
    set ay(value) {
        if (this._buffer) this._buffer[this._index + 3] = value;
        else this._ay = value;
    }

    /**
     * 🧭 8방향 인덱스 반환 (0: N, 1: NE, 2: E, 3: SE, 4: S, 5: SW, 6: W, 7: NW)
     */
    getDirection8() {
        const vx = this.vx;
        const vy = this.vy;
        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return -1; // 정지 상태

        const angle = Math.atan2(vy, vx); // -PI to PI
        // -PI to PI를 0 to 2PI로 변환 후 8분할
        let normalized = angle + Math.PI; // 0 to 2PI
        // 0: W, 2: N, 4: E, 6: S (기존 로직과 맞추기 위해 보정 필요할 수 있음)
        // 일반적인 8방향 인덱싱 (0: E, 1: SE, 2: S ...)를 위해:
        let deg = (angle * 180 / Math.PI) + 180; // 0 to 360 (0 is West)
        // 0: West, 45: NW, 90: North, 135: NE, 180: East, 225: SE, 270: South, 315: SW
        
        // 0: North, 1: NE, 2: East, 3: SE, 4: South, 5: SW, 6: West, 7: NW 순서로 변환
        // North(90deg) -> 0
        let dir = Math.round(((angle * 180 / Math.PI) + 90) / 45);
        return (dir + 8) % 8;
    }

    /** 🏎️ 속도 벡터의 크기(Magnitude) 반환 */
    mag() {
        const vx = this.vx;
        const vy = this.vy;
        return Math.sqrt(vx * vx + vy * vy);
    }
}