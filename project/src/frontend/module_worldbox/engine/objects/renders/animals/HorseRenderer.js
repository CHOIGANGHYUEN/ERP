import { AnimalStates } from '../../../components/behavior/State.js';

export const HorseRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 3.0) * 1.5;

        // 🐎 Sturdy Body (Brown)
        ctx.fillStyle = '#6D4C41'; 
        ctx.fillRect(-10 * s, (-16 + bounce) * s, 18 * s, 10 * s);

        // Mane (Darker Brown)
        ctx.fillStyle = '#3E2723';
        ctx.fillRect(4 * s, (-22 + bounce) * s, 4 * s, 10 * s);

        // Head
        ctx.fillStyle = '#6D4C41';
        ctx.fillRect(8 * s, (-24 + bounce) * s, 8 * s, 6 * s);
        
        // Tail
        ctx.fillStyle = '#3E2723';
        ctx.fillRect(-13 * s, (-14 + bounce) * s, 4 * s, 6 * s);

        // Long Legs
        ctx.fillStyle = '#4E342E';
        const walk = Math.sin(frameIdx * 3.0) * 4;
        ctx.fillRect(-8 * s, (-6 + bounce + walk) * s, 3 * s, 8 * s);
        ctx.fillRect(3 * s, (-6 + bounce - walk) * s, 3 * s, 8 * s);
    }
};
