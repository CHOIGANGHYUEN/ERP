/**
 * 🌊 WaterRenderer
 * 수역(Water)의 물결 애니메이션 및 해안가 파도 효과를 담당합니다.
 * [Expert Design] 시간 기반 오프셋과 노이즈 패턴을 활용한 역동적인 수면 연출
 */
import { textureManager } from "../../../systems/render/TextureManager";
export const WaterRenderer = {
    _cachedPattern: null,
    _lastTexture: null,

    /**
     * 🖌️ 수면 애니메이션 렌더링
     * @param {CanvasRenderingContext2D} ctx - 렌더링 컨텍스트
     * @param {number} x, y, width, height - 렌더링 영역
     * @param {number} time - 시뮬레이션 시간 (프레임 동기화용)
     */
    renderWater(ctx, x, y, width, height, time) {
        const tex = textureManager.getTexture('pattern_water');
        if (!tex) return;

        // 🚀 [Optimization] 패턴 캐싱 (매 호출마다 createPattern 호출 방지)
        if (this._lastTexture !== tex || !this._cachedPattern) {
            this._cachedPattern = ctx.createPattern(tex, 'repeat');
            this._lastTexture = tex;
        }

        const pattern = this._cachedPattern;
        if (!pattern) return;

        ctx.save();

        // 1. 🌊 물결 패턴 (Subtle Ripples)
        const offsetX = Math.sin(time * 0.001) * 10;
        const offsetY = (time * 0.02) % 64; // 흐르는 효과

        ctx.save();
        ctx.translate(x + offsetX, y + offsetY);
        ctx.globalAlpha = 0.25; // 투명도 약간 하향 (성능 및 시각적 안정성)
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = pattern;

        // 패턴을 영역에 맞게 채움
        ctx.fillRect(-offsetX, -offsetY, width, height);
        ctx.restore();

        // 2. ✨ 해안가 파도 효과 (Shore Waves)
        // [Optimization] 선 그리기 스타일 미리 설정
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([15, 25]);
        ctx.lineDashOffset = time * 0.04;

        ctx.beginPath();
        // [Expert Logic] 렌더링 부하를 줄이기 위해 간격을 60px로 상향
        for (let i = 0; i < width; i += 60) {
            const waveY = Math.sin(time * 0.004 + i * 0.08) * 2.5;
            ctx.moveTo(x + i, y + waveY);
            ctx.lineTo(x + i + 30, y + waveY + 1.5);
        }
        ctx.stroke();

        ctx.restore();
    }
};
