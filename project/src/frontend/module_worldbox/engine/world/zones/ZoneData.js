export default class ZoneData {
    constructor(zoneId, zoneType, x, y, width, height) {
        this.id = zoneId;
        this.type = zoneType; // e.g., 'residential', 'lumber', 'farm'
        
        // Rect Bounds
        this.bounds = {
            minX: x,
            minY: y,
            maxX: x + width,
            maxY: y + height,
            width: width,
            height: height
        };
        
        // 할당된 작업자 목록 (Entity ID)
        this.assignedWorkers = new Set();

        // 🗺️ [Tile-Based Territory] 구역에 할당된 타일 목록
        this.territory = new Set(); // Set of "tx,ty"
    }

    contains(x, y) {
        const tx = Math.floor(x / 16);
        const ty = Math.floor(y / 16);
        const key = `${tx},${ty}`;

        if (this.territory.size > 0) {
            return this.territory.has(key);
        }

        return x >= this.bounds.minX && x <= this.bounds.maxX &&
               y >= this.bounds.minY && y <= this.bounds.maxY;
    }

    addWorker(entityId) {
        this.assignedWorkers.add(entityId);
    }

    removeWorker(entityId) {
        this.assignedWorkers.delete(entityId);
    }
}
