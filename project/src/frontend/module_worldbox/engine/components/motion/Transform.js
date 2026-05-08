export default class Transform {
    constructor(x = 0, y = 0) {
        this._x = x;
        this._y = y;
        this._buffer = null;
        this._index = -1;
    }

    reset() {
        this._x = 0;
        this._y = 0;
        this._buffer = null;
        this._index = -1;
        this._velocity = null;
        this._velocityBuffer = null;
        this._vIndex = -1;
    }

    /** 🚀 [Expert Optimization] TypedArray 버퍼 연결 */
    linkBuffer(buffer, index) {
        // 이미 연결된 상태에서 재연결(Resize)되는 경우, 기존 버퍼의 값을 보존해야 함
        // (EntityManager가 이미 복사를 완료했으므로 여기선 참조만 갱신)
        const isFirstLink = (this._buffer === null);
        
        this._buffer = buffer;
        this._index = index;
        
        if (isFirstLink && this._buffer) {
            this._buffer[this._index] = this._x;
            this._buffer[this._index + 1] = this._y;
        }
    }

    /** 🚀 [DOD Fix] 벨로시티 버퍼 재연결 지원 */
    linkVelocityBuffer(buffer, index) {
        this._velocityBuffer = buffer;
        this._vIndex = index;
    }

    get x() { return this._buffer ? this._buffer[this._index] : this._x; }
    set x(v) { 
        if (this._buffer) this._buffer[this._index] = v;
        else this._x = v;
    }

    get y() { return this._buffer ? this._buffer[this._index + 1] : this._y; }
    set y(v) { 
        if (this._buffer) this._buffer[this._index + 1] = v;
        else this._y = v;
    }

    get velocity() { return this._velocity; }
    set velocity(v) {
        this._velocity = v;
        if (v && v.linkBuffer) {
            this.linkVelocityBuffer(v._buffer, v._index);
        }
    }

    // 🎯 [Expert Support] 기존 x, y 프로퍼티를 사용하는 시스템을 위한 속도 프록시
    get vx() { return this._velocityBuffer ? this._velocityBuffer[this._vIndex] : (this._velocity ? this._velocity.vx : 0); }
    set vx(v) { 
        if (this._velocityBuffer) this._velocityBuffer[this._vIndex] = v;
        else if (this._velocity) this._velocity.vx = v;
    }

    get vy() { return this._velocityBuffer ? this._velocityBuffer[this._vIndex + 1] : (this._velocity ? this._velocity.vy : 0); }
    set vy(v) { 
        if (this._velocityBuffer) this._velocityBuffer[this._vIndex + 1] = v;
        else if (this._velocity) this._velocity.vy = v;
    }

    // 🚀 [Expert DOD] Acceleration proxies
    get ax() { return this._velocityBuffer ? this._velocityBuffer[this._vIndex + 2] : (this._velocity ? this._velocity.ax : 0); }
    set ax(v) {
        if (this._velocityBuffer) this._velocityBuffer[this._vIndex + 2] = v;
        else if (this._velocity) this._velocity.ax = v;
    }

    get ay() { return this._velocityBuffer ? this._velocityBuffer[this._vIndex + 3] : (this._velocity ? this._velocity.ay : 0); }
    set ay(v) {
        if (this._velocityBuffer) this._velocityBuffer[this._vIndex + 3] = v;
        else if (this._velocity) this._velocity.ay = v;
    }
}