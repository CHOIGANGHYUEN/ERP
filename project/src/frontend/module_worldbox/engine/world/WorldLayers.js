/**
 * 🗺️ BaseLayer: 모든 월드 데이터 레이어의 추상 기반 클래스
 * 인터페이스 정의 및 공통 버퍼 관리 로직을 수행합니다.
 */
export class BaseLayer {
    constructor(width, height, ArrayType) {
        this.width = width;
        this.height = height;
        this.buffer = new ArrayType(width * height);
    }

    isValid(idx) {
        return idx >= 0 && idx < this.buffer.length;
    }

    getIndex(x, y) {
        return Math.floor(y) * this.width + Math.floor(x);
    }

    getValue(idx) {
        return this.buffer[idx];
    }

    setValue(idx, value) {
        if (this.isValid(idx)) {
            this.buffer[idx] = value;
        }
    }
}

/**
 * 🧱 TerrainLayer: 지형의 물리적 근본을 결정하는 레이어
 */
export class TerrainLayer extends BaseLayer {
    constructor(width, height) {
        super(width, height, Uint8Array);
    }

    // 지형의 물리적 속성 정의 (Land/Water/Mountain)
    isLand(idx) {
        const tid = this.getValue(idx);
        return [4, 5, 6, 7].includes(tid); 
    }

    isWater(idx) {
        const tid = this.getValue(idx);
        return [0, 1, 2, 3].includes(tid);
    }

    isMountain(idx) {
        const tid = this.getValue(idx);
        return [6, 7].includes(tid);
    }
}

/**
 * 🌿 BiomeLayer: 지형 위에 얹히는 생태적 오버레이 레이어
 */
export class BiomeLayer extends BaseLayer {
    constructor(width, height) {
        super(width, height, Uint32Array);
    }

    // 바이옴 특화 로직 (식생 속성 등)
    getBiomeProps(idx, biomeMap) {
        const bid = this.getValue(idx);
        return biomeMap.get(bid);
    }
}
