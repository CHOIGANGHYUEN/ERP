import { AnimalStates } from '../../../components/behavior/State.js';

export const DeerRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 2.5) * 1.5;

        // 🦌 Slender Body (Tan/Light Brown)
        ctx.fillStyle = '#A1887F'; 
        ctx.fillRect(-8 * s, (-14 + bounce) * s, 16 * s, 8 * s);

        // White Spots
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-4 * s, (-12 + bounce) * s, 1 * s, 1 * s);
        ctx.fillRect(2 * s, (-10 + bounce) * s, 1 * s, 1 * s);

        // Long Neck & Head
        ctx.fillStyle = '#A1887F';
        ctx.fillRect(4 * s, (-22 + bounce) * s, 4 * s, 10 * s); // Neck
        ctx.fillRect(6 * s, (-24 + bounce) * s, 6 * s, 4 * s);  // Head

        // Antlers (Brown)
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(8 * s, (-28 + bounce) * s, 1 * s, 4 * s);
        ctx.fillRect(7 * s, (-28 + bounce) * s, 3 * s, 1 * s);

        // Thin Legs
        ctx.fillStyle = '#795548';
        const walk = Math.sin(frameIdx * 2.5) * 4;
        ctx.fillRect(-6 * s, (-6 + bounce + walk) * s, 2 * s, 8 * s);
        ctx.fillRect(2 * s, (-6 + bounce - walk) * s, 2 * s, 8 * s);
    }
};
