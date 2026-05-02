import { AnimalStates } from '../../../components/behavior/State.js';

export const TigerRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 2.5) * 1.5;
        const stretch = mode === AnimalStates.HUNT ? 1.1 : 1.0;

        // 🐅 Tiger Body (Large, Orange/Gold)
        ctx.fillStyle = '#FF9800'; // Base Orange
        ctx.fillRect(-10 * s, (-14 + bounce) * s, 20 * s, 12 * s * stretch);
        
        // Stripes (Black)
        ctx.fillStyle = '#212121';
        ctx.fillRect(-6 * s, (-14 + bounce) * s, 2 * s, 12 * s);
        ctx.fillRect(0 * s, (-14 + bounce) * s, 2 * s, 12 * s);
        ctx.fillRect(6 * s, (-14 + bounce) * s, 2 * s, 12 * s);

        // Head
        ctx.fillStyle = '#FF9800';
        ctx.fillRect(6 * s, (-18 + bounce) * s, 8 * s, 8 * s);
        
        // Eyes (Glowy Yellow/White)
        ctx.fillStyle = '#FFF59D';
        ctx.fillRect(11 * s, (-16 + bounce) * s, 2 * s, 2 * s);

        // Legs
        ctx.fillStyle = '#E65100';
        const walk = Math.sin(frameIdx * 2.5) * 3;
        ctx.fillRect(-8 * s, (-4 + bounce + walk) * s, 4 * s, 6 * s);
        ctx.fillRect(4 * s, (-4 + bounce - walk) * s, 4 * s, 6 * s);
    }
};
