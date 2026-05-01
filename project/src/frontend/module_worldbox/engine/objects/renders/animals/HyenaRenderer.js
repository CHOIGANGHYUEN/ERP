/** 🐆 HyenaRenderer (State-Focused Masterpiece) */
export const HyenaRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const isRunning = ['run', 'hunt', 'flee'].includes(mode);
        const isSleeping = mode === 'sleep';
        const isEating = mode === 'eat' || mode === 'forage';
        const isDead = mode === 'die';
        
        const C = {
            base: '#a3a3a3', shadow: '#737373', deep: '#404040',
            spot: '#262626', mane: '#525252', eye: '#fbbf24',
            nose: '#171717', ground: 'rgba(0, 0, 0, 0.18)'
        };

        const dot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.max(1, w * s), Math.max(1, h * s));
        };

        if (!isDead) dot(-7, 1, 14, 2.5, C.ground);

        if (!isSleeping && !isDead) {
            const legOsc = Math.sin(frameIdx * Math.PI);
            const stride = isRunning ? 3.5 : 2.5;
            const drawLeg = (ox, oy, h, osc, isFront) => {
                const color = isFront ? C.base : C.deep;
                const tx = ox + (osc * stride);
                dot(tx, oy, 2, h, color);
                dot(tx, oy + h, 2, 0.8, C.nose);
            };
            drawLeg(-4.5, -0.5, 2.5, -legOsc, false);
            drawLeg(-2, -0.5, 2.5, -legOsc, false);
            drawLeg(2, -1.8, 4.2, legOsc, true);
            drawLeg(5, -1.8, 4.2, legOsc, true);
        }

        ctx.save();
        if (isDead) { ctx.rotate(Math.PI / 2); ctx.translate(0, -3 * s); }

        // 몸통
        if (isSleeping) {
            dot(-5, -3.5, 10, 3.5, C.deep);
            dot(-4.5, -4, 9, 3.5, C.shadow);
        } else {
            dot(-5.5, -5.5, 11, 5, C.deep);
            dot(-1, -8, 6.5, 7, C.shadow); // 어깨
            dot(-0.5, -8.5, 5.5, 6, C.base);
            if (isRunning) dot(0, -9, 4, 1.5, C.mane); // 질주 시 갈기 강조
            dot(-5, -6, 5.5, 4.5, C.shadow);
            dot(-4.5, -6.5, 5, 4, C.base);
        }

        // 머리
        ctx.save();
        let hX = 4.5; let hY = -8.5;
        if (isEating) hY += 4.5;
        else if (isSleeping) { hX -= 2; hY += 4; }
        ctx.translate(hX * s, hY * s);

        dot(0, 0, 5, 5, C.base);
        dot(3, 2.5, 4, 3, C.shadow);
        dot(6, 2.5, 1.5, 1.5, C.nose);

        const earRot = isRunning ? -0.4 : (isSleeping ? 0.3 : 0);
        ctx.save();
        ctx.rotate(earRot);
        dot(0.2, -2.2, 2.5, 2.5, C.deep);
        dot(2.5, -1.5, 2.2, 2.2, C.deep);
        ctx.restore();

        if (isSleeping) dot(2.8, 2, 1.5, 0.5, C.deep);
        else {
            dot(2.8, 1.5, 1.5, 1.5, C.eye);
            dot(2.8, 1.5, 0.6, 0.6, '#fff');
        }
        ctx.restore();
        ctx.restore();
    }
};
