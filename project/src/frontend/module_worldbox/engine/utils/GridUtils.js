/**
 * 🗺️ GridUtils
 * 그리드 기반 연산(선 긋기, 채우기 등)을 위한 순수 유틸리티 함수 모음입니다.
 */
export default class GridUtils {
    /**
     * 📏 브레즌햄(Bresenham) 알고리즘을 이용해 두 지점 사이의 모든 좌표를 반환합니다.
     */
    static getLine(x0, y0, x1, y1) {
        const points = [];
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let currX = x0;
        let currY = y0;

        while (true) {
            points.push({ x: currX, y: currY });
            if (currX === x1 && currY === y1) break;
            
            let e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                currX += sx;
            }
            if (e2 < dx) {
                err += dx;
                currY += sy;
            }
        }
        return points;
    }

    /**
     * 🌊 Flood Fill (BFS) 알고리즘을 이용해 연결된 영역의 좌표들을 반환합니다.
     */
    static getFill(startX, startY, mapWidth, mapHeight, checkFn) {
        const points = [];
        const visited = new Set();
        const queue = [{ x: startX, y: startY }];
        const startKey = (startY << 16) | startX;
        visited.add(startKey);

        const targetValue = checkFn(startX, startY);

        while (queue.length > 0) {
            const { x, y } = queue.shift();
            points.push({ x, y });

            // 4방향 탐색
            const neighbors = [
                { x: x + 1, y }, { x: x - 1, y },
                { x, y: y + 1 }, { x, y: y - 1 }
            ];

            for (const n of neighbors) {
                if (n.x < 0 || n.x >= mapWidth || n.y < 0 || n.y >= mapHeight) continue;
                
                const key = (n.y << 16) | n.x;
                if (!visited.has(key) && checkFn(n.x, n.y) === targetValue) {
                    visited.add(key);
                    queue.push(n);
                }
            }
            
            // 🚀 [Safety] 너무 큰 영역 채우기 방지 (성능 보호)
            if (points.length > 5000) break;
        }

        return points;
    }
}
