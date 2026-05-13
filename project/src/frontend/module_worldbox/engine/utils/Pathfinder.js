import { HPACluster } from '../world/zones/ZoneData.js';
import ObjectPool from './ObjectPool.js';

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
    static MAX_PATHS_PER_FRAME = 15; // 🚀 10 -> 15로 약간 상향

    // 🗺️ [HPA*] 계층적 그래프 데이터
    static clusters = new Map(); // key: "cx,cy"
    static clusterSize = 100;    // 100x100 tiles per cluster
    static abstractNodes = new Map(); // key: "x,y", value: { id, neighbors: Map }
    static dirtyClusters = new Set(); // 🚀 [Step 23] 재계산이 필요한 구역들
    static pathRequestQueue = [];     // 🚀 [Step 27] 길찾기 요청 대기열
    static pathCache = new Map();     // 🚀 [Step 28] 경로 캐시 (Memoization)
    static _isRebuildPending = false; // 🚀 지연된 그래프 재계산 플래그
    static _isWorkerRebuilding = false; // 🚀 워커 재계산 중 플래그

    // 🚀 [Expert Optimization] Object Pools for Pathfinding
    static pathPointPool = new ObjectPool(
        () => ({ x: 0, y: 0 }),
        (p) => { p.x = 0; p.y = 0; },
        1000
    );
    static pathArrayPool = new ObjectPool(
        () => [],
        (a) => { a.length = 0; },
        100
    );

    /**
     * 🧠 A* 기반 그리드 경로 탐색
     */
    static findPath(sx, sy, ex, ey, engine, gridSize = 10, bypassThrottle = false) {
        if (!engine) return [];
        
        // 🚀 [Optimization] 프레임당 연산 횟수 제어
        const now = performance.now();
        if (now - this.lastFrameTime > 16) {
            this.pathCountThisFrame = 0;
            this.lastFrameTime = now;
        }
        
        if (!bypassThrottle && this.pathCountThisFrame >= this.MAX_PATHS_PER_FRAME) {
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
        // 🚀 [Expert Optimization] queryObstaclesRect를 사용하여 건물(장애물) 레이어만 조회.
        // 수만 개의 나무/풀떼기가 있어도 장애물 레이어는 분리되어 있으므로 병목이 발생하지 않음.
        const nearbyIds = spatialHash ? spatialHash.queryObstaclesRect(Math.min(sx, ex) - 50, Math.min(sy, ey) - 50, Math.abs(ex - sx) + 100, Math.abs(ey - sy) + 100) : em.buildingIds;

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
        const MAX_ATTEMPTS = 2000; // 🚀 [Expert Fix] 메인 스레드 프리징 방지를 위해 10,000 -> 2,000으로 대폭 축소
        const terrainGen = engine.terrainGen;
        
        let closestKey = startKey;
        let minH = h(startX, startY, endX, endY);

        while (openSet.size() > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;
            const currentKey = openSet.pop();
            const currentX = (currentKey >> 16) & 0xFFFF;
            const currentY = currentKey & 0xFFFF;

            if (currentX === endX && currentY === endY) {
                return this._reconstructPath(cameFrom, currentKey, gridSize, ex, ey, sx, sy);
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
            return this._reconstructPath(cameFrom, closestKey, gridSize, ex, ey, sx, sy);
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
                return this._reconstructPath(cameFrom, currentKey, gridSize, realX + offsetX, realY + offsetY, sx, sy);
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

    static _reconstructPath(cameFrom, currentKey, gridSize, ex, ey, sx, sy) {
        const path = this.pathArrayPool.get();
        let curr = currentKey;
        while (cameFrom.has(curr)) {
            const cx = (curr >> 16) & 0xFFFF;
            const cy = curr & 0xFFFF;
            
            const pt = this.pathPointPool.get();
            pt.x = cx * gridSize + gridSize / 2;
            pt.y = cy * gridSize + gridSize / 2;
            path.unshift(pt);
            
            curr = cameFrom.get(curr);
        }
        
        // 🚀 [Expert Fix] 시작 위치를 경로의 첫 번째 포인트로 추가하여 "순간이동(Snapping)" 방지
        const startPt = this.pathPointPool.get();
        startPt.x = sx;
        startPt.y = sy;
        path.unshift(startPt);

        const endPt = this.pathPointPool.get();
        endPt.x = ex;
        endPt.y = ey;
        path.push(endPt);
        
        return path;
    }

    /**
     * 🧹 [Expert Optimization] 사용이 끝난 경로를 풀에 반환
     */
    static releasePath(path) {
        if (!path || !Array.isArray(path)) return;
        
        for (let i = 0; i < path.length; i++) {
            const pt = path[i];
            if (pt && typeof pt === 'object') {
                this.pathPointPool.release(pt);
            }
        }
        this.pathArrayPool.release(path);
    }

    /**
     * 🧠 [HPA* Step 24] 상위 계층 그래프(Abstract Graph) 상의 경로 탐색
     */
    static findAbstractPath(sx, sy, ex, ey, engine) {
        const startCluster = this.clusters.get(`${Math.floor(sx / this.clusterSize)},${Math.floor(sy / this.clusterSize)}`);
        const endCluster = this.clusters.get(`${Math.floor(ex / this.clusterSize)},${Math.floor(ey / this.clusterSize)}`);
        
        if (!startCluster || !endCluster) return null;
        if (startCluster === endCluster) return null;

        // 🚀 [Step 28] 경로 캐시 확인
        const cacheKey = `${startCluster.id}_${endCluster.id}`;
        if (this.pathCache.has(cacheKey)) return this.pathCache.get(cacheKey);

        const startNodeKeys = this._findNearbyAbstractNodes(sx, sy, startCluster, engine);
        const endNodeKeys = this._findNearbyAbstractNodes(ex, ey, endCluster, engine);
        
        if (startNodeKeys.length === 0 || endNodeKeys.length === 0) return null;

        // ... (A* 로직 동일)
        const gScore = new Map();
        const fScore = new Map();
        const h = (k1, k2) => {
            const [x1, y1] = k1.split(',').map(Number);
            const [x2, y2] = k2.split(',').map(Number);
            return Math.abs(x1 - x2) + Math.abs(y1 - y2);
        };

        const openSet = new MinHeap((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
        const cameFrom = new Map();

        for (const sk of startNodeKeys) {
            gScore.set(sk, 0);
            fScore.set(sk, h(sk, endNodeKeys[0]));
            openSet.push(sk);
        }

        const endNodeSet = new Set(endNodeKeys);
        let foundEndKey = null;

        while (openSet.size() > 0) {
            const currentKey = openSet.pop();
            if (endNodeSet.has(currentKey)) {
                foundEndKey = currentKey;
                break;
            }

            const node = this.abstractNodes.get(currentKey);
            if (!node) continue;

            for (const [neighborKey, weight] of node.neighbors) {
                const tentativeG = (gScore.get(currentKey) || 0) + weight;
                if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, currentKey);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + h(neighborKey, endNodeKeys[0]));
                    openSet.push(neighborKey);
                }
            }
        }

        if (!foundEndKey) return null;

        const path = [];
        let curr = foundEndKey;
        while (curr) {
            path.unshift(curr);
            curr = cameFrom.get(curr);
        }

        // 🚀 [Step 28] 결과 캐싱
        this.pathCache.set(cacheKey, path);
        return path;
    }

    /**
     * 🚀 [Step 27] 길찾기 요청 추가 (비동기 처리용)
     */
    static requestPath(entityId, state, sx, sy, ex, ey, engine, callback) {
        this.pathRequestQueue.push({ entityId, state, sx, sy, ex, ey, engine, callback });
    }

    /**
     * ⚙️ [Step 27] 대기열 처리 (매 프레임 호출)
     */
    static processQueue() {
        if (this.pathRequestQueue.length === 0) return;

        // 프레임당 최대 3개의 요청만 처리
        const MAX_PER_FRAME = 3;
        let processed = 0;

        while (this.pathRequestQueue.length > 0 && processed < MAX_PER_FRAME) {
            const request = this.pathRequestQueue.shift();
            const { entityId, state, sx, sy, ex, ey, engine, callback } = request;
            
            // 엔티티가 이미 다른 행동을 하거나 삭제되었다면 무시
            if (state.mode === 'die') continue;

            const path = this.findHierarchicalPath(sx, sy, ex, ey, engine);
            if (callback) callback(path);
            processed++;
        }
    }

    /**
     * 🧹 [Step 28] 지형 변경 시 캐시 무효화
     */
    static invalidateCache() {
        this.pathCache.clear();
    }

    static _findNearbyAbstractNodes(x, y, cluster, engine) {
        const nodes = [];
        for (const [key, node] of this.abstractNodes) {
            const [nx, ny] = key.split(',').map(Number);
            if (nx >= cluster.x && nx < cluster.x + cluster.width && 
                ny >= cluster.y && ny < cluster.y + cluster.height) {
                // 구역 내에서 A*로 도달 가능한지 확인
                const path = this.findPath(x, y, nx, ny, engine, 10, true);
                if (path && path.length > 0) nodes.push(key);
            }
        }
        return nodes;
    }

    /**
     * 🧠 [HPA* Step 25] 계층적 길찾기 통합 인터페이스
     */
    static findHierarchicalPath(sx, sy, ex, ey, engine) {
        const abstractPath = this.findAbstractPath(sx, sy, ex, ey, engine);
        if (!abstractPath) {
            // 계층적 경로가 없거나 같은 구역이면 일반 A* 수행
            return this.findPath(sx, sy, ex, ey, engine);
        }

        // 추상 경로의 첫 번째 게이트로의 로컬 경로 반환
        const [nextX, nextY] = abstractPath[0].split(',').map(Number);
        const localPath = this.findPath(sx, sy, nextX, nextY, engine);
        
        return {
            fullAbstractPath: abstractPath,
            localPath: localPath,
            targetPos: { x: ex, y: ey }
        };
    }

    static followPath(transform, state, targetPos, speed, engine, targetRadius = 12, recalcIntervalOverride = null, targetIdOverride = null, velocity = null) {
        const now = Date.now();
        const currentTargetId = targetIdOverride || state.targetId;
        
        const isEmergency = ['flee', 'eat', 'forage', 'sleep', 'hunt', 'attack'].includes(state.mode);
        const defaultInterval = isEmergency ? 500 : 30000;
        const recalcInterval = recalcIntervalOverride || defaultInterval;

        // 🗺️ [HPA* Step 26] 계층적 경로 처리 로직
        let needsRecalc = !state.path || 
                          state.pathTargetId !== currentTargetId || 
                          (now - (state.lastPathCalcTime || 0) > recalcInterval);

        if (needsRecalc) {
            const distSq = Math.pow(targetPos.x - transform.x, 2) + Math.pow(targetPos.y - transform.y, 2);
            
            // 거리가 멀면 계층적 길찾기 시도 (예: 300px 이상)
            if (distSq > 90000) {
                const hPath = this.findHierarchicalPath(transform.x, transform.y, targetPos.x, targetPos.y, engine);
                if (hPath === null) return false; // 🚀 [Expert Fix] Throttled인 경우 기존 경로 유지하며 대기

                if (hPath.fullAbstractPath) {
                    state.abstractPath = hPath.fullAbstractPath;
                    state.abstractIndex = 0;
                    state.path = hPath.localPath;
                } else {
                    state.path = hPath; // 일반 경로
                    state.abstractPath = null;
                }
            } else {
                const path = this.findPath(transform.x, transform.y, targetPos.x, targetPos.y, engine);
                if (path === null) return false; // 🚀 [Expert Fix] Throttled인 경우 기존 경로 유지하며 대기
                
                state.path = path;
                state.abstractPath = null;
            }
            
            state.pathTargetId = currentTargetId;
            state.pathIndex = 0;
            state.lastPathCalcTime = now;
        }

        if (state.path) {
            if (state.path.length === 0) {
                // 🗺️ [HPA* Step 26] 다음 구역(Gate)으로 진행
                if (state.abstractPath && state.abstractIndex < state.abstractPath.length - 1) {
                    state.abstractIndex++;
                    const [nextX, nextY] = state.abstractPath[state.abstractIndex].split(',').map(Number);
                    const nextPath = this.findPath(transform.x, transform.y, nextX, nextY, engine);
                    if (nextPath === null) return false; // Throttled

                    state.path = nextPath;
                    state.pathIndex = 0;
                    if (!state.path || state.path.length === 0) {
                        console.warn(`[Pathfinder] No path found for entity to target. Returning -1.`);
                        return -1;
                    }
                } else {
                    if (velocity) { velocity.vx = 0; velocity.vy = 0; }
                    else { transform.vx = 0; transform.vy = 0; }
                    return -1;
                }
            }

            const dxEnd = targetPos.x - transform.x;
            const dyEnd = targetPos.y - transform.y;
            if (dxEnd * dxEnd + dyEnd * dyEnd <= targetRadius * targetRadius) {
                if (velocity) { velocity.vx = 0; velocity.vy = 0; }
                else { transform.vx = 0; transform.vy = 0; }
                state.path = null;
                state.abstractPath = null;
                return true;
            }

            if (state.pathIndex < state.path.length) {
                const wp = state.path[state.pathIndex];
                const dx = wp.x - transform.x;
                const dy = wp.y - transform.y;

                if (dx * dx + dy * dy < 144) {
                    state.pathIndex++;
                    
                    // 마지막 웨이포인트 도달 시 다음 게이트 확인
                    if (state.pathIndex >= state.path.length && state.abstractPath) {
                        if (state.abstractIndex < state.abstractPath.length - 1) {
                            state.abstractIndex++;
                            const [nextX, nextY] = state.abstractPath[state.abstractIndex].split(',').map(Number);
                            const nextPath = this.findPath(transform.x, transform.y, nextX, nextY, engine);
                            if (nextPath === null) return false; // Throttled

                            state.path = nextPath;
                            state.pathIndex = 0;
                        } else {
                            // 마지막 게이트 도달 시 실제 목적지로의 최종 로컬 경로
                            const finalPath = this.findPath(transform.x, transform.y, targetPos.x, targetPos.y, engine);
                            if (finalPath === null) return false; // Throttled

                            state.path = finalPath;
                            state.pathIndex = 0;
                            state.abstractPath = null;
                        }
                    }
                }

                if (state.path && state.pathIndex < state.path.length) {
                    const targetWp = state.path[state.pathIndex];
                    const nx = targetWp.x - transform.x;
                    const ny = targetWp.y - transform.y;
                    const d = Math.hypot(nx, ny);
                    if (d > 0.1) {
                        if (velocity) {
                            velocity.vx = (nx / d) * speed;
                            velocity.vy = (ny / d) * speed;
                        } else {
                            transform.vx = (nx / d) * speed;
                            transform.vy = (ny / d) * speed;
                        }
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

    /**
     * 🗺️ [HPA* Step 21] 상위 계층 구역(Zone/Cluster) 분할 및 초기화
     */
    static initHierarchy(engine) {
        if (!engine || !engine.mapWidth) return;
        
        const w = engine.mapWidth;
        const h = engine.mapHeight;
        const size = this.clusterSize;
        
        const cols = Math.ceil(w / size);
        const rows = Math.ceil(h / size);
        
        this.clusters.clear();
        this.abstractNodes.clear();
        
        console.log(`🗺️ Initializing HPA* Hierarchy: ${cols}x${rows} clusters`);

        // 1. 구역(Cluster) 생성
        for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
                const id = `${cx},${cy}`;
                const cluster = new HPACluster(
                    id, 
                    cx * size, 
                    cy * size, 
                    Math.min(size, w - cx * size), 
                    Math.min(size, h - cy * size)
                );
                this.clusters.set(id, cluster);
            }
        }

        // 2. 경계점(Transition Nodes) 탐색 (Step 22)
        this.rebuildAllTransitions(engine);
    }

    /**
     * 🚪 [HPA* Step 22] 모든 인접 구역 간의 경계점(Entrance) 탐색
     */
    static rebuildAllTransitions(engine) {
        const w = engine.mapWidth;
        const h = engine.mapHeight;
        const size = this.clusterSize;
        const cols = Math.ceil(w / size);
        const rows = Math.ceil(h / size);
        
        // 🚀 [Expert Optimization] 워커가 활성화되어 있다면 워커에게 위임
        if (engine.worker) {
            this._isWorkerRebuilding = true;
            engine.worker.postMessage({
                type: 'REBUILD_HPA_GRAPH',
                payload: { clusterSize: this.clusterSize, mapWidth: w, mapHeight: h }
            });
            return;
        }

        for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
                // 오른쪽 neighbor 확인
                if (cx < cols - 1) {
                    this._findTransitionsBetween(cx, cy, cx + 1, cy, 'vertical', engine);
                }
                // 아래쪽 neighbor 확인
                if (cy < rows - 1) {
                    this._findTransitionsBetween(cx, cy, cx, cy + 1, 'horizontal', engine);
                }
            }
        }
        
        // 3. 구역 내 노드 간 가중치 계산 (Intra-edges)
        for (const cluster of this.clusters.values()) {
            this._computeIntraEdges(cluster, engine);
        }
    }

    static _findTransitionsBetween(cx1, cy1, cx2, cy2, orientation, engine) {
        const cluster1 = this.clusters.get(`${cx1},${cy1}`);
        const cluster2 = this.clusters.get(`${cx2},${cy2}`);
        if (!cluster1 || !cluster2) return;

        const tg = engine.terrainGen;
        
        if (orientation === 'vertical') {
            const x1 = cluster1.x + cluster1.width - 1;
            const x2 = cluster2.x;
            const yStart = Math.max(cluster1.y, cluster2.y);
            const yEnd = Math.min(cluster1.y + cluster1.height, cluster2.y + cluster2.height);
            this._scanBoundary(x1, x2, yStart, yEnd, true, cluster1, cluster2, tg);
        } else {
            const y1 = cluster1.y + cluster1.height - 1;
            const y2 = cluster2.y;
            const xStart = Math.max(cluster1.x, cluster2.x);
            const xEnd = Math.min(cluster1.x + cluster1.width, cluster2.x + cluster2.width);
            this._scanBoundary(y1, y2, xStart, xEnd, false, cluster1, cluster2, tg);
        }
    }

    static _scanBoundary(fixed1, fixed2, rangeStart, rangeEnd, isVertical, c1, c2, tg) {
        let gapStart = -1;
        for (let i = rangeStart; i < rangeEnd; i++) {
            const p1 = isVertical ? { x: fixed1, y: i } : { x: i, y: fixed1 };
            const p2 = isVertical ? { x: fixed2, y: i } : { x: i, y: fixed2 };
            const canPass = tg.isNavigable(p1.x, p1.y) && tg.isNavigable(p2.x, p2.y);
            if (canPass) {
                if (gapStart === -1) gapStart = i;
            } else {
                if (gapStart !== -1) {
                    this._createGate(gapStart, i - 1, fixed1, fixed2, isVertical, c1, c2);
                    gapStart = -1;
                }
            }
        }
        if (gapStart !== -1) {
            this._createGate(gapStart, rangeEnd - 1, fixed1, fixed2, isVertical, c1, c2);
        }
    }

    static _createGate(start, end, f1, f2, isVertical, c1, c2) {
        const mid = Math.floor((start + end) / 2);
        const p1 = isVertical ? { x: f1, y: mid } : { x: mid, y: f1 };
        const p2 = isVertical ? { x: f2, y: mid } : { x: mid, y: f2 };
        const key1 = `${p1.x},${p1.y}`;
        const key2 = `${p2.x},${p2.y}`;
        this._addAbstractEdge(key1, key2, 1.0, c1, c2);
    }

    static _addAbstractEdge(k1, k2, weight, c1, c2) {
        if (!this.abstractNodes.has(k1)) this.abstractNodes.set(k1, { neighbors: new Map() });
        if (!this.abstractNodes.has(k2)) this.abstractNodes.set(k2, { neighbors: new Map() });
        this.abstractNodes.get(k1).neighbors.set(k2, weight);
        this.abstractNodes.get(k2).neighbors.set(k1, weight);
        if (c1 !== c2) {
            if (!c1.transitions.has(c2.id)) c1.transitions.set(c2.id, []);
            c1.transitions.get(c2.id).push({ from: k1, to: k2, weight });
            if (!c2.transitions.has(c1.id)) c2.transitions.set(c1.id, []);
            c2.transitions.get(c1.id).push({ from: k2, to: k1, weight });
        }
    }

    /**
     * 🚩 [Expert Optimization] 특정 좌표의 지형 변경 시 해당 클러스터를 재계산 대상으로 표시
     */
    static markClusterDirty(x, y) {
        const cx = Math.floor(x / this.clusterSize);
        const cy = Math.floor(y / this.clusterSize);
        const id = `${cx},${cy}`;
        this.dirtyClusters.add(id);
        this._isRebuildPending = true;
        
        // 🚀 [Step 28] 지형 변경 시 경로 캐시 전체 무효화 (안전성 우선)
        this.invalidateCache();
    }

    /**
     * ⚙️ [Expert Optimization] 프레임당 소수의 더러운 클러스터만 점진적으로 재계산 (프리징 방지)
     */
    static updateHierarchy(engine) {
        if (!this._isRebuildPending || this.dirtyClusters.size === 0) return;

        // 실제 그래프 재계산 (워커가 있으면 워커에게 위임)
        if (engine.worker) {
            if (this._isWorkerRebuilding) return; // 이전 재계산이 끝날 때까지 대기
            
            // 🚀 [Expert] 쿨다운 적용: 브러시 툴 연속 드래그 시 증분 업데이트 폭주(프리징) 방지
            const now = performance.now();
            if (now - (this._lastRebuildTime || 0) < 500) return; // 500ms 쿨다운
            this._lastRebuildTime = now;

            this._isWorkerRebuilding = true;
            const dirtyIds = Array.from(this.dirtyClusters); // 🚀 [Expert] 변경된 구역만 추출
            this.dirtyClusters.clear(); 
            this._isRebuildPending = false;

            engine.worker.postMessage({
                type: 'REBUILD_HPA_GRAPH',
                payload: { 
                    clusterSize: this.clusterSize, 
                    mapWidth: engine.mapWidth, 
                    mapHeight: engine.mapHeight,
                    dirtyClusterIds: dirtyIds 
                }
            });
            return;
        }

        // 워커가 없을 때: 프레임당 최대 1개의 클러스터만 갱신 (매우 보수적인 스로틀링)
        const it = this.dirtyClusters.values();
        const clusterId = it.next().value;
        this.dirtyClusters.delete(clusterId);

        if (this.dirtyClusters.size === 0) this._isRebuildPending = false;

        const cluster = this.clusters.get(clusterId);
        if (!cluster) return;

        console.log(`🔄 Rebuilding HPA* Cluster: ${clusterId}`);
        
        // 1. 해당 구역의 추상 노드와 엣지 초기화
        const [cx, cy] = clusterId.split(',').map(Number);
        
        // 주변 구역과의 경계 재탐색
        const cols = Math.ceil(engine.mapWidth / this.clusterSize);
        const rows = Math.ceil(engine.mapHeight / this.clusterSize);

        if (cx > 0) this._findTransitionsBetween(cx - 1, cy, cx, cy, 'vertical', engine);
        if (cx < cols - 1) this._findTransitionsBetween(cx, cy, cx + 1, cy, 'vertical', engine);
        if (cy > 0) this._findTransitionsBetween(cx, cy - 1, cx, cy, 'horizontal', engine);
        if (cy < rows - 1) this._findTransitionsBetween(cx, cy, cx, cy + 1, 'horizontal', engine);

        // 2. 구역 내 가중치 재계산
        this._computeIntraEdges(cluster, engine);
        
        // 경로 캐시 무효화
        this.invalidateCache();
    }

    static _computeIntraEdges(cluster, engine) {
        const nodes = [];
        for (const key of this.abstractNodes.keys()) {
            const [x, y] = key.split(',').map(Number);
            if (x >= cluster.x && x < cluster.x + cluster.width && y >= cluster.y && y < cluster.y + cluster.height) {
                nodes.push(key);
            }
        }
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const k1 = nodes[i], k2 = nodes[j];
                const [x1, y1] = k1.split(',').map(Number), [x2, y2] = k2.split(',').map(Number);
                const path = this.findPath(x1, y1, x2, y2, engine, 10, true);
                if (path && path.length > 0) this._addAbstractEdge(k1, k2, path.length, cluster, cluster);
            }
        }
    }

    /** ⚙️ [Expert AI] 워커에서 재계산된 그래프 데이터를 메인 스레드에 반영 */
    static applyRebuiltGraph(payload) {
        const { nodes, clusters, isIncremental } = payload;
        
        // 1. 추상 노드 복원/병합
        if (isIncremental) {
            // 🚀 [Expert] 증분 업데이트 시, 영향받는 구역 내의 기존 노드들만 선별적으로 제거
            for (const cId in clusters) {
                const cluster = this.clusters.get(cId);
                if (!cluster) continue;
                
                for (const nodeKey of this.abstractNodes.keys()) {
                    const [nx, ny] = nodeKey.split(',').map(Number);
                    if (nx >= cluster.x && nx < cluster.x + cluster.width && 
                        ny >= cluster.y && ny < cluster.y + cluster.height) {
                        this.abstractNodes.delete(nodeKey);
                    }
                }
            }
        } else {
            this.abstractNodes.clear();
        }

        for (const [k, v] of Object.entries(nodes)) {
            this.abstractNodes.set(k, { neighbors: new Map(v.neighbors) });
        }

        // 2. 구역 통로 정보 복원/병합
        for (const [cId, data] of Object.entries(clusters)) {
            const cluster = this.clusters.get(cId);
            if (!cluster) continue;
            
            cluster.transitions.clear();
            for (const [nId, trans] of Object.entries(data.transitions)) {
                cluster.transitions.set(nId, trans);
            }
            cluster.isDirty = false;
        }

        this.invalidateCache();
        this._isWorkerRebuilding = false;
        console.log(`🗺️ [Pathfinder] HPA* Graph ${isIncremental ? 'incrementally ' : ''}updated from Worker.`);
    }
}

