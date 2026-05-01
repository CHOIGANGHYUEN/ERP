/** 👤 HumanRenderer (Compact & Detailed Masterpiece) */
export const HumanRenderer = {
    draw(ctx, frameIdx, s, mode, entity) {
        const isMoving = mode === 'walk' || mode === 'run';
        const isRunning = mode === 'run';
        const isSleeping = mode === 'sleep';
        const isEating = mode === 'eat' || mode === 'forage';
        const isDead = mode === 'die';
        
        const gender = entity?.components.get('Animal')?.gender || 'male';
        const isMale = gender === 'male';
        const isBaby = entity?.components.get('Visual')?.isBaby || false;

        // 🎨 Premium Curated Palette
        const C = isMale ? {
            skin: '#e0ac69', skin_dark: '#c68642', shirt: '#1e88e5',
            shirt_light: '#64b5f6', shirt_dark: '#1565c0', pants: '#263238',
            hair: '#3e2723', eye: '#212121', shoe: '#212121', accessory: '#ffeb3b'
        } : {
            skin: '#ffdbac', skin_dark: '#f1c27d', shirt: '#ec407a',
            shirt_light: '#f48fb1', shirt_dark: '#ad1457', pants: '#37474f',
            hair: '#4e342e', eye: '#212121', shoe: '#212121', accessory: '#9c27b0'
        };

        const dot = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.max(1, w * s), Math.max(1, h * s));
        };

        // 👣 Shadow (Soft & Grounded)
        if (!isDead) dot(-3.5, 0.5, 7, 1.2, 'rgba(0, 0, 0, 0.15)');

        const legOsc = Math.sin(frameIdx * Math.PI);
        const stride = isRunning ? 5.5 : 3.8;
        
        // 🦵 Legs (Tapered)
        if (!isSleeping && !isDead) {
            const drawLeg = (ox, oy, osc, isFront) => {
                const color = isFront ? C.pants : '#1a1a1a';
                const tx = ox + (osc * stride);
                dot(tx, oy, 1.8, 3.5, color);
                dot(tx, oy + 3.5, 1.8, 0.8, C.shoe); 
            };
            drawLeg(-1.8, -3.5, -legOsc, false);
            drawLeg(0.2, -3.5, legOsc, true);
        }

        ctx.save();
        if (isSleeping || isDead) {
            ctx.rotate(Math.PI / 2);
            ctx.translate(0, -3.5 * s);
        }

        // 👕 Torso (Premium Layered Look)
        if (isRunning) ctx.rotate(0.12);
        
        dot(-2.4, -8.5, 4.8, 5.5, C.shirt); // Body
        dot(-2.4, -3.5, 4.8, 0.8, C.shirt_dark); // Belt/Trim
        
        // Shirt Detail (V-neck or Pattern)
        if (isMale) {
            dot(-0.8, -8.5, 1.6, 2, C.skin); // V-neck
        } else {
            dot(-1.2, -7.5, 2.4, 0.6, C.shirt_light); // Stripe pattern
        }

        // 🧠 Head (Detailed with Accessories)
        ctx.save();
        const headBob = isMoving ? Math.sin(frameIdx * Math.PI * 2) * 0.7 : 0;
        let hY = -12.5;
        if (isEating) hY += 1.5;
        ctx.translate(0, hY * s + headBob * s);
        
        // Skin
        dot(-2, 0, 4, 4, C.skin);
        
        // Hair & Style (Gender Distinctive)
        if (isMale) {
            dot(-2.2, -1.5, 4.4, 2.5, C.hair); // Top
            dot(-2.2, 0, 0.8, 2.5, C.hair);    // Side L
            dot(1.4, 0, 0.8, 2.5, C.hair);     // Side R
            // Accessory: Little hat or headband
            if (isBaby) dot(-1, -2, 2, 0.8, C.accessory);
        } else {
            dot(-2.5, -1.8, 5, 2.8, C.hair);   // Big Top
            dot(-2.5, 0, 1.2, 5.5, C.hair);    // Long Flowing L
            dot(1.3, 0, 1.2, 5.5, C.hair);     // Long Flowing R
            // Accessory: Flower or Hairpin
            dot(1.8, 0, 1.2, 1.2, C.accessory);
        }
        
        // Eyes (Expressive)
        const eyeY = isSleeping ? 2.5 : 2.0;
        const eyeH = isSleeping ? 0.5 : 1.2;
        ctx.fillStyle = C.eye;
        dot(-1.4, eyeY, 1, eyeH, C.eye);
        dot(0.4, eyeY, 1, eyeH, C.eye);
        
        ctx.restore();

        // 💪 Arms (Articulated)
        if (!isSleeping && !isDead) {
            const armOsc = Math.sin(frameIdx * Math.PI);
            const armSweep = isRunning ? 7.0 : 4.5;
            const drawArm = (ox, oy, osc, isFront) => {
                let tx = ox + (osc * armSweep);
                let ty = oy;
                if (isEating) { tx = 1.5; ty = -10.5; }
                
                dot(tx, ty, 1.8, 2.5, isFront ? C.shirt : C.shirt_dark);
                dot(tx, ty + 2.5, 1.8, 2.0, C.skin); // Hands
            };
            drawArm(-3.8, -8, -armOsc, false);
            drawArm(2.0, -8, armOsc, true);
        }

        ctx.restore();
    }
};
