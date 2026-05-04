/**
 * 🚀 MinHeap for A* Open List
 */
class MinHeap {
    constructor(compare) {
        this.nodes = [];
        this.compare = compare;
    }
    push(node) {
        this.nodes.push(node);
        this.bubbleUp(this.nodes.length - 1);
    }
    pop() {
        if (this.size() === 0) return null;
        if (this.size() === 1) return this.nodes.pop();
        const top = this.nodes[0];
        this.nodes[0] = this.nodes.pop();
        this.bubbleDown(0);
        return top;
    }
    size() { return this.nodes.length; }
    bubbleUp(index) {
        while (index > 0) {
            const parent = (index - 1) >> 1;
            if (this.compare(this.nodes[index], this.nodes[parent]) < 0) {
                [this.nodes[index], this.nodes[parent]] = [this.nodes[parent], this.nodes[index]];
                index = parent;
            } else break;
        }
    }
    bubbleDown(index) {
        const last = this.nodes.length - 1;
        while (true) {
            let left = (index << 1) + 1;
            let right = (index << 1) + 2;
            let smallest = index;
            if (left <= last && this.compare(this.nodes[left], this.nodes[smallest]) < 0) smallest = left;
            if (right <= last && this.compare(this.nodes[right], this.nodes[smallest]) < 0) smallest = right;
            if (smallest !== index) {
                [this.nodes[index], this.nodes[smallest]] = [this.nodes[smallest], this.nodes[index]];
                index = smallest;
            } else break;
        }
    }
}

export default class Pathfinder {
    static pathCountThisFrame = 0;
    static lastFrameTime = 0;
    static MAX_PATHS_PER_FRAME = 10; // 🚀 프레임당 A* 연산 최대 10회로 상향

    /**
     * 🧠 A* 기반 그리드 경로 탐색
     */
    static findPath(sx, sy, ex, ey, engine, gridSize = 10) {
        if (!engine) return [];
        
        // 🚀 [Optimization] 프레임당 연산 횟수 제어
        const now = performance.now();
        if (now - this.lastFrameTime > 16) {
            this.pathCountThisFrame = 0;
            this.lastFrameTime = now;
        }
        
        if (this.pathCountThisFrame >= this.MAX_PATHS_PER_FRAME) {
            return null; // 이번 프레임은 건너뛰고 다음 프레임에 재시도 유도
        }
        this.pathCountThisFrame++;
        const em = engine.entityManager;
        const spatialHash = engine.spatialHash;

        const dx = ex - sx;
        const dy = ey - sy;

        // 매우 가까우면 바로 직선 반환
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
        const nearbyIds = spatialHash ? spatialHash.queryRect(Math.min(sx, ex) - 50, Math.min(sy, ey) - 50, Math.abs(ex - sx) + 100, Math.abs(ey - sy) + 100) : em.buildingIds;

        for (const bId of nearbyIds) {
            const b = em.entities.get(bId);
            if (!b || !b.components.has('Building')) continue;
            const structure = b.components.get('Structure');
            if (structure && structure.isBlueprint) continue;

            const t = b.components.get('Transform');
            const v = b.components.get('Visual');
            const door = b.components.get('Door');

            // 🚪 [Dynamic Pathfinding] 열린 문은 장애물에서 제외
            if (door && door.isOpen) continue;

            if (t && v) {
                const r = (v.size || 40) * 0.45;
                const minX = Math.floor((t.x - r) / gridSize);
                const maxX = Math.floor((t.x + r) / gridSize);
                const minY = Math.floor((t.y - r) / gridSize);
                const maxY = Math.floor((t.y + r) / gridSize);

                // 💡 [Expert Fix] 시작점(startX, startY) 또는 목적지(endX, endY)가 이 건물 영역에 포함된다면,
                // 해당 건물은 장애물로 등록하지 않음 (건물 내부에서 끼임 방지 및 접근 허용)
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
        const MAX_ATTEMPTS = 10000; // 🚀 [Stability] 멈춤 방지를 위해 탐색 한도 제한
        const terrainGen = engine.terrainGen;
        
        let closestKey = startKey;
        let minH = h(startX, startY, endX, endY);

        while (openSet.size() > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;
            const currentKey = openSet.pop();
            const currentX = (currentKey >> 16) & 0xFFFF;
            const currentY = currentKey & 0xFFFF;

            if (currentX === endX && currentY === endY) {
                return this._reconstructPath(cameFrom, currentKey, gridSize, ex, ey);
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

                    // 🌊 [바다 건너기 방지] isLand 대신 엄격하게 물(Biome 0~3)만 차단합니다.
                    if (terrainGen && typeof terrainGen.getBiomeAt === 'function') {
                        const biomeId = terrainGen.getBiomeAt(Math.floor(realX), Math.floor(realY));
                        if (biomeId !== undefined && biomeId < 4 && neighborKey !== endKey && neighborKey !== startKey) continue;
                    }

                    const baseWeight = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
                    const tentativeG = (gScore.get(currentKey) || 0) + baseWeight;

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
            console.warn(`[Pathfinder] Limit reached (${MAX_ATTEMPTS}) for (${ex.toFixed(0)}, ${ey.toFixed(0)}). Moving to closest node.`);
            return this._reconstructPath(cameFrom, closestKey, gridSize, ex, ey);
        }
        return [];
    }

    /**
     * 🧠 A* 기반 구역(Zone) 목적지 경로 탐색
     */
    static findPathToZone(sx, sy, zoneBounds, engine, gridSize = 10) {
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
                return this._reconstructPath(cameFrom, currentKey, gridSize, realX + offsetX, realY + offsetY);
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
                    const tentativeG = (gScore.get(currentKey) || 0) + baseWeight;

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

    static _reconstructPath(cameFrom, currentKey, gridSize, ex, ey) {
        const path = [];
        let curr = currentKey;
        while (cameFrom.has(curr)) {
            const cx = (curr >> 16) & 0xFFFF;
            const cy = curr & 0xFFFF;
            path.unshift({ x: cx * gridSize + gridSize / 2, y: cy * gridSize + gridSize / 2 });
            curr = cameFrom.get(curr);
        }
        path.push({ x: ex, y: ey });
        return path;
    }

    static followPath(transform, state, targetPos, speed, engine, targetRadius = 12, recalcInterval = 2000, targetIdOverride = null) {
        const now = Date.now();
        const currentTargetId = targetIdOverride || state.targetId;
        
        let needsRecalc = !state.path || 
                          state.pathTargetId !== currentTargetId || 
                          (now - (state.lastPathCalcTime || 0) > recalcInterval);

        if (!needsRecalc && state.path && state.pathIndex < state.path.length) {
            const nextWp = state.path[state.pathIndex];
            state.blockCheckTimer = (state.blockCheckTimer || 0) + 1;
            if (state.blockCheckTimer % 30 === 0) { 
                if (this.isLineBlocked(transform.x, transform.y, nextWp.x, nextWp.y, engine)) {
                    needsRecalc = true;
                }
            }
        }

        if (needsRecalc) {
            const newPath = this.findPath(transform.x, transform.y, targetPos.x, targetPos.y, engine);
            if (newPath !== null) {
                state.path = newPath;
                state.pathTargetId = currentTargetId;
                state.pathIndex = 0;
                state.lastPathCalcTime = now;
            } else if (!state.path) {
                transform.vx = 0;
                transform.vy = 0;
            }
        }

        if (state.path) {
            if (state.path.length === 0) {
                transform.vx = 0;
                transform.vy = 0;
                return -1;
            }

            const dxEnd = targetPos.x - transform.x;
            const dyEnd = targetPos.y - transform.y;
            if (dxEnd * dxEnd + dyEnd * dyEnd <= targetRadius * targetRadius) {
                transform.vx = 0;
                transform.vy = 0;
                state.path = null;
                return true;
            }

            if (state.pathIndex < state.path.length) {
                const wp = state.path[state.pathIndex];
                const dx = wp.x - transform.x;
                const dy = wp.y - transform.y;

                if (dx * dx + dy * dy < 144) {
                    state.pathIndex++;
                }

                if (state.pathIndex < state.path.length) {
                    const targetWp = state.path[state.pathIndex];
                    const nx = targetWp.x - transform.x;
                    const ny = targetWp.y - transform.y;
                    const d = Math.hypot(nx, ny);
                    if (d > 0.1) {
                        transform.vx = (nx / d) * speed;
                        transform.vy = (ny / d) * speed;
                    }
                    return false;
                }
            }
        }
        return false;
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
