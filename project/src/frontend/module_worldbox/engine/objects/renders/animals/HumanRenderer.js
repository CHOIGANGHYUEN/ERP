/** 👤 HumanRenderer (State-Focused Masterpiece) */
export const HumanRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const isMoving = mode === 'walk' || mode === 'run';
        const isRunning = mode === 'run';
        const isSleeping = mode === 'sleep';
        const isEating = mode === 'eat' || mode === 'forage';
        const isDead = mode === 'die';
        
        const C = {
            skin: '#ffccbc', skin_dark: '#d7ccc8', shirt: '#1976d2',
            shirt_light: '#42a5f5', shirt_dark: '#0d47a1', pants: '#263238',
            hair: '#3e2723', hair_light: '#5d4037', belt: '#4e342e',
            buckle: '#ffca28', eye: '#212121', ground: 'rgba(0, 0, 0, 0.15)'
        };

        const dot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.max(1, w * s), Math.max(1, h * s));
        };

        if (!isDead) dot(-4, 0.5, 8, 1.5, C.ground);

        const legOsc = Math.sin(frameIdx * Math.PI);
        const stride = isRunning ? 5.5 : 4.0;
        
        if (!isSleeping && !isDead) {
            const drawLeg = (ox, oy, osc, isFront) => {
                const color = isFront ? C.pants : '#10171a';
                const tx = ox + (osc * stride);
                dot(tx, oy, 2, 4, color);
                dot(tx, oy + 4, 2, 0.8, '#1a1a1a');
            };
            drawLeg(-2, -3.5, -legOsc, false);
            drawLeg(0.5, -3.5, legOsc, true);
        }

        ctx.save();
        if (isSleeping || isDead) {
            ctx.rotate(Math.PI / 2);
            ctx.translate(0, -3.5 * s);
        }

        // 몸통 (질주 시 앞으로 기울기)
        if (isRunning) ctx.rotate(0.12);

        dot(-2.5, -8.5, 5, 5, C.shirt);
        dot(-2.5, -4.5, 5, 1.2, C.shirt_dark);
        dot(-1, -8.8, 2, 0.8, C.shirt_dark);
        dot(-2.5, -4.2, 5, 1, C.belt);
        dot(-0.5, -4.2, 1.2, 1, C.buckle);

        // 머리 (식사 시 고개 숙임)
        ctx.save();
        const headBob = isMoving ? Math.sin(frameIdx * Math.PI * 2) * 0.7 : 0;
        let hY = -11;
        if (isEating) hY += 1.5;
        ctx.translate(0, hY * s + headBob * s);
        
        dot(-2.2, 0, 4.5, 4.5, C.skin);
        dot(-2.8, -1.8, 5.5, 3, C.hair);
        dot(-2.8, 0, 1.2, 3.5, C.hair);
        dot(1.6, 0, 1.2, 3.5, C.hair);
        
        if (isSleeping) {
            dot(-1.2, 2.2, 1, 0.5, C.eye);
            dot(1, 2.2, 1, 0.5, C.eye);
        } else {
            dot(-1.2, 2, 1, 1.2, C.eye);
            dot(1, 2, 1, 1.2, C.eye);
        }
        ctx.restore();

        // 팔 (상태별 동작)
        if (!isSleeping && !isDead) {
            const armOsc = Math.sin(frameIdx * Math.PI);
            const armSweep = isRunning ? 7.5 : 5.0;
            const drawArm = (ox, oy, osc, isFront) => {
                let tx = ox + (osc * armSweep);
                let ty = oy;
                if (isEating) { tx = 1.5; ty = -10; } // 식사 시 손을 입 근처로
                dot(tx, ty, 1.8, 2.5, isFront ? C.shirt : C.shirt_dark);
                dot(tx, ty + 2.5, 1.8, 2.2, C.skin);
            };
            drawArm(-3.5, -8, -armOsc, false);
            drawArm(2.5, -8, armOsc, true);
        }

        ctx.restore();
    }
};
