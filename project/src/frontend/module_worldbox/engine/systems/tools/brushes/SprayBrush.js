import BrushStrategy from './BrushStrategy.js';

/**
 * 💨 SprayBrush
 * 지정된 반경 내에 무작위로 효과를 뿌립니다.
 */
export default class SprayBrush extends BrushStrategy {
    apply(start, end, size, toolConfig) {
        // 🚀 거리 기반 스로틀링: 너무 가깝게 이동하면 소환 건너뜀 (성능 및 시각적 안정성)
        if (start) {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 4) return; // 2칸 미만 이동 시 중단
        }

        const count = toolConfig.count || 5;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            // 🎯 원형 내 균등 분포를 위해 sqrt(random) 사용
            const dist = Math.sqrt(Math.random()) * size;
            const tx = Math.floor(end.x + Math.cos(angle) * dist);
            const ty = Math.floor(end.y + Math.sin(angle) * dist);
            
            if (tx >= 0 && tx < this.engine.mapWidth && ty >= 0 && ty < this.engine.mapHeight) {
                this._paint(tx, ty, toolConfig);
            }
        }
    }
}
