import MinHeap from './MinHeap.js';

/**
 * 🧠 AStarSearch
 * 순수 A* 기반 그리드 탐색 알고리즘을 담당합니다.
 * Pathfinder.js에서 SRP에 따라 분리되었습니다.
 */
export default class AStarSearch {
    /**
     * A* 기반 그리드 경로 탐색
     */
    static findPath(sx, sy, ex, ey, engine, gridSize = 10, bypassThrottle = false, pathfinderFacade = null) {
        if (!engine) return [];
        
        // 🚀 [Optimization] 프레임당 연산 횟수 제어 (Facade를 통해 상태 관리)
        if (pathfinderFacade && !bypassThrottle) {
            const now = performance.now();
            if (now - pathfinderFacade.lastFrameTime > 16) {
                pathfinderFacade.pathCountThisFrame = 0;
                pathfinderFacade.lastFrameTime = now;
            }
            if (pathfinderFacade.pathCountThisFrame >= pathfinderFacade.MAX_PATHS_PER_FRAME) {
                return null;
            }
            pathfinderFacade.pathCountThisFrame++;
        }

        const em = engine.entityManager;
        const spatialHash = engine.spatialHash;

        const dx = ex - sx;
        const dy = ey - sy;

        if (dx * dx + dy * dy < gridSize * gridSize) {
            return [{ x: ex, y: ey }];
        }

        const startX = Math.floor(sx / gridSize);
        const startY = Math.floor(sy / gridSize);
        const endX = Math.floor(ex / gridSize);
        const endY = Math.floor(ey / gridSize);

        const getKey = (x, y) => (x << 16) | y;
        let startKey = getKey(startX, startY);
        const endKey = getKey(endX, endY);

        const obstacles = new Set();
        const nearbyIds = spatialHash ? spatialHash.queryObstaclesRect(Math.min(sx, ex) - 50, Math.min(sy, ey) - 50, Math.abs(ex - sx) + 100, Math.abs(ey - sy) + 100) : em.buildingIds;

        for (const bId of nearbyIds) {
            const b = em.entities.get(bId);
            if (!b || !b.components.has('Building')) continue;
            const structure = b.components.get('Structure');
            if (structure && structure.isBlueprint) continue;
            if (b.components.has('Road') || ['road', 'dirt_road', 'stone_road'].includes(structure?.type)) continue;

            const t = b.components.get('Transform');
            const v = b.components.get('Visual');
            const door = b.components.get('Door');

            if (door && door.isOpen) continue;

            if (t && v) {
                const r = (v.size || 40) * 0.45;
                const minX = Math.floor((t.x - r) / gridSize);
                const maxX = Math.floor((t.x + r) / gridSize);
                const minY = Math.floor((t.y - r) / gridSize);
                const maxY = Math.floor((t.y + r) / gridSize);

                const isStartInside = startX >= minX && startX <= maxX && startY >= minY && startY <= maxY;
                const isEndInside = endX >= minX && endX <= maxX && endY >= minY && endY <= maxY;
                
                if (isStartInside || isEndInside) continue;

                for (let x = minX; x <= maxX; x++) {
                    for (let y = minY; y <= maxY; y++) {
                        obstacles.add(getKey(x, y));
                    }
                }
            }
        }

        const gScore = new Map();
        gScore.set(startKey, 0);
        const fScore = new Map();
        const h = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
        fScore.set(startKey, h(startX, startY, endX, endY));

        const openSet = new MinHeap((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
        openSet.push(startKey);
        const openSetTracker = new Set([startKey]);
        const closedSet = new Set();
        const cameFrom = new Map();

        let attempts = 0;
        const MAX_ATTEMPTS = 2000;
        const terrainGen = engine.terrainGen;
        
        let closestKey = startKey;
        let minH = h(startX, startY, endX, endY);

        while (openSet.size() > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;
            const currentKey = openSet.pop();
            const currentX = (currentKey >> 16) & 0xFFFF;
            const currentY = currentKey & 0xFFFF;

            if (currentX === endX && currentY === endY) {
                return this.reconstructPath(cameFrom, currentKey, gridSize, ex, ey, sx, sy, pathfinderFacade);
            }

            const currentH = h(currentX, currentY, endX, endY);
            if (currentH < minH) {
                minH = currentH;
                closestKey = currentKey;
            }

            openSetTracker.delete(currentKey);
            closedSet.add(currentKey);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = currentX + dx;
                    const ny = currentY + dy;
                    const neighborKey = getKey(nx, ny);

                    if (closedSet.has(neighborKey)) continue;
                    if (obstacles.has(neighborKey) && neighborKey !== endKey) continue;

                    const realX = nx * gridSize + gridSize / 2;
                    const realY = ny * gridSize + gridSize / 2;
                    if (terrainGen && !terrainGen.isNavigable(realX, realY) && neighborKey !== endKey && neighborKey !== startKey) continue;

                    if (terrainGen && typeof terrainGen.getBiomeAt === 'function') {
                        const biomeId = terrainGen.getBiomeAt(Math.floor(realX), Math.floor(realY));
                        if (biomeId !== undefined && biomeId < 4 && neighborKey !== endKey && neighborKey !== startKey) continue;
                    }

                    const baseWeight = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
                    const movementCost = pathfinderFacade?.getMovementCost?.(realX, realY, engine) || 1;
                    const tentativeG = (gScore.get(currentKey) || 0) + (baseWeight * movementCost);

                    if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                        cameFrom.set(neighborKey, currentKey);
                        gScore.set(neighborKey, tentativeG);
                        fScore.set(neighborKey, tentativeG + h(nx, ny, endX, endY));
                        if (!openSetTracker.has(neighborKey)) {
                            openSet.push(neighborKey);
                            openSetTracker.add(neighborKey);
                        }
                    }
                }
            }
        }

        if (attempts >= MAX_ATTEMPTS) {
            console.warn(`[AStar] Limit reached (${MAX_ATTEMPTS}) for (${ex.toFixed(0)}, ${ey.toFixed(0)}).`);
            return this.reconstructPath(cameFrom, closestKey, gridSize, ex, ey, sx, sy, pathfinderFacade);
        }
        return [];
    }

    /**
     * A* 기반 구역(Zone) 목적지 경로 탐색
     */
    static findPathToZone(sx, sy, zoneBounds, engine, gridSize = 10, pathfinderFacade = null) {
        if (!engine) return [];
        const terrainGen = engine.terrainGen;
        
        if (sx >= zoneBounds.minX && sx <= zoneBounds.maxX && sy >= zoneBounds.minY && sy <= zoneBounds.maxY) {
            return [{ x: sx, y: sy }];
        }

        const cx = zoneBounds.minX + zoneBounds.width / 2;
        const cy = zoneBounds.minY + zoneBounds.height / 2;
        const startX = Math.floor(sx / gridSize);
        const startY = Math.floor(sy / gridSize);

        const getKey = (x, y) => (x << 16) | y;
        let startKey = getKey(startX, startY);

        const gScore = new Map();
        gScore.set(startKey, 0);
        const fScore = new Map();
        const h = (ax, ay) => Math.abs(ax - Math.floor(cx / gridSize)) + Math.abs(ay - Math.floor(cy / gridSize));
        fScore.set(startKey, h(startX, startY));

        const openSet = new MinHeap((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
        openSet.push(startKey);
        const openSetTracker = new Set([startKey]);
        const closedSet = new Set();
        const cameFrom = new Map();

        let attempts = 0;
        const MAX_ATTEMPTS = 5000;

        while (openSet.size() > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;
            const currentKey = openSet.pop();
            const currentX = (currentKey >> 16) & 0xFFFF;
            const currentY = currentKey & 0xFFFF;

            const realX = currentX * gridSize + gridSize / 2;
            const realY = currentY * gridSize + gridSize / 2;

            if (realX >= zoneBounds.minX && realX <= zoneBounds.maxX && realY >= zoneBounds.minY && realY <= zoneBounds.maxY) {
                const offsetX = (Math.random() - 0.5) * gridSize;
                const offsetY = (Math.random() - 0.5) * gridSize;
                return this.reconstructPath(cameFrom, currentKey, gridSize, realX + offsetX, realY + offsetY, sx, sy, pathfinderFacade);
            }

            openSetTracker.delete(currentKey);
            closedSet.add(currentKey);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = currentX + dx;
                    const ny = currentY + dy;
                    const neighborKey = getKey(nx, ny);

                    if (closedSet.has(neighborKey)) continue;

                    const nRealX = nx * gridSize + gridSize / 2;
                    const nRealY = ny * gridSize + gridSize / 2;
                    
                    if (terrainGen && !terrainGen.isNavigable(nRealX, nRealY)) continue;
                    
                    if (terrainGen && typeof terrainGen.getBiomeAt === 'function') {
                        const biomeId = terrainGen.getBiomeAt(Math.floor(nRealX), Math.floor(nRealY));
                        if (biomeId !== undefined && biomeId < 4) continue;
                    }

                    const baseWeight = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
                    const movementCost = pathfinderFacade?.getMovementCost?.(nRealX, nRealY, engine) || 1;
                    const tentativeG = (gScore.get(currentKey) || 0) + (baseWeight * movementCost);

                    if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                        cameFrom.set(neighborKey, currentKey);
                        gScore.set(neighborKey, tentativeG);
                        fScore.set(neighborKey, tentativeG + h(nx, ny));
                        if (!openSetTracker.has(neighborKey)) {
                            openSet.push(neighborKey);
                            openSetTracker.add(neighborKey);
                        }
                    }
                }
            }
        }
        return [];
    }

    static reconstructPath(cameFrom, currentKey, gridSize, ex, ey, sx, sy, pathfinderFacade = null) {
        const path = pathfinderFacade ? pathfinderFacade.pathArrayPool.get() : [];
        let curr = currentKey;
        while (cameFrom.has(curr)) {
            const cx = (curr >> 16) & 0xFFFF;
            const cy = curr & 0xFFFF;
            
            const pt = pathfinderFacade ? pathfinderFacade.pathPointPool.get() : { x: 0, y: 0 };
            pt.x = cx * gridSize + gridSize / 2;
            pt.y = cy * gridSize + gridSize / 2;
            path.unshift(pt);
            
            curr = cameFrom.get(curr);
        }
        
        const startPt = pathfinderFacade ? pathfinderFacade.pathPointPool.get() : { x: 0, y: 0 };
        startPt.x = sx;
        startPt.y = sy;
        path.unshift(startPt);

        const endPt = pathfinderFacade ? pathfinderFacade.pathPointPool.get() : { x: 0, y: 0 };
        endPt.x = ex;
        endPt.y = ey;
        path.push(endPt);
        
        return path;
    }

    static isLineBlocked(x1, y1, x2, y2, engine) {
        if (!engine || !engine.terrainGen) return false;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        const steps = Math.ceil(dist / 10);
        
        const em = engine.entityManager;
        const spatialHash = engine.spatialHash;

        for (let i = 1; i <= steps; i++) {
            const tx = x1 + (dx * i / steps);
            const ty = y1 + (dy * i / steps);

            if (!engine.terrainGen.isNavigable(tx, ty)) return true;

            if (typeof engine.terrainGen.getBiomeAt === 'function') {
                const biomeId = engine.terrainGen.getBiomeAt(Math.floor(tx), Math.floor(ty));
                if (biomeId !== undefined && biomeId < 4) return true;
            }

            if (spatialHash) {
                const nearby = spatialHash.query(tx, ty, 15);
                for (const id of nearby) {
                    const ent = em.entities.get(id);
                    if (ent && ent.components.has('Building')) {
                        const struct = ent.components.get('Structure');
                        if (struct && struct.isBlueprint) continue;
                        if (ent.components.has('Road') || ['road', 'dirt_road', 'stone_road'].includes(struct?.type)) continue;

                        const bPos = ent.components.get('Transform');
                        const bVis = ent.components.get('Visual');
                        const door = ent.components.get('Door');

                        if (door && door.isOpen) continue;

                        if (bPos && bVis) {
                            const r = (bVis.size || 40) * 0.4;
                            const distToB = Math.hypot(tx - bPos.x, ty - bPos.y);
                            if (distToB < r) return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}
