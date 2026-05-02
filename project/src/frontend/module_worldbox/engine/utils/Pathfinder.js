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
     * 🧠 고도화된 A* 기반 그리드 경로 탐색 (메모리 및 연산 최적화 완비)
     */
    static findPath(sx, sy, ex, ey, engine, gridSize = 10) {
        if (!engine) return [];
        const em = engine.entityManager;
        const spatialHash = engine.spatialHash;

        const dx = ex - sx;
        const dy = ey - sy;

        // 매우 가까우면 A* 생략하고 바로 직선 반환
        if (dx * dx + dy * dy < gridSize * gridSize * 4) {
            return [{ x: ex, y: ey }];
        }

        const startX = Math.floor(sx / gridSize);
        const startY = Math.floor(sy / gridSize);
        const endX = Math.floor(ex / gridSize);
        const endY = Math.floor(ey / gridSize);

        // 🚀 [Optimization] 32비트 정수 키 사용 (문자열 할당 및 엄청난 GC 스파이크 완벽 제거)
        const getKey = (x, y) => (x << 16) | y;
        let startKey = getKey(startX, startY);
        const endKey = getKey(endX, endY);

        // 1. 장애물 정보 캐싱 (건물 충돌 박스)
        const obstacles = new Set();
        const qMinX = Math.min(sx, ex) - 100;
        const qMaxX = Math.max(sx, ex) + 100;
        const qMinY = Math.min(sy, ey) - 100;
        const qMaxY = Math.max(sy, ey) + 100;

        const nearbyIds = spatialHash ? spatialHash.queryRect(qMinX, qMinY, qMaxX - qMinX, qMaxY - qMinY) : em.buildingIds;

        for (const bId of nearbyIds) {
            const b = em.entities.get(bId);
            if (!b || !b.components.has('Building')) continue;
            const t = b.components.get('Transform');
            const v = b.components.get('Visual');
            if (t && v) {
                const r = (v.size || 40) * 0.45;
                const minX = Math.floor((t.x - r) / gridSize);
                const maxX = Math.floor((t.x + r) / gridSize);
                const minY = Math.floor((t.y - r) / gridSize);
                const maxY = Math.floor((t.y + r) / gridSize);
                for (let x = minX; x <= maxX; x++) {
                    for (let y = minY; y <= maxY; y++) {
                        obstacles.add(getKey(x, y));
                    }
                }
            }
        }

        // 시작/종료 지점은 무조건 통과 허용
        obstacles.delete(endKey);

        let startNode = { x: startX, y: startY, key: startKey };
        if (obstacles.has(startKey)) {
            const nearest = this.findNearestWalkable(startX, startY, obstacles, getKey);
            if (nearest) {
                startNode = nearest;
                startKey = nearest.key;
            } else {
                obstacles.delete(startKey);
            }
        } else {
            obstacles.delete(startKey);
        }

        // 2. A* 자료구조 준비
        const gScore = new Map();
        gScore.set(startKey, 0);

        const fScore = new Map();
        const h = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
        fScore.set(startKey, h(startX, startY, endX, endY));

        // 🚀 [Zero-Allocation] MinHeap에도 오직 32비트 정수(Key)만 저장
        const openSet = new MinHeap((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
        openSet.push(startKey);

        const openSetTracker = new Set([startKey]);
        const closedSet = new Set();
        const cameFrom = new Map();

        let attempts = 0;
        const MAX_ATTEMPTS = 15000; // 그리드 크기가 줄어들었으므로 탐색 횟수를 더 확보합니다.

        const terrainGen = engine.terrainGen;

        let closestNodeKey = startKey;
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
                closestNodeKey = currentKey;
            }

            openSetTracker.delete(currentKey);
            closedSet.add(currentKey);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = currentX + dx;
                    const ny = currentY + dy;
                    const neighborKey = getKey(nx, ny);

                    if (closedSet.has(neighborKey) || obstacles.has(neighborKey)) continue;

                    const realX = nx * gridSize + gridSize / 2;
                    const realY = ny * gridSize + gridSize / 2;
                    let terrainWeight = 1.0;

                    if (terrainGen) {
                        if (!terrainGen.isNavigable(realX, realY)) {
                            if (nx !== endX || ny !== endY) continue;
                        }
                        const biomeId = terrainGen.getBiomeAt(realX, realY);
                        if (biomeId === 4) terrainWeight = 1.8;
                        else if (biomeId === 6 || biomeId === 7) terrainWeight = 0.9;
                        else if (biomeId === 5) terrainWeight = 1.0;
                    }

                    const baseWeight = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
                    const tentativeG = (gScore.get(currentKey) || 0) + (baseWeight * terrainWeight);

                    if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                        cameFrom.set(neighborKey, currentKey);
                        gScore.set(neighborKey, tentativeG);
                        fScore.set(neighborKey, tentativeG + h(nx, ny, endX, endY));

                        if (!openSetTracker.has(neighborKey)) {
                            openSet.push(neighborKey); // 🚀 [Zero-Allocation] 정수 키만 푸시
                            openSetTracker.add(neighborKey);
                        }
                    }
                }
            }
        }

        // 🛑 [Partial Path Return] 연산 제한에 걸린 경우, 목표에 가장 가까운 경로라도 반환
        if (attempts >= MAX_ATTEMPTS && closestNodeKey !== startKey) {
            const pEx = ((closestNodeKey >> 16) & 0xFFFF) * gridSize + gridSize / 2;
            const pEy = (closestNodeKey & 0xFFFF) * gridSize + gridSize / 2;
            return this._reconstructPath(cameFrom, closestNodeKey, gridSize, pEx, pEy);
        }

        // 도달 불가능
        return [];
    }

    static findNearestWalkable(gridX, gridY, obstacles, getKey, range = 3) {
        for (let r = 1; r <= range; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = gridX + dx;
                    const ny = gridY + dy;
                    const key = getKey(nx, ny);
                    if (!obstacles.has(key)) return { x: nx, y: ny, key: key };
                }
            }
        }
        return null;
    }

    static _reconstructPath(cameFrom, currentKey, gridSize, ex, ey) {
        const path = [];
        let curr = currentKey;
        let safety = 0;
        while (cameFrom.has(curr) && safety < 5000) {
            const cx = (curr >> 16) & 0xFFFF;
            const cy = curr & 0xFFFF;
            path.unshift({ x: cx * gridSize + gridSize / 2, y: cy * gridSize + gridSize / 2 });
            curr = cameFrom.get(curr);
            safety++;
        }
        // 마지막 웨이포인트는 정확한 도착 지점 좌표로 보정
        if (path.length > 0) path[path.length - 1] = { x: ex, y: ey };
        else path.push({ x: ex, y: ey });
        return path;
    }

    /**
     * 경로 추적 및 상태 갱신 매니저
     */
    static followPath(transform, state, targetPos, speed, engine) {
        const now = Date.now();
        // 타겟이 바뀌었거나 주기적인 재탐색(2초)이 필요한 경우
        const needsRecalc = !state.path ||
            state.pathTargetId !== state.targetId ||
            (state.lastPathCalcTime && now - state.lastPathCalcTime > 2000);

        if (needsRecalc) {
            state.path = this.findPath(transform.x, transform.y, targetPos.x, targetPos.y, engine);
            state.pathTargetId = state.targetId;
            state.pathIndex = 0;
            state.lastPathCalcTime = now;
        } else if (state.path && state.pathIndex < state.path.length) {
            // 🚀 [Optimization] 현재 가야 할 다음 웨이포인트 사이에 장애물이 생겼는지 체크 (직선 거리)
            const nextWp = state.path[state.pathIndex];
            if (this.isLineBlocked(transform.x, transform.y, nextWp.x, nextWp.y, engine)) {
                state.lastPathCalcTime = 0; // 즉시 재탐색 유도
            }
        }

        // 🛑 [UNREACHABLE] 길을 전혀 찾을 수 없는 막힌 타겟
        if (state.path && state.path.length === 0) {
            transform.vx *= 0.5;
            transform.vy *= 0.5;
            // 무한 대기 방지를 위해 해당 작업을 포기
            state.targetId = null;
            state.path = null;
            return false;
        }

        if (state.path && state.pathIndex < state.path.length) {
            const nextWp = state.path[state.pathIndex];
            const dx = nextWp.x - transform.x;
            const dy = nextWp.y - transform.y;
            const distSq = dx * dx + dy * dy;

            // 웨이포인트 도달 시 다음 포인트로 (반경 20px)
            if (distSq < 400) state.pathIndex++;

            if (state.pathIndex < state.path.length) {
                const wp = state.path[state.pathIndex];
                const nx = wp.x - transform.x;
                const ny = wp.y - transform.y;
                const d = Math.sqrt(nx * nx + ny * ny);

                if (d > 0.1) {
                    transform.vx = (nx / d) * speed;
                    transform.vy = (ny / d) * speed;
                }

                // 🛑 [Movement Failure] 웨이포인트 갱신 지연 체크 (물리 충돌로 인한 끼임 판정)
                // 만약 현재 웨이포인트를 향해 너무 오랫동안(예: 100프레임) 이동하지 못했다면 끼인 것으로 간주
                if (state.lastPathIndex === state.pathIndex) {
                    state.stuckFailTimer = (state.stuckFailTimer || 0) + 1;
                } else {
                    state.lastPathIndex = state.pathIndex;
                    state.stuckFailTimer = 0;
                }

                // 너무 오랫동안 같은 웨이포인트에 머물면 완전 포기
                if (state.stuckFailTimer > 100) {
                    state.path = null;
                    state.targetId = null;
                    state.stuckFailTimer = 0;
                    
                    // 끼임 방지를 위한 랜덤 회피 튕겨내기
                    transform.vx += (Math.random() - 0.5) * speed * 5.0;
                    transform.vy += (Math.random() - 0.5) * speed * 5.0;
                }

                return false;
            }
        }

        // 최종 타겟 도달 판정 (반경 20px)
        // 🛑 [Strict Movement] 경로가 종료되었거나 없으면 이동하지 않음
        transform.vx = 0;
        transform.vy = 0;
        
        // 경로의 모든 노드를 거쳤다면 도착(true)으로 판정
        if (state.path && state.path.length > 0 && state.pathIndex >= state.path.length) {
            return true;
        }
        return false;
    }

    /**
     * 📏 두 지점 사이에 장애물이 있는지 직선으로 체크 (Line-of-Sight)
     */
    static isLineBlocked(x1, y1, x2, y2, engine) {
        if (!engine || !engine.spatialHash) return false;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 5) return false;

        const steps = Math.ceil(distance / 10); // 10px 단위로 체크
        for (let i = 1; i < steps; i++) {
            const tx = x1 + (dx * i / steps);
            const ty = y1 + (dy * i / steps);

            // 근처 건물 장애물 체크
            const nearby = engine.spatialHash.queryRect(tx - 5, ty - 5, 10, 10);
            for (const id of nearby) {
                const b = engine.entityManager.entities.get(id);
                if (b && b.components.has('Building')) {
                    const bt = b.components.get('Transform');
                    const bv = b.components.get('Visual');
                    if (bt && bv) {
                        const r = (bv.size || 40) * 0.45;
                        const distToBuilding = Math.hypot(bt.x - tx, bt.y - ty);
                        if (distToBuilding < r) return true;
                    }
                }
            }

            // 지형 체크 (강, 바다 등)
            if (engine.terrainGen && !engine.terrainGen.isNavigable(tx, ty)) {
                return true;
            }
        }
        return false;
    }
}
