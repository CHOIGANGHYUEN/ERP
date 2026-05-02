import BrushStrategy from './BrushStrategy.js';

/**
 * 📍 SingleBrush
 * 단일 좌표에 브러쉬 효과를 즉시 적용합니다.
 */
export default class SingleBrush extends BrushStrategy {
    apply(start, end, size, toolConfig) {
        this._paint(end.x, end.y, toolConfig);
    }
}
