import { SHARED_LAYOUT } from '../../core/Constants.js';

export default class Transform {
    constructor(x = 0, y = 0) {
        this._x = x;
        this._y = y;
        this.sharedData = null;
        this.stride = 0;
        this.index = -1;
    }

    setSharedData(data, intData, stride, index) {
        this.sharedData = data;
        this.stride = stride;
        this.index = index;
        if (index !== -1 && this.sharedData) {
            const offset = index * stride;
            this.sharedData[offset + SHARED_LAYOUT.X] = this._x;
            this.sharedData[offset + SHARED_LAYOUT.Y] = this._y;
        }
    }

    get x() {
        if (this.sharedData && this.index !== -1) {
            return this.sharedData[this.index * this.stride + SHARED_LAYOUT.X];
        }
        return this._x;
    }

    set x(val) {
        this._x = val;
        if (this.sharedData && this.index !== -1) {
            this.sharedData[this.index * this.stride + SHARED_LAYOUT.X] = val;
        }
    }

    get y() {
        if (this.sharedData && this.index !== -1) {
            return this.sharedData[this.index * this.stride + SHARED_LAYOUT.Y];
        }
        return this._y;
    }

    set y(val) {
        this._y = val;
        if (this.sharedData && this.index !== -1) {
            this.sharedData[this.index * this.stride + SHARED_LAYOUT.Y] = val;
        }
    }
}