import BrushStrategy from './BrushStrategy.js';
import GridUtils from '../../../utils/GridUtils.js';

/**
 * 🌊 FillBrush
 * 연결된 동일 영역을 탐색하여 한 번에 채웁니다.
 */
export default class FillBrush extends BrushStrategy {
    apply(start, end, size, toolConfig) {
        const terrain = this.engine.terrainGen;
        if (!terrain) return;

        // BFS 탐색을 위한 조건 함수 (동일한 바이옴인 경우에만 확산)
        const checkFn = (x, y) => terrain.getBiomeAt(x, y);

        const points = GridUtils.getFill(
            Math.floor(end.x), Math.floor(end.y),
            this.engine.mapWidth, this.engine.mapHeight,
            checkFn
        );

        for (const p of points) {
            this._paint(p.x, p.y, toolConfig);
        }
    }
}
