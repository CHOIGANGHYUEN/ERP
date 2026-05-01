/**
 * 🌿 GrassRenderer
 * 바람에 흔들리는 풀잎과 지면 식생을 렌더링합니다.
 */
export const GrassRenderer = {
    draw(ctx, t, v, isWithered, time, wind) {
        const s = 0.8;
        const color = isWithered ? '#8d6e63' : v.color || '#4caf50';
        const darkColor = this.adjustColor(color, -40);
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };

        // 3개에서 4개로 풀잎 수 증가 및 무작위성 부여
        for (let i = 0; i < 4; i++) {
            const phase = i * 1.5 + t.x * 0.15 + t.y * 0.1;
            const osc = Math.sin(time * 0.005 + phase) * 0.6;
            const sway = isWithered ? 0 : (wv.x * 7 + osc);
            const ox = (i - 1.5) * 1.4;
            // 위치와 높이에 고유한 무작위성(Deterministic Noise) 부여
            const height = 2 + (Math.sin(t.x * i) * 1.5); 
            
            // 🌚 [Readability] 어두운 테두리 먼저 그리기 (Outline)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(ox - 0.5, -height - 0.5, s + 1, height + 1);

            ctx.fillStyle = (i % 2 === 0) ? color : darkColor;
            ctx.fillRect(ox, -1, s, 1.5);
            ctx.fillRect(ox + (sway * 0.2), -height, s, height - 1);
            
            // 프리미엄 디테일: 풀잎 끝부분의 미세한 휘어짐
            if (!isWithered && height > 2.5) {
                ctx.fillStyle = this.adjustColor(color, 20);
                ctx.fillRect(ox + (sway * 0.6), -height - 0.5, s, 0.8);
            }
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
