/**
 * 💎 RockRenderer — 다각형 기반의 입체적 암석 및 광석 렌더링
 * [Expert Design] 각진 면(Facet) 연출과 광석별 고유 광택 효과 적용
 */
export const RockRenderer = {
    draw(ctx, t, v, isWithered, entity, time) {
        const s = v.size || 15;
        const sub = v.subtype || 'stone';

        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.15) * 2.5, 0);
        }

        // 🎨 광석 타입별 컬러 팔레트 정의
        const palette = this.getPalette(sub, v.color);
        
        ctx.save();
        
        // 1. 🌑 바닥 그림자 (개별 렌더러에서의 추가 그림자)
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(0, s * 0.1, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. 🪨 메인 바디 (Polygonal Faceting)
        // 불규칙한 6~8각형으로 바위 느낌 연출
        ctx.fillStyle = palette.base;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0);
        ctx.lineTo(-s * 0.6, -s * 0.3);
        ctx.lineTo(-s * 0.3, -s * 0.6);
        ctx.lineTo(s * 0.2, -s * 0.7);
        ctx.lineTo(s * 0.5, -s * 0.4);
        ctx.lineTo(s * 0.6, -s * 0.1);
        ctx.lineTo(s * 0.4, s * 0.2);
        ctx.lineTo(-s * 0.2, s * 0.1);
        ctx.closePath();
        ctx.fill();

        // 3. ✨ 면(Facet) 분할 및 하이라이트
        ctx.fillStyle = palette.light;
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.6);
        ctx.lineTo(s * 0.2, -s * 0.7);
        ctx.lineTo(0, -s * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.dark;
        ctx.beginPath();
        ctx.moveTo(s * 0.5, -s * 0.4);
        ctx.lineTo(s * 0.6, -s * 0.1);
        ctx.lineTo(s * 0.2, -s * 0.2);
        ctx.closePath();
        ctx.fill();

        // 4. 💎 광석 디테일 (Gold, Gems 등)
        if (this.isValuable(sub)) {
            const sparkle = (Math.sin(time * 0.005 + t.x) + 1) * 0.5;
            ctx.fillStyle = palette.gem || '#fff';
            
            // 광석 박힌 무늬
            for(let i=0; i<3; i++) {
                const ox = (Math.sin(i * 1.5) * s * 0.3);
                const oy = (Math.cos(i * 1.5) * s * 0.3) - s * 0.3;
                ctx.beginPath();
                ctx.arc(ox, oy, s * 0.1, 0, Math.PI * 2);
                ctx.fill();
                
                // 반짝임 효과
                if (sparkle > 0.8) {
                    ctx.save();
                    ctx.translate(ox, oy);
                    ctx.rotate(time * 0.01);
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(-1, -s*0.2, 2, s*0.4);
                    ctx.fillRect(-s*0.2, -1, s*0.4, 2);
                    ctx.restore();
                }
            }
        }

        ctx.restore();
    },

    getPalette(sub, defaultColor) {
        const baseColor = defaultColor || '#90a4ae';
        
        // 특정 타입에 따른 프리미엄 팔레트
        switch(sub) {
            case 'gold': return { base: '#fbc02d', light: '#fff176', dark: '#f57f17', gem: '#ffffff' };
            case 'iron': return { base: '#78909c', light: '#b0bec5', dark: '#455a64', gem: '#cfd8dc' };
            case 'coal': return { base: '#212121', light: '#616161', dark: '#000000', gem: '#424242' };
            case 'gems': return { base: '#7b1fa2', light: '#ba68c8', dark: '#4a148c', gem: '#e1bee7' };
            case 'obsidian': return { base: '#1a237e', light: '#3f51b5', dark: '#000051', gem: '#c5cae9' };
            default: return { 
                base: baseColor, 
                light: this.adjustColor(baseColor, 30), 
                dark: this.adjustColor(baseColor, -30) 
            };
        }
    },

    isValuable(sub) {
        return ['gold', 'gems', 'iron', 'silver', 'obsidian', 'diamond'].some(v => sub.includes(v));
    },

    adjustColor(color, amount) {
        if (!color || typeof color !== 'string' || !color.startsWith('#')) return color;
        const num = parseInt(color.slice(1), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return `#${(g | (r << 8) | (b << 16)).toString(16).padStart(6, '0')}`;
    }
};

