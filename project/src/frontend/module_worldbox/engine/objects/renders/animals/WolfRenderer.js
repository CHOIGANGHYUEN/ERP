/** 🐺 WolfRenderer (State-Focused Masterpiece)
 * 포식자의 본능이 느껴지는 수면, 사냥, 질주 상태별 전용 스프라이트를 구현합니다.
 */
export const WolfRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const isRunning = ['run', 'hunt', 'flee'].includes(mode);
        const isSleeping = mode === 'sleep';
        const isEating = mode === 'eat' || mode === 'forage';
        const isDead = mode === 'die';

        const C = {
            base: '#64748b',
            mid: '#475569',
            deep: '#1e293b',
            mane: '#94a3b8',
            highlight: '#cbd5e1',
            eye: '#ef4444',
            eye_glow: 'rgba(239, 68, 68, 0.4)',
            nose: '#0f172a',
            ground: 'rgba(0, 0, 0, 0.2)'
        };

        const dot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.max(1, w * s), Math.max(1, h * s));
        };

        // 0. 접지 그림자
        if (!isDead) {
            dot(-7, 0.5, 14, 2, C.ground);
        }

        // 1. 다리 (역동적 질주 vs 조용한 보행)
        if (!isSleeping && !isDead) {
            const legOsc = Math.sin(frameIdx * Math.PI);
            const stride = isRunning ? 4.5 : 3.0;
            const drawLeg = (ox, oy, osc, isFront) => {
                const color = isFront ? C.base : C.deep;
                const tx = ox + (osc * stride);
                dot(tx, oy, 1.5, 3, color);
                dot(tx, oy + 2.5, 1.5, 0.8, C.nose);
            };
            drawLeg(-4, 0, -legOsc, false);
            drawLeg(-1, 0, -legOsc, false);
            drawLeg(2, 0, legOsc, true);
            drawLeg(5, 0, legOsc, true);
        }

        ctx.save();
        if (isDead) {
            ctx.rotate(Math.PI / 2);
            ctx.translate(0, -3 * s);
        }

        // 2. 꼬리 (상태별 각도 조절)
        let tailAngle = isRunning ? -0.2 : 0.4;
        if (isSleeping) tailAngle = 1.2; // 몸 쪽으로 말기
        const tailOsc = Math.sin(frameIdx * Math.PI) * 0.3;
        
        ctx.save();
        ctx.translate(-5 * s, -3.5 * s);
        ctx.rotate(tailAngle + tailOsc);
        dot(-4.5, -1, 5, 3, C.deep);
        dot(-4, -0.5, 4, 2, C.mid);
        ctx.restore();

        // 3. 몸통 (수면 시 웅크리기 표현)
        if (isSleeping) {
            dot(-5, -3.5, 10, 3.5, C.deep); // 더 낮게 깔림
            dot(-4.5, -4, 9, 3, C.mid);
        } else {
            dot(-5.5, -4.5, 10.5, 4.5, C.deep);
            dot(-5, -5, 10, 4, C.mid);
            // 갈기
            dot(1, -6.5, 4.5, 5, C.mane);
            dot(2, -6, 3.5, 4.5, C.highlight);
        }

        // 4. 머리 (공격적 주둥이 및 눈 상태)
        ctx.save();
        let hX = 4; let hY = -6.5;
        if (isEating) { hX += 1; hY += 3; }
        else if (isRunning) { hX += 2; hY += 0.5; }
        else if (isSleeping) { hX -= 1.5; hY += 3.5; }

        ctx.translate(hX * s, hY * s);

        // 두상
        dot(0, 0, 4.5, 4, C.mid);
        dot(3.8, 1.5, 3.5, 2.2, C.base); // 주둥이
        dot(6.8, 1.5, 1, 1, C.nose);    // 코

        // 귀 (사냥 시 Flat Ears)
        const earRot = isRunning ? -0.6 : (isSleeping ? 0.4 : 0);
        ctx.save();
        ctx.rotate(earRot);
        dot(0.5, -2, 1.8, 3, C.deep);
        dot(1, -1.5, 1, 2, C.mid);
        ctx.restore();

        // 눈
        if (isSleeping) {
            dot(2.5, 1.5, 1.5, 0.5, C.deep); // 감은 눈
        } else if (!isDead) {
            dot(2, 0.5, 3, 2.5, C.eye_glow); // 안광 번짐
            dot(2.8, 1.2, 1.8, 1, C.eye);
            dot(2.8, 1.2, 0.5, 0.5, '#fff');
        } else {
            dot(2.8, 1.2, 1.5, 1, C.deep); // 죽은 눈
        }

        ctx.restore();
        ctx.restore();
    }
};
