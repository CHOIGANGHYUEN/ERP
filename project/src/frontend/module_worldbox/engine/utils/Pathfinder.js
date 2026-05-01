export default class Pathfinder {
    /**
     * A* 기반의 간단한 그리드 경로 탐색 (장애물 우회용)
     * @param {number} sx 시작 X
     * @param {number} sy 시작 Y
     * @param {number} ex 목표 X
     * @param {number} ey 목표 Y
     * @param {EntityManager} em 엔티티 매니저 (건물 정보 등)
     * @param {number} gridSize 그리드 크기 (기본 20)
     * @returns {Array<{x,y}>} 경로 웨이포인트 배열 (시작점 제외, 도착점 포함)
     */
    static findPath(sx, sy, ex, ey, em, gridSize = 20) {
        // 너무 가까우면 직접 이동
        const dx = ex - sx;
        const dy = ey - sy;
        if (dx * dx + dy * dy < gridSize * gridSize * 4) {
            return [{ x: ex, y: ey }];
        }

        // 휴리스틱 함수
        const heuristic = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

        const startNode = { x: Math.floor(sx / gridSize), y: Math.floor(sy / gridSize) };
        const endNode = { x: Math.floor(ex / gridSize), y: Math.floor(ey / gridSize) };

        // 장애물(건물) 그리드 매핑
        const obstacles = new Set();
        for (const bId of em.buildingIds) {
            const building = em.entities.get(bId);
            if (!building) continue;
            const t = building.components.get('Transform');
            const v = building.components.get('Visual');
            if (t && v) {
                const bRadius = (v.size || 40) * 0.45; // KinematicSystem과 동일한 반경
                const minGridX = Math.floor((t.x - bRadius) / gridSize);
                const maxGridX = Math.floor((t.x + bRadius) / gridSize);
                const minGridY = Math.floor((t.y - bRadius) / gridSize);
                const maxGridY = Math.floor((t.y + bRadius) / gridSize);
                
                for (let x = minGridX; x <= maxGridX; x++) {
                    for (let y = minGridY; y <= maxGridY; y++) {
                        obstacles.add(`${x},${y}`);
                    }
                }
            }
        }

        // 목표 지점이 장애물 내부라면, 가장 가까운 빈 공간을 진짜 목표로 수정 (또는 허용)
        if (obstacles.has(`${endNode.x},${endNode.y}`)) {
            // 장애물 내부라도 일단 길찾기 목적지는 허용해야 함 (건물 근처까지 가야 하므로)
            obstacles.delete(`${endNode.x},${endNode.y}`); 
        }

        const openSet = [startNode];
        const cameFrom = new Map();
        
        const gScore = new Map();
        gScore.set(`${startNode.x},${startNode.y}`, 0);
        
        const fScore = new Map();
        fScore.set(`${startNode.x},${startNode.y}`, heuristic(startNode.x, startNode.y, endNode.x, endNode.y));

        let attempts = 0;
        const MAX_ATTEMPTS = 500; // 성능을 위해 탐색 제한

        while (openSet.length > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;
            
            // 가장 fScore가 낮은 노드 찾기
            let currentIdx = 0;
            for (let i = 1; i < openSet.length; i++) {
                const id1 = `${openSet[i].x},${openSet[i].y}`;
                const id2 = `${openSet[currentIdx].x},${openSet[currentIdx].y}`;
                if ((fScore.get(id1) || Infinity) < (fScore.get(id2) || Infinity)) {
                    currentIdx = i;
                }
            }
            
            const current = openSet[currentIdx];
            const currentId = `${current.x},${current.y}`;

            if (current.x === endNode.x && current.y === endNode.y) {
                // 경로 재구성
                const path = [];
                let currId = currentId;
                while (cameFrom.has(currId)) {
                    const node = cameFrom.get(currId);
                    path.unshift({ 
                        x: node.x * gridSize + gridSize/2, 
                        y: node.y * gridSize + gridSize/2 
                    });
                    currId = `${node.px},${node.py}`;
                }
                // 마지막은 실제 정확한 목표 지점으로 덮어씌움
                if (path.length > 0) {
                    path[path.length - 1] = { x: ex, y: ey };
                } else {
                    path.push({ x: ex, y: ey });
                }
                return path;
            }

            openSet.splice(currentIdx, 1);

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 },
                { x: current.x + 1, y: current.y + 1 },
                { x: current.x - 1, y: current.y - 1 },
                { x: current.x + 1, y: current.y - 1 },
                { x: current.x - 1, y: current.y + 1 }
            ];

            for (const neighbor of neighbors) {
                const neighborId = `${neighbor.x},${neighbor.y}`;
                
                if (obstacles.has(neighborId)) continue; // 건물 충돌 영역

                const tentativeGScore = gScore.get(currentId) + (neighbor.x !== current.x && neighbor.y !== current.y ? 1.414 : 1);

                if (tentativeGScore < (gScore.get(neighborId) || Infinity)) {
                    cameFrom.set(neighborId, { x: neighbor.x, y: neighbor.y, px: current.x, py: current.y });
                    gScore.set(neighborId, tentativeGScore);
                    fScore.set(neighborId, tentativeGScore + heuristic(neighbor.x, neighbor.y, endNode.x, endNode.y));
                    
                    if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        // 목적지 도달 실패 시, 혹은 제한 횟수 초과 시 직선 반환 (Fall back)
        return [{ x: ex, y: ey }];
    }

    /**
     * 상태에 캐싱된 경로를 따라 이동하도록 속도를 설정합니다.
     */
    static followPath(transform, state, targetPos, speed, em) {
        // 경로가 없거나, 타겟이 바뀌었거나, 목적지가 너무 멀어진 경우 경로 재탐색
        if (!state.path || state.pathTargetId !== state.targetId) {
            state.path = this.findPath(transform.x, transform.y, targetPos.x, targetPos.y, em);
            state.pathTargetId = state.targetId;
            state.pathIndex = 0;
        }

        if (state.path && state.pathIndex < state.path.length) {
            const nextWaypoint = state.path[state.pathIndex];
            const dx = nextWaypoint.x - transform.x;
            const dy = nextWaypoint.y - transform.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 100) { // 웨이포인트 반경 도달
                state.pathIndex++;
            }
            
            // 다시 가져오기 (index가 증가했을 수 있으므로)
            if (state.pathIndex < state.path.length) {
                const currentWp = state.path[state.pathIndex];
                const nx = currentWp.x - transform.x;
                const ny = currentWp.y - transform.y;
                const ndist = Math.sqrt(nx * nx + ny * ny);
                if (ndist > 0.1) {
                    transform.vx = (nx / ndist) * speed;
                    transform.vy = (ny / ndist) * speed;
                }
                return false;
            }
        }

        // 경로의 끝에 도달했거나 경로가 없는 경우 (직접 이동)
        const dx = targetPos.x - transform.x;
        const dy = targetPos.y - transform.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.1) {
            transform.vx = (dx / dist) * speed;
            transform.vy = (dy / dist) * speed;
        }
        return true;
    }
}
