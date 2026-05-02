import { AnimalStates } from '../../../components/behavior/State.js';

export const GoatRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 3.0) * 1.5;

        // 🐐 Body (White/Cream)
        ctx.fillStyle = '#F5F5F5'; 
        ctx.fillRect(-6 * s, (-12 + bounce) * s, 12 * s, 8 * s);

        // Head
        ctx.fillRect(4 * s, (-18 + bounce) * s, 6 * s, 6 * s);
        
        // Beard (White)
        ctx.fillRect(8 * s, (-13 + bounce) * s, 2 * s, 4 * s);

        // Horns (Grey)
        ctx.fillStyle = '#9E9E9E';
        ctx.fillRect(4 * s, (-21 + bounce) * s, 2 * s, 4 * s);
        ctx.fillRect(8 * s, (-21 + bounce) * s, 2 * s, 4 * s);

        // Hooves
        ctx.fillStyle = '#424242';
        const walk = Math.sin(frameIdx * 3.0) * 3;
        ctx.fillRect(-4 * s, (-4 + bounce + walk) * s, 2 * s, 5 * s);
        ctx.fillRect(2 * s, (-4 + bounce - walk) * s, 2 * s, 5 * s);
    }
};
