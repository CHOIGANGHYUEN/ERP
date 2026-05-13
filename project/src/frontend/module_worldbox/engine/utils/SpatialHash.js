export default class SpatialHash {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.staticCells = new Map();   // 🌲 고정된 자원용 (나무, 풀 등 - 길찾기 영향 X)
        this.obstacleCells = new Map(); // 🏗️ 고정된 장애물용 (건물, 성벽 등 - 길찾기 영향 O)
        this.dynamicCells = new Map();  // 🐕 움직이는 개체용
        
        // 🚀 [Task 92] 가비지 생성을 막기 위한 쿼리 버퍼 풀 (Round-Robin)
        this.queryBuffers = Array.from({ length: 10 }, () => []);
        this.queryBufferIndex = 0;
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
        // 🚀 [Expert Optimization] Map.clear() 대신 배열 길이 초기화 (Zero-Allocation)
        for (const cell of this.dynamicCells.values()) {
            cell.length = 0;
        }
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
     * layer: 0 (Dynamic), 1 (Static/Nature), 2 (Obstacle/Building)
     */
    insert(entityId, x, y, layer = 0) {
        // 🛡️ [Stability] 유효하지 않은 좌표 차단 (NaN, Infinity 등)
        if (!isFinite(x) || !isFinite(y)) return;

        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        
        // 🚀 [Expert Fix] 음수 좌표 지원을 위해 1000의 오프셋을 부여하여 비트 오염 방지
        const key = ((cellY + 1000) << 16) | (cellX + 1000);
        const targetCells = this._getTargetCells(layer);

        let cell = targetCells.get(key);
        if (!cell) {
            cell = [];
            targetCells.set(key, cell);
        }
        
        cell.push(entityId);
    }

    /**
     * [Expert Optimization] 중복 체크 없이 엔티티를 등록합니다.
     * KinematicSystem과 같이 매 프레임 clearDynamic() 후 호출하는 경우에 최적입니다.
     */
    insertDynamic(entityId, x, y) {
        if (!isFinite(x) || !isFinite(y)) return;

        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const key = ((cellY + 1000) << 16) | (cellX + 1000);

        let cell = this.dynamicCells.get(key);
        if (!cell) {
            cell = [];
            this.dynamicCells.set(key, cell);
        }
        cell.push(entityId);
    }

    /**
     * [Expert Optimization] 이미 계산된 키를 사용하여 엔티티를 등록합니다.
     */
    insertWithKey(entityId, key, layer = 0) {
        const targetCells = this._getTargetCells(layer);
        let cell = targetCells.get(key);
        if (!cell) {
            cell = [];
            targetCells.set(key, cell);
        }
        cell.push(entityId);
    }

    /**
     * 엔티티를 제거합니다.
     */
    remove(entityId, x, y, layer = 1) {
        if (!isFinite(x) || !isFinite(y)) return;
        
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const key = ((cellY + 1000) << 16) | (cellX + 1000);
        this.removeFromCell(entityId, key, layer);
    }

    /**
     * 특정 셀 키에서 엔티티를 직접 제거합니다.
     */
    removeFromCell(entityId, key, layer = 0) {
        const targetCells = this._getTargetCells(layer);
        const cell = targetCells.get(key);

        if (cell) {
            const index = cell.indexOf(entityId);
            if (index !== -1) {
                // 🚀 [Expert Optimization] 순서가 중요하지 않다면 splice(index, 1) 대신 
                // 마지막 요소를 현재 위치에 덮어쓰고 pop() 하는 것이 O(1)로 훨씬 빠릅니다.
                const lastId = cell.pop();
                if (index < cell.length) {
                    cell[index] = lastId;
                }
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
        
        // 🚀 [Task 92] 가비지 생성을 막기 위한 쿼리 버퍼 풀링 적용
        this.queryBufferIndex = (this.queryBufferIndex + 1) % 10;
        const foundIds = this.queryBuffers[this.queryBufferIndex];
        foundIds.length = 0; // 초기화

        for (let oy = -cellRadius; oy <= cellRadius; oy++) {
            const cy = cellY + oy;
            for (let ox = -cellRadius; ox <= cellRadius; ox++) {
                const cx = cellX + ox;
                const key = ((cy + 1000) << 16) | (cx + 1000);
                
                this._pushCellToBuffer(this.staticCells.get(key), foundIds);
                this._pushCellToBuffer(this.obstacleCells.get(key), foundIds);
                this._pushCellToBuffer(this.dynamicCells.get(key), foundIds);
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
            for (let ox = -cellRadius; ox <= cellRadius; ox++) {
                const cx = cellX + ox;
                const key = ((cy + 1000) << 16) | (cx + 1000);
                
                this._eachInCell(this.staticCells.get(key), callback);
                this._eachInCell(this.obstacleCells.get(key), callback);
                this._eachInCell(this.dynamicCells.get(key), callback);
            }
        }
    }

    /**
     * [Expert Optimization] 나선형(Spiral) 탐색을 수행합니다.
     * 중심점에서 가까운 격자부터 순차적으로 탐색하며, 콜백이 true를 반환하면 즉시 중단합니다.
     * 근접 탐색(Find Nearest) 시 불필요한 외곽 격자 탐색을 방지하여 성능을 대폭 향상시킵니다.
     */
    eachInSpiral(x, y, radius, callback, layer = -1) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        let maxCellRadius = Math.ceil(radius / this.cellSize);
        if (isNaN(maxCellRadius)) maxCellRadius = 1;
        maxCellRadius = Math.min(maxCellRadius, 25); // 최대 탐색 범위 제한

        for (let k = 0; k <= maxCellRadius; k++) {
            if (k === 0) {
                if (this._processCell(cellX, cellY, callback, layer)) return;
            } else {
                // Top & Bottom edges
                for (let ox = -k; ox <= k; ox++) {
                    if (this._processCell(cellX + ox, cellY - k, callback, layer)) return;
                    if (this._processCell(cellX + ox, cellY + k, callback, layer)) return;
                }
                // Left & Right edges (excluding corners already covered)
                for (let oy = -k + 1; oy <= k - 1; oy++) {
                    if (this._processCell(cellX - k, cellY + oy, callback, layer)) return;
                    if (this._processCell(cellX + k, cellY + oy, callback, layer)) return;
                }
            }
        }
    }

    /**
     * 격자 내의 엔티티들을 콜백으로 전달합니다.
     * @private
     */
    _processCell(cx, cy, callback, layer = -1) {
        const key = ((cy + 1000) << 16) | (cx + 1000);
        
        if (layer === -1) {
            if (this._eachInCellBreakable(this.staticCells.get(key), callback)) return true;
            if (this._eachInCellBreakable(this.obstacleCells.get(key), callback)) return true;
            if (this._eachInCellBreakable(this.dynamicCells.get(key), callback)) return true;
        } else {
            const cells = this._getTargetCells(layer);
            if (this._eachInCellBreakable(cells.get(key), callback)) return true;
        }
        return false;
    }

    /**
     * [Expert Optimization] 장애물 엔티티(건물 등)만 조회합니다. (길찾기 전용)
     */
    queryObstaclesRect(x, y, width, height) {
        const startX = Math.floor(x / this.cellSize);
        const startY = Math.floor(y / this.cellSize);
        const endX = Math.floor((x + width) / this.cellSize);
        const endY = Math.floor((y + height) / this.cellSize);
        
        const foundIds = [];
        for (let cy = startY; cy <= endY; cy++) {
            for (let cx = startX; cx <= endX; cx++) {
                const key = ((cy + 1000) << 16) | (cx + 1000);
                this._pushCellToBuffer(this.obstacleCells.get(key), foundIds);
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
                const key = ((cy + 1000) << 16) | (cx + 1000);
                
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
            for (let cx = startX; cx <= endX; cx++) {
                const key = ((cy + 1000) << 16) | (cx + 1000);
                
                this._eachInCell(this.staticCells.get(key), callback);
                this._eachInCell(this.obstacleCells.get(key), callback);
                this._eachInCell(this.dynamicCells.get(key), callback);
            }
        }
    }

    _getTargetCells(layer) {
        if (layer === true) return this.staticCells;
        if (layer === false) return this.dynamicCells;

        switch (layer) {
            case 0: return this.dynamicCells;
            case 1: return this.staticCells;
            case 2: return this.obstacleCells;
            default: return this.dynamicCells;
        }
    }

    _pushCellToBuffer(cell, buffer) {
        if (cell) {
            for (let i = 0; i < cell.length; i++) {
                buffer.push(cell[i]);
            }
        }
    }

    _eachInCell(cell, callback) {
        if (cell) {
            for (let i = 0; i < cell.length; i++) {
                callback(cell[i]);
            }
        }
    }

    _eachInCellBreakable(cell, callback) {
        if (cell) {
            for (let i = 0; i < cell.length; i++) {
                if (callback(cell[i])) return true;
            }
        }
        return false;
    }
}
