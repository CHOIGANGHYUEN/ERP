import BrushStrategy from './BrushStrategy.js';

/**
 * 💨 SprayBrush
 * 지정된 반경 내에 무작위로 효과를 뿌립니다.
 */
export default class SprayBrush extends BrushStrategy {
    apply(start, end, size, toolConfig) {
        const count = toolConfig.count || 5;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * size;
            const tx = Math.floor(end.x + Math.cos(angle) * dist);
            const ty = Math.floor(end.y + Math.sin(angle) * dist);
            
            if (tx >= 0 && tx < this.engine.mapWidth && ty >= 0 && ty < this.engine.mapHeight) {
                this._paint(tx, ty, toolConfig);
            }
        }
    }
}
