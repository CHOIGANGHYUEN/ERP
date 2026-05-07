export default class Transform {
    constructor(x = 0, y = 0) {
        this._x = x;
        this._y = y;
        this._buffer = null;
        this._index = -1;
    }

    /** 🚀 [Expert Optimization] TypedArray 버퍼 연결 */
    linkBuffer(buffer, index) {
        this._buffer = buffer;
        this._index = index;
        if (this._buffer) {
            this._buffer[this._index] = this._x;
            this._buffer[this._index + 1] = this._y;
        }
    }

    get x() { return this._buffer ? this._buffer[this._index] : this._x; }
    set x(value) {
        if (this._buffer) this._buffer[this._index] = value;
        else this._x = value;
    }

    get y() { return this._buffer ? this._buffer[this._index + 1] : this._y; }
    set y(value) {
        if (this._buffer) this._buffer[this._index + 1] = value;
        else this._y = value;
    }
}