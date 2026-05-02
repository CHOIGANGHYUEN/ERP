import { AnimalStates } from '../../../components/behavior/State.js';

export const RabbitRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const hop = Math.abs(Math.sin(frameIdx * 5.0)) * 4;

        // 🐇 Small Round Body (White/Grey)
        ctx.fillStyle = '#EEEEEE'; 
        ctx.fillRect(-4 * s, (-8 + hop) * s, 8 * s, 6 * s);

        // Head
        ctx.fillRect(2 * s, (-11 + hop) * s, 5 * s, 5 * s);
        
        // Long Ears (Pinkish White)
        ctx.fillStyle = '#EEEEEE';
        ctx.fillRect(3 * s, (-15 + hop) * s, 2 * s, 5 * s);
        ctx.fillRect(5 * s, (-15 + hop) * s, 2 * s, 5 * s);
        ctx.fillStyle = '#F8BBD0'; // Pink Inner Ear
        ctx.fillRect(3.5 * s, (-14 + hop) * s, 1 * s, 3 * s);

        // Tiny Paws
        ctx.fillStyle = '#BDBDBD';
        ctx.fillRect(-3 * s, (-2 + hop) * s, 2 * s, 2 * s);
        ctx.fillRect(2 * s, (-2 + hop) * s, 2 * s, 2 * s);
    }
};
