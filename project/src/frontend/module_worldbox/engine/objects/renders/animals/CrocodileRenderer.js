import { AnimalStates } from '../../../components/behavior/State.js';

export const CrocodileRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const wiggle = Math.sin(frameIdx * 2.0) * 2;

        // 🐊 Long Body (Dark Green)
        ctx.fillStyle = '#2E7D32'; 
        ctx.fillRect(-14 * s, (-8 + wiggle) * s, 24 * s, 6 * s);

        // Scales (Darker Green Dots)
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(-8 * s, (-8 + wiggle) * s, 2 * s, 2 * s);
        ctx.fillRect(0 * s, (-8 + wiggle) * s, 2 * s, 2 * s);

        // Long Snout (Head)
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(10 * s, (-10 + wiggle) * s, 10 * s, 6 * s);
        
        // Eyes
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(12 * s, (-11 + wiggle) * s, 2 * s, 2 * s);

        // Short Legs
        ctx.fillStyle = '#1B5E20';
        const walk = Math.sin(frameIdx * 2.0) * 1.5;
        ctx.fillRect(-10 * s, (-2 + wiggle + walk) * s, 3 * s, 3 * s);
        ctx.fillRect(4 * s, (-2 + wiggle - walk) * s, 3 * s, 3 * s);
    }
};
