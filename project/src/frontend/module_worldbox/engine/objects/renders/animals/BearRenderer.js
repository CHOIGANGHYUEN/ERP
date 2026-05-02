import { AnimalStates } from '../../../components/behavior/State.js';

export const BearRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 1.5) * 1.0;

        // 🐻 Large Body (Dark Brown)
        ctx.fillStyle = '#4E342E'; 
        ctx.fillRect(-12 * s, (-18 + bounce) * s, 24 * s, 16 * s);

        // Head
        ctx.fillStyle = '#4E342E';
        ctx.fillRect(8 * s, (-22 + bounce) * s, 10 * s, 10 * s);
        
        // Ears
        ctx.fillRect(8 * s, (-24 + bounce) * s, 3 * s, 3 * s);
        ctx.fillRect(15 * s, (-24 + bounce) * s, 3 * s, 3 * s);

        // Nose
        ctx.fillStyle = '#212121';
        ctx.fillRect(16 * s, (-16 + bounce) * s, 3 * s, 3 * s);

        // Heavy Legs
        ctx.fillStyle = '#3E2723';
        const walk = Math.sin(frameIdx * 1.5) * 2;
        ctx.fillRect(-10 * s, (-4 + bounce + walk) * s, 6 * s, 6 * s);
        ctx.fillRect(4 * s, (-4 + bounce - walk) * s, 6 * s, 6 * s);
    }
};
