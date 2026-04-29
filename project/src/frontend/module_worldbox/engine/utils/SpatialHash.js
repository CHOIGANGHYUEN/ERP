export default class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    _hash(x, y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    insert(entityId, x, y) {
        const key = this._hash(x, y);
        if (!this.cells.has(key)) {
            this.cells.set(key, new Set());
        }
        this.cells.get(key).add(entityId);
    }

    clear() {
        this.cells.clear();
    }

    query(x, y, radius) {
        const result = [];
        const startX = Math.floor((x - radius) / this.cellSize);
        const endX = Math.floor((x + radius) / this.cellSize);
        const startY = Math.floor((y - radius) / this.cellSize);
        const endY = Math.floor((y + radius) / this.cellSize);

        for (let cx = startX; cx <= endX; cx++) {
            for (let cy = startY; cy <= endY; cy++) {
                const key = `${cx},${cy}`;
                const cell = this.cells.get(key);
                if (cell) {
                    for (const id of cell) {
                        result.push(id);
                    }
                }
            }
        }
        return result;
    }
}
