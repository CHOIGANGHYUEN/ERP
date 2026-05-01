/**
 * 🌊 WaterPlantRenderer
 * 연꽃, 미역, 갈대 등 수생 및 수변 식물을 렌더링합니다.
 */
export const WaterPlantRenderer = {
    /** 🌊 연꽃 렌더링 */
    drawLotus(ctx, t, v, isWithered, wind) {
        const s = 1.0;
        const wv = wind ? wind.getSway(t.x, t.y) : { x: 0, y: 0 };
        const swayX = isWithered ? 0 : wv.x * 2;
        
        ctx.fillStyle = isWithered ? '#4e342e' : '#2e7d32';
        ctx.fillRect(-3*s + swayX, -0.5*s, 6*s, s);
        ctx.fillRect(-2.5*s + swayX, -1*s, 5*s, s*2);
        if (!isWithered) {
            ctx.fillStyle = '#f48fb1';
            ctx.fillRect(-s + swayX, -2*s, 2*s, s);
            ctx.fillRect(-0.5*s + swayX, -2.5*s, s, 0.5*s);
        }
    },

    /** 🌊 미역/해초 렌더링 */
    drawKelp(ctx, t, v, time, isWithered, wind) {
        const s = 1.2;
        const wv = wind ? wind.getSway(t.x, t.y) : { x: 0, y: 0 };
        const osc = Math.sin(time * 0.003 + t.x * 0.5) * 4;
        const totalSway = isWithered ? 0 : (wv.x * 10 + osc);
        
        ctx.fillStyle = isWithered ? '#3e2723' : '#004d40';
        for(let i=0; i<4; i++) {
            const sway = totalSway * (i/4);
            ctx.fillRect(sway - s/2, -i*3, s, 3.5);
            ctx.fillRect(sway - s*1.5, -i*3 - 1, s, s);
            ctx.fillRect(sway + s*0.5, -i*3 - 2, s, s);
        }
    },

    /** 🌾 갈대 렌더링 */
    drawReed(ctx, t, v, isWithered, time, wind) {
        const s = 0.8;
        const wv = wind ? wind.getSway(t.x, t.y) : { x: 0, y: 0 };
        const osc = Math.sin(time * 0.005 + t.x * 0.2) * 2;
        const totalSway = isWithered ? 0 : (wv.x * 15 + osc);
        
        ctx.fillStyle = isWithered ? '#5d4037' : '#2e7d32';
        ctx.fillRect(-0.2, -6, 0.5, 6);
        ctx.fillRect(totalSway*0.5 - 0.2, -12, 0.5, 6);
        ctx.fillStyle = isWithered ? '#3e2723' : '#5d4037';
        ctx.fillRect(totalSway - 0.8, -14, 1.6, 3);
    }
};
