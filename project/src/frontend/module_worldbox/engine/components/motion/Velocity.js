export default class Velocity {
    constructor(vx = 0, vy = 0) {
        this._vx = vx;
        this._vy = vy;
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
}