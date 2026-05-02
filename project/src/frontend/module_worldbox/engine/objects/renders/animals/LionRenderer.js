import { AnimalStates } from '../../../components/behavior/State.js';

export const LionRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 2.5) * 1.5;

        // 🦁 Mane (Large, Brown)
        ctx.fillStyle = '#795548'; 
        ctx.fillRect(4 * s, (-22 + bounce) * s, 12 * s, 14 * s);

        // Body (Gold)
        ctx.fillStyle = '#FFC107'; 
        ctx.fillRect(-10 * s, (-14 + bounce) * s, 18 * s, 10 * s);

        // Head
        ctx.fillStyle = '#FFC107';
        ctx.fillRect(8 * s, (-18 + bounce) * s, 6 * s, 6 * s);
        
        // Eyes
        ctx.fillStyle = '#212121';
        ctx.fillRect(12 * s, (-16 + bounce) * s, 1 * s, 1 * s);

        // Legs
        ctx.fillStyle = '#FFA000';
        const walk = Math.sin(frameIdx * 2.5) * 3;
        ctx.fillRect(-8 * s, (-6 + bounce + walk) * s, 4 * s, 8 * s);
        ctx.fillRect(2 * s, (-6 + bounce - walk) * s, 4 * s, 8 * s);
    }
};
