export default class SpatialHash {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.staticCells = new Map();  // 🌲 고정된 자원용
        this.dynamicCells = new Map(); // 🐕 움직이는 개체용
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
        this.dynamicCells.clear();
    }

    /**
     * 모든 데이터를 초기화합니다. (맵 로딩 시 등)
     */
    clearAll() {
        this.staticCells.clear();
        this.dynamicCells.clear();
    }

    /**
     * 엔티티를 등록합니다.
     */
    insert(entityId, x, y, isStatic = false) {
        // 🛡️ [Stability] 유효하지 않은 좌표 차단 (NaN, Infinity 등)
        if (!isFinite(x) || !isFinite(y)) return;

        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        
        // 🚀 [Expert Optimization] 문자열 키 대신 정수 키(Int32) 사용
        const key = (cellY << 16) | cellX;
        const targetCells = isStatic ? this.staticCells : this.dynamicCells;

        let cell = targetCells.get(key);
        if (!cell) {
            cell = [];
            targetCells.set(key, cell);
        }
        
        // 중복 삽입 방지 (includes는 O(N)이지만 격자당 개체수가 적어 Map+Set보다 유리할 수 있음)
        if (!cell.includes(entityId)) {
            cell.push(entityId);
        }
    }

    /**
     * [Expert Optimization] 중복 체크 없이 엔티티를 등록합니다.
     * KinematicSystem과 같이 매 프레임 clearDynamic() 후 호출하는 경우에 최적입니다.
     */
    insertDynamic(entityId, x, y) {
        if (!isFinite(x) || !isFinite(y)) return;

        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const key = (cellY << 16) | cellX;

        let cell = this.dynamicCells.get(key);
        if (!cell) {
            cell = [];
            this.dynamicCells.set(key, cell);
        }
        cell.push(entityId);
    }

    /**
     * 엔티티의 위치를 업데이트합니다. (InputSystem 등에서 사용)
     * 이 클래스는 이전 위치를 저장하지 않으므로, 성능을 위해 단순히 새 위치에 삽입하거나
     * 필요 시 전체 리프레시를 유도합니다.
     */
    update(entityId, x, y, isStatic = false) {
        // 기존 위치를 모르므로 안전하게 새 위치에 삽입만 수행
        // (실제 정밀한 이동은 전용 시스템의 refresh 시점에 처리됨)
        this.insert(entityId, x, y, isStatic);
    }

    /**
     * 엔티티를 제거합니다. (정적 개체 파괴 시 필요)
     */
    remove(entityId, x, y, isStatic = true) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const key = (cellY << 16) | cellX;
        const targetCells = isStatic ? this.staticCells : this.dynamicCells;
        const cell = targetCells.get(key);

        if (cell) {
            const index = cell.indexOf(entityId);
            if (index !== -1) {
                cell.splice(index, 1);
            }
        }
    }

    /**
     * 정적/동적 영역을 모두 탐색하여 인접 엔티티를 반환합니다.
     */
    query(x, y, radius = 100) {
        let cellRadius = Math.ceil(radius / this.cellSize);
        if (isNaN(cellRadius)) cellRadius = 1;
        cellRadius = Math.min(cellRadius, 20); // 🛡️ 최대 20격자(약 2000px)로 탐색 제한

        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const foundIds = [];

        for (let oy = -cellRadius; oy <= cellRadius; oy++) {
            const cy = cellY + oy;
            const rowOffset = cy << 16;
            for (let ox = -cellRadius; ox <= cellRadius; ox++) {
                const cx = cellX + ox;
                const key = rowOffset | cx;
                
                const sCell = this.staticCells.get(key);
                if (sCell) {
                    for (let i = 0; i < sCell.length; i++) {
                        foundIds.push(sCell[i]);
                    }
                }
                const dCell = this.dynamicCells.get(key);
                if (dCell) {
                    for (let i = 0; i < dCell.length; i++) {
                        foundIds.push(dCell[i]);
                    }
                }
            }
        }
        return foundIds;
    }

    /**
     * [Expert Optimization] 가비지 생성을 방지하는 콜백 기반 쿼리
     */
    eachInRange(x, y, radius, callback) {
        let cellRadius = Math.ceil(radius / this.cellSize);
        if (isNaN(cellRadius)) cellRadius = 1;
        cellRadius = Math.min(cellRadius, 20);

        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);

        for (let oy = -cellRadius; oy <= cellRadius; oy++) {
            const cy = cellY + oy;
            const rowOffset = cy << 16;
            for (let ox = -cellRadius; ox <= cellRadius; ox++) {
                const cx = cellX + ox;
                const key = rowOffset | cx;
                
                const sCell = this.staticCells.get(key);
                if (sCell) {
                    for (let i = 0; i < sCell.length; i++) {
                        callback(sCell[i]);
                    }
                }
                const dCell = this.dynamicCells.get(key);
                if (dCell) {
                    for (let i = 0; i < dCell.length; i++) {
                        callback(dCell[i]);
                    }
                }
            }
        }
    }

    /**
     * [Expert Optimization] 나선형(Spiral) 탐색을 수행합니다.
     * 중심점에서 가까운 격자부터 순차적으로 탐색하며, 콜백이 true를 반환하면 즉시 중단합니다.
     * 근접 탐색(Find Nearest) 시 불필요한 외곽 격자 탐색을 방지하여 성능을 대폭 향상시킵니다.
     */
    eachInSpiral(x, y, radius, callback) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        let maxCellRadius = Math.ceil(radius / this.cellSize);
        if (isNaN(maxCellRadius)) maxCellRadius = 1;
        maxCellRadius = Math.min(maxCellRadius, 25); // 최대 탐색 범위 제한

        for (let k = 0; k <= maxCellRadius; k++) {
            if (k === 0) {
                if (this._processCell(cellX, cellY, callback)) return;
            } else {
                // Top & Bottom edges
                for (let ox = -k; ox <= k; ox++) {
                    if (this._processCell(cellX + ox, cellY - k, callback)) return;
                    if (this._processCell(cellX + ox, cellY + k, callback)) return;
                }
                // Left & Right edges (excluding corners already covered)
                for (let oy = -k + 1; oy <= k - 1; oy++) {
                    if (this._processCell(cellX - k, cellY + oy, callback)) return;
                    if (this._processCell(cellX + k, cellY + oy, callback)) return;
                }
            }
        }
    }

    /**
     * 격자 내의 엔티티들을 콜백으로 전달합니다.
     * @private
     */
    _processCell(cx, cy, callback) {
        const key = (cy << 16) | cx;
        
        const sCell = this.staticCells.get(key);
        if (sCell) {
            for (let i = 0; i < sCell.length; i++) {
                if (callback(sCell[i])) return true;
            }
        }
        const dCell = this.dynamicCells.get(key);
        if (dCell) {
            for (let i = 0; i < dCell.length; i++) {
                if (callback(dCell[i])) return true;
            }
        }
        return false;
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
            const rowOffset = cy << 16;
            for (let cx = startX; cx <= endX; cx++) {
                const key = rowOffset | cx;
                
                const sCell = this.staticCells.get(key);
                if (sCell) {
                    for (let i = 0; i < sCell.length; i++) {
                        foundIds.push(sCell[i]);
                    }
                }
                const dCell = this.dynamicCells.get(key);
                if (dCell) {
                    for (let i = 0; i < dCell.length; i++) {
                        foundIds.push(dCell[i]);
                    }
                }
            }
        }
        return foundIds;
    }

    /**
     * [Expert Optimization] 사각형 영역 가비지 프리 쿼리
     */
    eachInRect(x, y, width, height, callback) {
        const startX = Math.floor(x / this.cellSize);
        const startY = Math.floor(y / this.cellSize);
        const endX = Math.floor((x + width) / this.cellSize);
        const endY = Math.floor((y + height) / this.cellSize);
        
        for (let cy = startY; cy <= endY; cy++) {
            const rowOffset = cy << 16;
            for (let cx = startX; cx <= endX; cx++) {
                const key = rowOffset | cx;
                
                const sCell = this.staticCells.get(key);
                if (sCell) {
                    for (let i = 0; i < sCell.length; i++) {
                        callback(sCell[i]);
                    }
                }
                const dCell = this.dynamicCells.get(key);
                if (dCell) {
                    for (let i = 0; i < dCell.length; i++) {
                        callback(dCell[i]);
                    }
                }
            }
        }
    }
}
