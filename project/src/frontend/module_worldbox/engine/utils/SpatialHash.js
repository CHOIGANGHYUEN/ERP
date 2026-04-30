/**
 * 🛰️ SpatialHash (공간 해시맵)
 * 월드 공간을 격자(Cell) 단위로 나누어 엔티티의 위치를 저장함으로써
 * 인접한 엔티티를 빠르게 탐색할 수 있게 해주는 최적화 클래스입니다.
 */
export default class SpatialHash {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.cells = {}; // 📦 격자별 엔티티 ID 저장소
    }

    /**
     * 모든 격자 데이터를 초기화합니다.
     * 매 프레임 업데이트 시 호출되어 최신 위치를 반영할 준비를 합니다.
     */
    clear() {
        this.cells = {};
    }

    /**
     * 엔티티를 해당 좌표의 격자에 등록합니다.
     */
    insert(entityId, x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const key = `${cellX},${cellY}`;

        if (!this.cells[key]) {
            this.cells[key] = [];
        }
        this.cells[key].push(entityId);
    }

    /**
     * 특정 좌표 주변의 엔티티 ID 목록을 반환합니다.
     * @param {number} x 탐색 중심 X
     * @param {number} y 탐색 중심 Y
     * @param {number} radius 탐색 반경 (px)
     */
    query(x, y, radius = 100) {
        const cellRadius = Math.ceil(radius / this.cellSize);
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        let foundIds = [];

        // 반경에 따른 격자 범위 탐색
        for (let ox = -cellRadius; ox <= cellRadius; ox++) {
            for (let oy = -cellRadius; oy <= cellRadius; oy++) {
                const key = `${cellX + ox},${cellY + oy}`;
                if (this.cells[key]) {
                    foundIds = foundIds.concat(this.cells[key]);
                }
            }
        }

        return foundIds;
    }

}
