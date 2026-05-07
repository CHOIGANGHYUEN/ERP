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

/**
 * 🗺️ HPACluster (Hierarchical Cluster)
 * HPA* 알고리즘을 위한 공간 분할 단위입니다. (보통 100x100 타일)
 */
export class HPACluster {
    constructor(id, x, y, width, height) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        
        // 🚪 인접 구역과의 연결 통로 (Transition Nodes)
        // key: neighborClusterId, value: Array of transition objects { pos1, pos2, weight }
        this.transitions = new Map();
        
        // 📊 구역 내 통로 간의 추상 그래프 (Intra-cluster edges)
        // key: nodeKey, value: Map(otherNodeKey, weight)
        this.abstractEdges = new Map();
        
        this.isDirty = true;
    }

    getBounds() {
        return {
            minX: this.x,
            minY: this.y,
            maxX: this.x + this.width,
            maxY: this.y + this.height
        };
    }
}
