/** 🐕 WildDogRenderer (State-Focused Masterpiece) */
export const WildDogRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const isRunning = ['run', 'hunt', 'flee'].includes(mode);
        const isSleeping = mode === 'sleep';
        const isEating = mode === 'eat' || mode === 'forage';
        const isDead = mode === 'die';
        
        const C = {
            black: '#171717', tan: '#d97706', white: '#f8fafc',
            shadow: '#451a03', eye: '#fbbf24', nose: '#0a0a0a',
            ground: 'rgba(0, 0, 0, 0.15)'
        };

        const dot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.max(1, w * s), Math.max(1, h * s));
        };

        if (!isDead) dot(-6, 1, 12, 2, C.ground);

        if (!isSleeping && !isDead) {
            const legOsc = Math.sin(frameIdx * Math.PI);
            const stride = isRunning ? 4.5 : 3.0;
            const drawLeg = (ox, oy, osc, isFront) => {
                const color = isFront ? C.tan : C.black;
                const tx = ox + (osc * stride);
                dot(tx, oy, 1.5, 3, color);
                dot(tx, oy + 2, 1.5, 1, C.white);
                dot(tx, oy + 3, 1.5, 0.4, C.nose);
            };
            drawLeg(-4, -0.5, -legOsc, false);
            drawLeg(-1, -0.5, -legOsc, false);
            drawLeg(2, -0.5, legOsc, true);
            drawLeg(4.5, -0.5, legOsc, true);
        }

        ctx.save();
        if (isDead) { ctx.rotate(Math.PI / 2); ctx.translate(0, -2 * s); }

        // 꼬리 (질주 시 깃발처럼 들림)
        const tailAngle = isRunning ? -0.8 : (isSleeping ? 0.8 : 0.2);
        const tailOsc = Math.sin(frameIdx * Math.PI) * 0.3;
        ctx.save();
        ctx.translate(-5 * s, -3.5 * s);
        ctx.rotate(tailAngle + tailOsc);
        dot(-4.5, -1, 4, 1.8, C.black);
        dot(-5.5, -1.2, 2.5, 2.2, C.white);
        ctx.restore();

        // 몸통
        if (isSleeping) {
            dot(-4, -3, 8, 3, C.black);
            dot(-3.5, -3.5, 7, 3, C.tan);
        } else {
            dot(-4.5, -5, 9.5, 4.5, C.black);
            dot(-4, -5.5, 4.5, 3.5, C.tan);
            dot(1.5, -5, 4, 3, C.tan);
            dot(-4.8, -3.5, 3, 2, C.white);
        }

        // 머리
        ctx.save();
        let hX = 4; let hY = -6.5;
        if (isEating) hY += 4;
        else if (isSleeping) { hX -= 1.5; hY += 3.5; }
        ctx.translate(hX * s, hY * s);

        dot(0, 0, 4, 4, C.black);
        dot(3, 2, 3.5, 2.5, C.tan);
        dot(6, 2, 1, 1, C.nose);

        const earRot = isRunning ? -0.5 : (isSleeping ? 0.4 : 0);
        ctx.save();
        ctx.rotate(earRot);
        dot(0, -3, 2.5, 4, C.black);
        dot(2.2, -2.2, 2.2, 3.5, C.black);
        ctx.restore();

        if (isSleeping) dot(2, 1.5, 1.5, 0.5, C.black);
        else {
            dot(2, 1.2, 1.2, 1.2, C.eye);
            dot(2, 1.2, 0.4, 0.4, '#fff');
        }
        ctx.restore();
        ctx.restore();
    }
};
