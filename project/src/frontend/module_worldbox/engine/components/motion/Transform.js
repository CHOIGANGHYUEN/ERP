/**
 * 🚀 [Performance Overhaul] Transform (DOD Proxy)
 * 개별 객체 대신 BufferManager의 TypedArray 데이터를 직접 참조합니다.
 * 기존의 transform.x, transform.y 접근 방식을 유지하면서 성능을 극대화합니다.
 */
export default class Transform {
    constructor(x = null, y = null, entityId = -1, bufferManager = null) {
        this.entityId = entityId;
        this.bufferManager = bufferManager;

        // 버퍼가 제공되고 좌표가 명시된 경우에만 버퍼에 기록 (초기화용)
        // null인 경우는 기존 버퍼 데이터를 유지하는 '프록시' 모드로 간주
        if (bufferManager && entityId !== -1) {
            if (x !== null) bufferManager.x[entityId] = x;
            if (y !== null) bufferManager.y[entityId] = y;
        } else {
            // 버퍼가 없는 경우(예: 임시 객체)를 위한 폴백
            this._x = x ?? 0;
            this._y = y ?? 0;
        }

        // 🚀 [Added] 속도 데이터 초기화 (프록시 모드가 아닐 때만)
        this._vx = 0;
        this._vy = 0;
    }

    get x() {
        return this.bufferManager ? this.bufferManager.x[this.entityId] : this._x;
    }

    set x(val) {
        if (this.bufferManager) {
            this.bufferManager.x[this.entityId] = val;
        } else {
            this._x = val;
        }
    }

    get y() {
        return this.bufferManager ? this.bufferManager.y[this.entityId] : this._y;
    }

    set y(val) {
        if (this.bufferManager) {
            this.bufferManager.y[this.entityId] = val;
        } else {
            this._y = val;
        }
    }

    // 🚀 [Added] Velocity Getters/Setters for DOD Proxy
    get vx() {
        return this.bufferManager ? this.bufferManager.vx[this.entityId] : this._vx;
    }

    set vx(val) {
        if (this.bufferManager) {
            this.bufferManager.vx[this.entityId] = val;
        } else {
            this._vx = val;
        }
    }

    get vy() {
        return this.bufferManager ? this.bufferManager.vy[this.entityId] : this._vy;
    }

    set vy(val) {
        if (this.bufferManager) {
            this.bufferManager.vy[this.entityId] = val;
        } else {
            this._vy = val;
        }
    }
}