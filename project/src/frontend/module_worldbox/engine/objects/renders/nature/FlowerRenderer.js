/**
 * 🌸 FlowerRenderer
 */
export const FlowerRenderer = {
    draw(ctx, t, v, isWithered, time, wind) {
        const wv = wind ? wind.getSway(t.x, t.y) : { x: 0, y: 0 };
        const osc = Math.sin(time * 0.008 + t.x * 0.2) * 1.0;
        const sway = isWithered ? 0 : (wv.x * 12 + osc);
        
        // 🌚 [Readability] 줄기 그림자/테두리
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-0.4, -3.5, 0.9, 3.5);

        // 1. 줄기 (Stem)
        ctx.fillStyle = isWithered ? '#5d4037' : '#2e7d32';
        ctx.fillRect(-0.2, -1.5, 0.5, 1.5);
        ctx.fillRect(sway * 0.2 - 0.2, -3.5, 0.5, 2.0);
        
        // 2. 꽃머리 (Flower Head)
        if (!isWithered) {
            const headX = sway * 0.5;
            const headY = -4.0;
            ctx.fillStyle = v.color || '#ff4081';
            const ps = 1.0;
            // 십자 모양 꽃잎
            ctx.fillRect(headX - ps, headY, ps, ps);
            ctx.fillRect(headX + ps, headY, ps, ps);
            ctx.fillRect(headX, headY - ps, ps, ps);
            ctx.fillRect(headX, headY + ps, ps, ps);
            // 중앙 수술 (Yellow Center)
            ctx.fillStyle = '#ffeb3b';
            ctx.fillRect(headX, headY, ps, ps);
        }
    }
};
