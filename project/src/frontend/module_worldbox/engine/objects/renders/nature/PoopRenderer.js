/**
 * 💩 PoopRenderer
 * 동물의 배설물을 리얼한 도트 스타일로 표현합니다.
 * 축적된 영양분(fertilityValue)에 따라 크기와 채도가 미세하게 변합니다.
 */
export const PoopRenderer = {
    draw(ctx, t, v, wind) {
        const s = 1.0;
        const fertility = v.fertilityValue || 1.0;
        
        // 🌬️ 바람 영향 (미세한 흔들림)
        const wv = wind ? wind.getSway(t.x, t.y) : { x: 0, y: 0 };
        const swayX = wv.x * 0.5;
        
        ctx.save();
        ctx.translate(swayX, 0);
        
        // 1. 색상 설계 (영양가에 따른 채도 및 명도 변화)
        const baseColor = '#5d4037';
        const darkColor = '#3e2723';
        const shadowColor = '#26140f';
        const highlightColor = fertility > 10 ? '#a1887f' : '#8d6e63';
        
        // 2. 쉐도우 (Ground Shadow)
        ctx.fillStyle = shadowColor;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(-2*s, -0.2*s, 4*s, 0.4);
        ctx.globalAlpha = 1.0;

        // 3. 레이어드 메인 바디 (3단 적층 구조)
        // 1층 (Base)
        ctx.fillStyle = darkColor;
        ctx.fillRect(-2*s, -1.2*s, 4*s, 1.2*s);
        ctx.fillStyle = baseColor;
        ctx.fillRect(-1.8*s, -1.2*s, 3.2*s, 0.8*s);
        
        // 2층 (Middle)
        ctx.fillStyle = darkColor;
        ctx.fillRect(-1.2*s, -2.2*s, 2.4*s, 1*s);
        ctx.fillStyle = baseColor;
        ctx.fillRect(-1*s, -2.2*s, 1.8*s, 0.7*s);
        
        // 3층 (Top)
        ctx.fillStyle = darkColor;
        ctx.fillRect(-0.6*s, -3*s, 1.2*s, 0.8*s);
        ctx.fillStyle = baseColor;
        ctx.fillRect(-0.4*s, -3*s, 0.8*s, 0.6*s);
        
        // 4. 프리미엄 하이라이트 (Glossy Shine)
        if (fertility > 5) {
            ctx.fillStyle = highlightColor;
            ctx.fillRect(-1.5*s, -1*s, 0.6, 0.6);
            ctx.fillRect(-0.8*s, -2*s, 0.8, 0.8);
            ctx.fillRect(-0.2*s, -2.8*s, 0.5, 0.5);
        }
        ctx.restore();
    }
};
