import { AnimalStates } from '../../../components/behavior/State.js';

export const FoxRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 4.0) * 1.2;

        // 🦊 Body (Reddish Orange)
        ctx.fillStyle = '#E64A19'; 
        ctx.fillRect(-6 * s, (-10 + bounce) * s, 12 * s, 6 * s);

        // White Belly/Neck
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(2 * s, (-8 + bounce) * s, 4 * s, 4 * s);

        // Head
        ctx.fillStyle = '#E64A19';
        ctx.fillRect(4 * s, (-14 + bounce) * s, 6 * s, 6 * s);
        
        // Pointy Ears
        ctx.fillRect(4 * s, (-17 + bounce) * s, 2 * s, 3 * s);
        ctx.fillRect(8 * s, (-17 + bounce) * s, 2 * s, 3 * s);

        // Tail (Large, Bushy)
        ctx.fillStyle = '#E64A19';
        ctx.fillRect(-10 * s, (-12 + bounce) * s, 6 * s, 4 * s);
        ctx.fillStyle = '#FFFFFF'; // Tail Tip
        ctx.fillRect(-12 * s, (-12 + bounce) * s, 3 * s, 4 * s);

        // Tiny Legs
        ctx.fillStyle = '#212121';
        const walk = Math.sin(frameIdx * 4.0) * 2;
        ctx.fillRect(-4 * s, (-4 + bounce + walk) * s, 2 * s, 4 * s);
        ctx.fillRect(2 * s, (-4 + bounce - walk) * s, 2 * s, 4 * s);
    }
};
