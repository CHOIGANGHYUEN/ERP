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
     * A* 기반의 최적화된 그리드 경로 탐색
     */
    static findPath(sx, sy, ex, ey, engine, gridSize = 20) {
        if (!engine) return [];
        const em = engine.entityManager;
        const spatialHash = engine.spatialHash;

        const dx = ex - sx;
        const dy = ey - sy;
        // 매우 가까우면 바로 직선 반환
        if (dx * dx + dy * dy < gridSize * gridSize * 4) {
            return [{ x: ex, y: ey }];
        }

        const startX = Math.floor(sx / gridSize);
        const startY = Math.floor(sy / gridSize);
        const endX = Math.floor(ex / gridSize);
        const endY = Math.floor(ey / gridSize);

        const startKey = `${startX},${startY}`;
        const endKey = `${endX},${endY}`;

        // 1. 장애물 정보 캐싱
        const obstacles = new Set();
        const qMinX = Math.min(sx, ex) - 100;
        const qMaxX = Math.max(sx, ex) + 100;
        const qMinY = Math.min(sy, ey) - 100;
        const qMaxY = Math.max(sy, ey) + 100;
        
        // 🚀 [Troubleshooting] em.engine 대신 인자로 받은 engine 사용
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
                        obstacles.add(`${x},${y}`);
                    }
                }
            }
        }
        // 시작/종료 지점은 무조건 통과 허용
        obstacles.delete(endKey);

        // 🚀 [Troubleshooting 2] 시작점이 장애물 내부라면 가장 가까운 빈 공간 찾기
        let startNode = { x: startX, y: startY, key: startKey };
        if (obstacles.has(startKey)) {
            const nearest = this.findNearestWalkable(startX, startY, obstacles);
            if (nearest) {
                startNode = nearest;
            } else {
                obstacles.delete(startKey);
            }
        } else {
            obstacles.delete(startKey);
        }

        // 2. A* 자료구조 준비
        const gScore = new Map();
        gScore.set(startNode.key, 0);
        
        const fScore = new Map();
        const h = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        fScore.set(startNode.key, h(startNode, { x: endX, y: endY }));

        const openSet = new MinHeap((a, b) => (fScore.get(a.key) || Infinity) - (fScore.get(b.key) || Infinity));
        openSet.push(startNode);
        
        const openSetTracker = new Set([startNode.key]);
        const closedSet = new Set();
        const cameFrom = new Map();

        let attempts = 0;
        const MAX_ATTEMPTS = 500;

        while (openSet.size() > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;
            const current = openSet.pop();
            const currentKey = current.key;

            if (current.x === endX && current.y === endY) {
                return this._reconstructPath(cameFrom, currentKey, gridSize, ex, ey);
            }

            openSetTracker.delete(currentKey);
            closedSet.add(currentKey);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = current.x + dx;
                    const ny = current.y + dy;
                    const neighborKey = `${nx},${ny}`;
                    if (closedSet.has(neighborKey) || obstacles.has(neighborKey)) continue;
                    const weight = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
                    const tentativeG = (gScore.get(currentKey) || 0) + weight;
                    if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                        cameFrom.set(neighborKey, { px: current.x, py: current.y });
                        gScore.set(neighborKey, tentativeG);
                        fScore.set(neighborKey, tentativeG + h({x: nx, y: ny}, { x: endX, y: endY }));
                        if (!openSetTracker.has(neighborKey)) {
                            openSet.push({ x: nx, y: ny, key: neighborKey });
                            openSetTracker.add(neighborKey);
                        }
                    }
                }
            }
        }
        return [];
    }

    /** 🚀 [Troubleshooting 2] 주변 빈 공간 탐색 */
    static findNearestWalkable(gridX, gridY, obstacles, range = 3) {
        for (let r = 1; r <= range; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = gridX + dx;
                    const ny = gridY + dy;
                    const key = `${nx},${ny}`;
                    if (!obstacles.has(key)) return { x: nx, y: ny, key: key };
                }
            }
        }
        return null;
    }

    /** 경로 복구 (무한 루프 방지 포함) */
    static _reconstructPath(cameFrom, currentKey, gridSize, ex, ey) {
        const path = [];
        let curr = currentKey;
        let safety = 0;
        while (cameFrom.has(curr) && safety < 200) {
            const parts = curr.split(',').map(Number);
            path.unshift({ x: parts[0] * gridSize + gridSize / 2, y: parts[1] * gridSize + gridSize / 2 });
            const parent = cameFrom.get(curr);
            curr = `${parent.px},${parent.py}`;
            safety++;
        }
        if (path.length > 0) path[path.length - 1] = { x: ex, y: ey };
        else path.push({ x: ex, y: ey });
        return path;
    }

    static followPath(transform, state, targetPos, speed, engine) {
        const now = Date.now();
        const needsRecalc = !state.path || 
                          state.pathTargetId !== state.targetId || 
                          (state.lastPathCalcTime && now - state.lastPathCalcTime > 2000);

        if (needsRecalc) {
            state.path = this.findPath(transform.x, transform.y, targetPos.x, targetPos.y, engine);
            state.pathTargetId = state.targetId;
            state.pathIndex = 0;
            state.lastPathCalcTime = now;
        }

        if (state.path && state.path.length === 0) {
            transform.vx *= 0.5;
            transform.vy *= 0.5;
            return false;
        }

        if (state.path && state.pathIndex < state.path.length) {
            const nextWp = state.path[state.pathIndex];
            const dx = nextWp.x - transform.x;
            const dy = nextWp.y - transform.y;
            const distSq = dx * dx + dy * dy;
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
                return false;
            }
        }

        const dx = targetPos.x - transform.x;
        const dy = targetPos.y - transform.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.1) {
            transform.vx = (dx / d) * speed;
            transform.vy = (dy / d) * speed;
        }
        return d < 20;
    }
}
