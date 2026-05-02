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
    /**
     * 🧠 A* 기반 그리드 경로 탐색
     */
    static findPath(sx, sy, ex, ey, engine, gridSize = 10) {
        if (!engine) return [];
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
            if (t && v) {
                const r = (v.size || 40) * 0.45;
                const minX = Math.floor((t.x - r) / gridSize);
                const maxX = Math.floor((t.x + r) / gridSize);
                const minY = Math.floor((t.y - r) / gridSize);
                const maxY = Math.floor((t.y + r) / gridSize);

                // 💡 [4단계 대응] 목적지(endX, endY)가 이 건물 영역에 포함된다면, 해당 건물은 장애물로 등록하지 않음 (Deposit 반납 접근 허용)
                if (endX >= minX && endX <= maxX && endY >= minY && endY <= maxY) continue;

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
        const MAX_ATTEMPTS = 10000;
        const terrainGen = engine.terrainGen;

        while (openSet.size() > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;
            const currentKey = openSet.pop();
            const currentX = (currentKey >> 16) & 0xFFFF;
            const currentY = currentKey & 0xFFFF;

            if (currentX === endX && currentY === endY) {
                return this._reconstructPath(cameFrom, currentKey, gridSize, ex, ey);
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
                    if (terrainGen && !terrainGen.isNavigable(realX, realY) && neighborKey !== endKey) continue;

                    // 🌊 [바다 건너기 방지] isLand 대신 엄격하게 물(Biome 0~3)만 차단합니다.
                    // 모래사장(4) 등은 정상 통과하도록 허용하여 해안가 탐색 마비(프리징)를 방지합니다.
                    if (terrainGen && typeof terrainGen.getBiomeAt === 'function') {
                        const biomeId = terrainGen.getBiomeAt(Math.floor(realX), Math.floor(realY));
                        if (biomeId !== undefined && biomeId < 4 && neighborKey !== endKey) continue;
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
        return [];
    }

    /**
     * 🧠 A* 기반 구역(Zone) 목적지 경로 탐색
     * 특정 지점이 아닌 zoneBounds 내부의 임의의 도달 가능한 타일을 목적지로 합니다.
     */
    static findPathToZone(sx, sy, zoneBounds, engine, gridSize = 10) {
        if (!engine) return [];
        const terrainGen = engine.terrainGen;
        
        // 이미 구역 내부라면
        if (sx >= zoneBounds.minX && sx <= zoneBounds.maxX && sy >= zoneBounds.minY && sy <= zoneBounds.maxY) {
            return [{ x: sx, y: sy }];
        }

        // 구역의 중심점 계산
        const cx = zoneBounds.minX + zoneBounds.width / 2;
        const cy = zoneBounds.minY + zoneBounds.height / 2;
        
        const startX = Math.floor(sx / gridSize);
        const startY = Math.floor(sy / gridSize);

        const getKey = (x, y) => (x << 16) | y;
        let startKey = getKey(startX, startY);

        const gScore = new Map();
        gScore.set(startKey, 0);
        const fScore = new Map();
        
        // 휴리스틱: 구역 중심점까지의 거리
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

            // 목적지 도달 조건: 현재 타일이 zoneBounds 내부에 포함되는지 확인
            if (realX >= zoneBounds.minX && realX <= zoneBounds.maxX && realY >= zoneBounds.minY && realY <= zoneBounds.maxY) {
                // 병목을 막기 위해 목적지 타일에 Random Offset 부여
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
        path.push({ x: ex, y: ey }); // 정확한 목적지 추가
        return path;
    }

    static followPath(transform, state, targetPos, speed, engine, targetRadius = 8) {
        const now = Date.now();
        const needsRecalc = !state.path || state.pathTargetId !== state.targetId || (now - (state.lastPathCalcTime || 0) > 2000);

        if (needsRecalc) {
            state.path = this.findPath(transform.x, transform.y, targetPos.x, targetPos.y, engine);
            state.pathTargetId = state.targetId;
            state.pathIndex = 0;
            state.lastPathCalcTime = now;
        }

        if (state.path) {
            // 🛑 탐색 실패 (길이 없거나 바다 건너편)
            if (state.path.length === 0) {
                transform.vx = 0;
                transform.vy = 0;
                return -1; // 도달 불가 상태 반환
            }

            // 최종 목적지 거리 확인 (도착 판정)
            const dxEnd = targetPos.x - transform.x;
            const dyEnd = targetPos.y - transform.y;
            const distSqEnd = dxEnd * dxEnd + dyEnd * dyEnd;
            const radiusSq = targetRadius * targetRadius;

            if (distSqEnd <= radiusSq) {
                transform.vx = 0;
                transform.vy = 0;
                state.path = null;
                return true;
            }

            if (state.pathIndex < state.path.length) {
                const wp = state.path[state.pathIndex];
                const dx = wp.x - transform.x;
                const dy = wp.y - transform.y;
                const distSq = dx * dx + dy * dy;

                // 웨이포인트 통과 판정 (기본 8px)
                if (distSq < 64) {
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
        for (let i = 1; i < steps; i++) {
            const tx = x1 + (dx * i / steps);
            const ty = y1 + (dy * i / steps);
            if (!engine.terrainGen.isNavigable(tx, ty)) return true;

            // 직선 경로상에 바다가 포함되어 있는지도 엄격하게 물(Biome 0~3)만 체크
            if (typeof engine.terrainGen.getBiomeAt === 'function') {
                const biomeId = engine.terrainGen.getBiomeAt(Math.floor(tx), Math.floor(ty));
                if (biomeId !== undefined && biomeId < 4) return true;
            }
        }
        return false;
    }
}
