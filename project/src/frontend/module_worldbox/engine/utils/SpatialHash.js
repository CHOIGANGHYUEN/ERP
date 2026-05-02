export default class SpatialHash {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.staticCells = {};  // 🌲 고정된 자원용 (나무, 풀 등)
        this.dynamicCells = {}; // 🐕 움직이는 개체용 (동물 등)
    }

    /**
     * 모든 격자 데이터를 초기화합니다. (호환성 유지용)
     */
    clear() {
        this.clearAll();
    }

    /**
     * 동적 개체 데이터만 초기화합니다.
     */
    clearDynamic() {
        this.dynamicCells = {};
    }

    /**
     * 모든 데이터를 초기화합니다. (맵 로딩 시 등)
     */
    clearAll() {
        this.staticCells = {};
        this.dynamicCells = {};
    }

    /**
     * 엔티티를 등록합니다.
     */
    insert(entityId, x, y, isStatic = false) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        // 🚀 [Expert Optimization] 문자열 키 대신 정수 키(Int32) 사용으로 가비지 생성 원천 차단
        const key = (cellY << 16) | cellX;

        const targetCells = isStatic ? this.staticCells : this.dynamicCells;

        if (!targetCells[key]) {
            targetCells[key] = [];
        }
        
        // 중복 삽입 방지 (성능 및 메모리 안정성 확보)
        if (!targetCells[key].includes(entityId)) {
            targetCells[key].push(entityId);
        }
    }

    /**
     * 엔티티를 제거합니다. (정적 개체 파괴 시 필요)
     */
    remove(entityId, x, y, isStatic = true) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const key = (cellY << 16) | cellX;
        const targetCells = isStatic ? this.staticCells : this.dynamicCells;

        if (targetCells[key]) {
            const index = targetCells[key].indexOf(entityId);
            if (index !== -1) {
                targetCells[key].splice(index, 1);
            }
        }
    }

    /**
     * 정적/동적 영역을 모두 탐색하여 인접 엔티티를 반환합니다.
     */
    query(x, y, radius = 100) {
        const cellRadius = Math.ceil(radius / this.cellSize);
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const foundIds = [];

        for (let oy = -cellRadius; oy <= cellRadius; oy++) {
            const cy = cellY + oy;
            for (let ox = -cellRadius; ox <= cellRadius; ox++) {
                const cx = cellX + ox;
                // 🚀 [Key Fix] insert와 동일하게 (y << 16 | x) 포맷으로 통일
                const key = (cy << 16) | cx;
                
                if (this.staticCells[key]) {
                    for (let i = 0; i < this.staticCells[key].length; i++) {
                        foundIds.push(this.staticCells[key][i]);
                    }
                }
                if (this.dynamicCells[key]) {
                    for (let i = 0; i < this.dynamicCells[key].length; i++) {
                        foundIds.push(this.dynamicCells[key][i]);
                    }
                }
            }
        }
        return foundIds;
    }

    /**
     * 사각형 영역 내의 모든 엔티티를 반환합니다. (Culling 최적화용)
     */
    queryRect(x, y, width, height) {
        const startX = Math.floor(x / this.cellSize);
        const startY = Math.floor(y / this.cellSize);
        const endX = Math.floor((x + width) / this.cellSize);
        const endY = Math.floor((y + height) / this.cellSize);
        
        const foundIds = [];
        for (let cy = startY; cy <= endY; cy++) {
            for (let cx = startX; cx <= endX; cx++) {
                // 🚀 [Key Fix] insert와 동일하게 (y << 16 | x) 포맷으로 통일
                const key = (cy << 16) | cx;
                
                if (this.staticCells[key]) {
                    for (let i = 0; i < this.staticCells[key].length; i++) {
                        foundIds.push(this.staticCells[key][i]);
                    }
                }
                if (this.dynamicCells[key]) {
                    for (let i = 0; i < this.dynamicCells[key].length; i++) {
                        foundIds.push(this.dynamicCells[key][i]);
                    }
                }
            }
        }
        return foundIds;
    }
}
