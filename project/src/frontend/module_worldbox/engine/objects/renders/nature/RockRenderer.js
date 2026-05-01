/**
 * 💎 RockRenderer
 */
export const RockRenderer = {
    draw(ctx, t, v) {
        const s = 1.5;
        const color = v.color || '#90a4ae';
        const dark = this.adjustColor(color, -45);
        const midDark = this.adjustColor(color, -20);
        const light = this.adjustColor(color, 45);

        // 1. 베이스 레이어 (어두운 면)
        ctx.fillStyle = dark;
        ctx.fillRect(-2.5*s, -1.2*s, 5*s, 2.2*s);
        
        // 2. 메인 바디 (복합 쉐이딩)
        ctx.fillStyle = midDark;
        ctx.fillRect(-2*s, -2.2*s, 4*s, s);
        ctx.fillStyle = color;
        ctx.fillRect(-1.5*s, -2.8*s, 3*s, 0.8*s);
        
        // 3. 프리미엄 하이라이트 (Edge Lighting)
        ctx.fillStyle = light;
        ctx.fillRect(-1.5*s, -2.8*s, s, 0.4*s); // 상단 엣지
        ctx.fillRect(-1.8*s, -2.2*s, 0.5, 1.5); // 왼쪽 엣지
        
        // 4. 질감 도트 (Rough Texture)
        ctx.fillStyle = dark;
        ctx.fillRect(s, -1.5*s, 0.8, 0.8);
        ctx.fillRect(-s, -0.5*s, 0.8, 0.8);
        
        // 4. 특수 타입 (금, 철 등)
        if (v.subtype === 'gold') {
            ctx.fillStyle = '#ffd600';
            ctx.fillRect(0, -1.5*s, 1, 1);
            ctx.fillRect(s, -0.5*s, 1, 1);
        } else if (v.subtype === 'iron') {
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(-s, -s, 1, 1);
        }
    },

    adjustColor(color, amount) {
        if (!color || typeof color !== 'string') return '#ffffff';
        if (color.startsWith('#')) {
            return '#' + color.replace(/^#/, '').replace(/../g, color => 
                ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).slice(-2));
        }
        return color;
    }
};
