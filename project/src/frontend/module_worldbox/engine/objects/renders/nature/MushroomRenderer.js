/**
 * 🍄 MushroomRenderer
 * 신비로운 숲의 버섯을 고퀄리티 도트로 렌더링합니다.
 */
export const MushroomRenderer = {
    draw(ctx, t, v, isWithered, time, wind) {
        const s = 1.0;
        const color = isWithered ? '#8d6e63' : (v.color || '#d32f2f');
        const lightColor = '#ffffff';
        const darkColor = '#4e342e';
        
        // 🌬️ 바람 영향 (버섯 갓만 살짝 흔들림)
        const wv = wind ? wind.getSway(t.x, t.y) : { x: 0, y: 0 };
        const swayX = isWithered ? 0 : wv.x * 2;

        // 1. 버섯 기둥 (Stalk) - 엠보싱 효과
        ctx.fillStyle = isWithered ? '#d7ccc8' : '#f5f5f5'; 
        ctx.fillRect(-s * 0.8, 0, s * 1.6, s * 2); // 메인 기둥
        ctx.fillStyle = isWithered ? '#a1887f' : '#e0e0e0';
        ctx.fillRect(s * 0.4, 0, s * 0.4, s * 2); // 기둥 그림자
        
        // 2. 버섯 갓 (Cap) - 볼륨감 있는 둥근 형태
        // 🌚 [Readability] 갓 테두리 (Outline)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-2.7*s + swayX, -2.2*s, 5.4*s, 3.2*s);

        ctx.fillStyle = color;
        ctx.fillRect(-2.5*s + swayX, -1.2*s, 5*s, s * 1.8); // 메인 갓 (바람 영향 적용)
        ctx.fillRect(-2*s + swayX, -2*s, 4*s, s * 0.8);     // 갓 윗부분
        
        // 3. 갓 하단 그림자 (Gills Area)
        ctx.fillStyle = darkColor;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(-2.5*s, 0, 5*s, 0.4);
        ctx.globalAlpha = 1.0;

        // 4. 갓 위의 점무늬 (Spots) - 프리미엄 디테일
        if (!isWithered) {
            ctx.fillStyle = lightColor;
            ctx.fillRect(-1.2*s, -1.2*s, 0.8, 0.8);
            ctx.fillRect(0.5*s, -1.6*s, 0.8, 0.8);
            ctx.fillRect(0.2*s, -0.6*s, 0.6, 0.6);
            ctx.fillRect(-1.8*s, -0.4*s, 0.6, 0.6);
        }
        
        // 5. 미세한 발광 효과 (신비로운 느낌)
        if (!isWithered && (v.type === 'wild_mushroom' || color === '#9c27b0')) {
            ctx.shadowBlur = 5;
            ctx.shadowColor = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-2.6*s, -2.1*s, 5.2*s, 2.5*s);
            ctx.shadowBlur = 0;
        }
    }
};
