/**
 * 🌵 CactusRenderer
 * 선인장 자원의 구체적인 그리기 로직을 담당합니다.
 */
export class CactusRenderer {
    static draw(ctx, t, v, isWithered, wind, time, entity) {
        const s = 1.2;
        const color = isWithered ? '#795548' : '#2e7d32';
        const dark = '#1b5e20', light = '#81c784';
        
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const swayX = isWithered ? 0 : wv.x * 2;

        const health = entity?.components?.get('Health');
        if (health?.hitTimer > 0) ctx.translate(Math.sin(time * 0.08) * 1.5, 0);

        ctx.fillStyle = color;
        ctx.fillRect(-1.5*s + swayX, -8*s, 3*s, 8*s);
        ctx.fillRect(-4*s + swayX, -6*s, 3*s, 1.5*s);
        ctx.fillRect(-4*s + swayX, -7.5*s, 1.5*s, 1.5*s);
        ctx.fillRect(1*s + swayX, -5*s, 3*s, 1.5*s);
        ctx.fillRect(2.5*s + swayX, -6.5*s, 1.5*s, 1.5*s);

        if (!isWithered) {
            ctx.fillStyle = light;
            ctx.fillRect(-s + swayX, -7*s, 0.5, 0.5);
            ctx.fillRect(s + swayX, -4*s, 0.5, 0.5);
            ctx.fillRect(-3*s + swayX, -7.5*s, 0.5, 0.5);
            ctx.fillStyle = dark;
            ctx.fillRect(-0.5*s + swayX, -2*s, 0.5, 0.5);
        }
    }
}
