import ObjectPool from '../ObjectPool.js';

/**
 * ⚙️ PathRequestQueue
 * 길찾기 요청 대기열 관리, 캐싱, 메모리 풀링을 담당합니다.
 * Pathfinder.js에서 SRP에 따라 분리되었습니다.
 */
export default class PathRequestQueue {
    constructor(pathfinderFacade) {
        this.pf = pathfinderFacade;
        this.requestQueue = [];
        this.cache = new Map();

        // 🚀 [Expert Optimization] Object Pools
        this.pointPool = new ObjectPool(
            () => ({ x: 0, y: 0 }),
            (p) => { p.x = 0; p.y = 0; },
            1000
        );
        this.arrayPool = new ObjectPool(
            () => [],
            (a) => { a.length = 0; },
            100
        );
    }

    requestPath(entityId, state, sx, sy, ex, ey, engine, callback) {
        this.requestQueue.push({ entityId, state, sx, sy, ex, ey, engine, callback });
    }

    processQueue() {
        if (this.requestQueue.length === 0) return;

        const MAX_PER_FRAME = 3;
        let processed = 0;

        while (this.requestQueue.length > 0 && processed < MAX_PER_FRAME) {
            const request = this.requestQueue.shift();
            const { entityId, state, sx, sy, ex, ey, engine, callback } = request;
            
            if (state.mode === 'die') continue;

            const path = this.pf.findHierarchicalPath(sx, sy, ex, ey, engine);
            if (callback) callback(path);
            processed++;
        }
    }

    invalidateCache() {
        this.cache.clear();
    }

    releasePath(path) {
        if (!path || !Array.isArray(path)) return;
        
        for (let i = 0; i < path.length; i++) {
            const pt = path[i];
            if (pt && typeof pt === 'object') {
                this.pointPool.release(pt);
            }
        }
        this.arrayPool.release(path);
    }
}
