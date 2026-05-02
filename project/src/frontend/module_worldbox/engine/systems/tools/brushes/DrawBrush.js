import BrushStrategy from './BrushStrategy.js';
import GridUtils from '../../../utils/GridUtils.js';

/**
 * 🖋️ DrawBrush
 * 마우스 이동 궤적을 따라 선을 그리며 효과를 적용합니다.
 */
export default class DrawBrush extends BrushStrategy {
    apply(start, end, size, toolConfig) {
        if (!start) {
            this._paint(end.x, end.y, toolConfig);
            return;
        }

        const points = GridUtils.getLine(
            Math.floor(start.x), Math.floor(start.y),
            Math.floor(end.x), Math.floor(end.y)
        );

        for (const p of points) {
            // 브러쉬 크기에 따른 두께 적용 (간단한 사각형 반경)
            const half = Math.floor(size / 2);
            for (let dy = -half; dy <= half; dy++) {
                for (let dx = -half; dx <= half; dx++) {
                    const tx = p.x + dx;
                    const ty = p.y + dy;
                    if (tx >= 0 && tx < this.engine.mapWidth && ty >= 0 && ty < this.engine.mapHeight) {
                        this._paint(tx, ty, toolConfig);
                    }
                }
            }
        }
    }
}
