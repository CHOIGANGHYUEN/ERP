/** 🐄 CowRenderer (State-Focused Masterpiece)
 * 각 상태(수면, 식사, 질주 등)에 최적화된 스프라이트 변화를 구현합니다.
 */
export const CowRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const isSleeping = mode === 'sleep';
        const isEating = mode === 'eat' || mode === 'forage';
        const isRunning = ['run', 'hunt', 'flee'].includes(mode);
        const isDead = mode === 'die';
        
        const C = {
            base: '#ffffff',
            spot: '#1e293b',
            shadow: '#cbd5e1',
            deep: '#64748b',
            nose: '#fda4af',
            nose_dark: '#f43f5e',
            horn: '#fef3c7',
            hoof: '#0f172a',
            ground: 'rgba(0, 0, 0, 0.15)'
        };

        const dot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.max(1, w * s), Math.max(1, h * s));
        };

        // 0. 접지 그림자
        if (!isDead) {
            dot(-8, 1, 16, 2.5, C.ground);
        }

        // 1. 다리 (상태별 보폭 및 관절 변화)
        if (!isSleeping && !isDead) {
            const legOsc = Math.sin(frameIdx * Math.PI);
            const stride = isRunning ? 3.5 : 2.2;
            const drawLeg = (ox, oy, osc, isFront) => {
                const color = isFront ? C.base : C.shadow;
                const tx = ox + (osc * stride);
                dot(tx, oy, 2.2, 3.5, color);
                dot(tx, oy + 3.5, 2.2, 0.8, C.hoof);
            };
            drawLeg(-4, 0, -legOsc, false);
            drawLeg(2, 0, -legOsc, false);
            drawLeg(-1, 0, legOsc, true);
            drawLeg(5, 0, legOsc, true);
        }

        ctx.save();
        if (isDead) {
            ctx.rotate(Math.PI / 2);
            ctx.translate(0, -4 * s);
        }

        // 2. 꼬리 (질주 시 각도 변화)
        const tailAngle = isRunning ? -0.8 : (Math.sin(frameIdx * Math.PI) * 0.2);
        ctx.save();
        ctx.translate(-5.5 * s, -6 * s);
        ctx.rotate(tailAngle);
        dot(-1.5, 0, 1.2, 4.5, C.spot);
        dot(-2, 4.5, 2.2, 2.2, C.deep); // 꼬리 끝 Tassel
        ctx.restore();

        // 3. 몸통 (기본 구조 및 얼룩)
        dot(-6, -7, 12, 7.5, C.shadow);
        dot(-5.5, -7.5, 11, 7, C.base);
        
        // 얼룩 무늬
        dot(-3, -7.5, 4, 3.5, C.spot);
        dot(2.5, -6.5, 3, 4, C.spot);
        dot(-4.5, -4, 1.5, 2, C.spot);

        // 4. 머리 (상태별 위치 및 표정)
        ctx.save();
        let hX = 5.5; let hY = -8.5;
        if (isEating) hY += 4.5;
        else if (isSleeping) { hX -= 1; hY += 1; }
        
        ctx.translate(hX * s, hY * s);

        // 두상 및 뿔
        dot(0, 0, 5, 5.5, C.base);
        dot(1, 0, 3.5, 2.5, C.spot);
        dot(0.5, -2.5, 1.2, 3, C.horn);
        dot(3.5, -2.5, 1.2, 3, C.horn);

        // 귀 (수면 시 처짐)
        const earY = isSleeping ? 1.5 : 0.5;
        dot(-1.2, earY, 1.5, 1.5, C.shadow);
        dot(4.8, earY, 1.5, 1.5, C.shadow);

        // 눈 (상태 표현)
        if (isSleeping) {
            dot(2.5, 2.5, 1.5, 0.6, C.hoof); // 감은 눈
        } else if (isDead) {
            dot(2.5, 2.5, 1.2, 1.2, C.deep); // 뒤집힌 눈
        } else {
            dot(2.5, 2.2, 1.5, 1.5, C.hoof); // 똘망한 눈
            dot(2.5, 2.2, 0.5, 0.5, '#fff');
        }

        // 주둥이
        dot(0, 4, 5, 2.5, C.nose);
        dot(1.2, 5.2, 0.8, 0.6, C.hoof); // 콧구멍
        dot(3.2, 5.2, 0.8, 0.6, C.hoof);

        ctx.restore();
        ctx.restore();
    }
};
