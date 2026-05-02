import { AnimalStates } from '../../../components/behavior/State.js';

export const ElephantRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 1.0) * 0.8;

        // 🐘 Massive Body (Grey)
        ctx.fillStyle = '#9E9E9E'; 
        ctx.fillRect(-16 * s, (-24 + bounce) * s, 32 * s, 20 * s);

        // Huge Ears
        ctx.fillStyle = '#757575';
        ctx.fillRect(4 * s, (-26 + bounce) * s, 10 * s, 14 * s);

        // Head
        ctx.fillStyle = '#9E9E9E';
        ctx.fillRect(12 * s, (-22 + bounce) * s, 12 * s, 12 * s);
        
        // Trunk (Long Nose)
        ctx.fillRect(20 * s, (-14 + bounce + Math.sin(frameIdx * 2) * 2) * s, 4 * s, 12 * s);

        // Tusks (White)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(22 * s, (-16 + bounce) * s, 6 * s, 2 * s);

        // Pillar Legs
        ctx.fillStyle = '#616161';
        const walk = Math.sin(frameIdx * 1.0) * 1.5;
        ctx.fillRect(-12 * s, (-4 + bounce + walk) * s, 8 * s, 8 * s);
        ctx.fillRect(8 * s, (-4 + bounce - walk) * s, 8 * s, 8 * s);
    }
};
