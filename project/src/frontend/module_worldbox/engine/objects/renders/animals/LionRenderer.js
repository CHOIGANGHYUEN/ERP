import { AnimalStates } from '../../../components/behavior/State.js';

/**
 * 🦁 LionRenderer — 백수의 왕 사자의 위엄 있는 갈기와 역동적 모션
 */
export const LionRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const t = frameIdx;
        const isMoving = mode === AnimalStates.WALK || mode === AnimalStates.RUN || mode === AnimalStates.HUNT;
        const bounce = isMoving ? Math.sin(t * 2.5) * 1.5 : Math.sin(t * 1.0) * 0.5;
        const walk = isMoving ? Math.sin(t * 2.5) * 3.5 : 0;

        ctx.save();
        
        // 🦁 1. 꼬리 (Tail)
        ctx.save();
        ctx.translate(-10 * s, (-10 + bounce) * s);
        ctx.rotate(Math.sin(t * 3) * 0.5);
        ctx.fillStyle = '#FFA000';
        ctx.fillRect(-6 * s, 0, 6 * s, 2 * s);
        ctx.fillStyle = '#5D4037'; // 꼬리 끝 털
        ctx.fillRect(-8 * s, -0.5 * s, 3 * s, 3 * s);
        ctx.restore();

        // 🦁 2. 뒷다리 (Far Legs)
        ctx.fillStyle = '#E65100';
        ctx.fillRect(-8 * s, (-4 + bounce - walk) * s, 3 * s, 7 * s);
        ctx.fillRect(4 * s, (-4 + bounce + walk) * s, 3 * s, 7 * s);

        // 🦁 3. 몸체 (Body)
        ctx.fillStyle = '#FFC107'; 
        ctx.fillRect(-10 * s, (-14 + bounce) * s, 20 * s, 10 * s);
        ctx.fillStyle = '#FFB300'; // 배 부분 어둡게
        ctx.fillRect(-10 * s, (-8 + bounce) * s, 20 * s, 4 * s);

        // 🦁 4. 갈기와 머리 (Mane & Head)
        // 갈기는 머리를 감싸는 여러 겹의 레이어로 표현
        ctx.save();
        ctx.translate(6 * s, (-18 + bounce) * s);
        
        // 뒷갈기
        ctx.fillStyle = '#5D4037';
        ctx.beginPath();
        ctx.arc(0, 4 * s, 8 * s, 0, Math.PI * 2);
        ctx.fill();

        // 머리
        ctx.fillStyle = '#FFC107';
        ctx.fillRect(0, 0, 8 * s, 8 * s);
        
        // 앞갈기 (얼굴 주변)
        ctx.fillStyle = '#795548';
        ctx.fillRect(-2 * s, -1 * s, 3 * s, 10 * s);
        ctx.fillRect(0 * s, -2 * s, 8 * s, 3 * s);
        
        // 👀 눈 (날카로운 눈매)
        ctx.fillStyle = '#212121';
        ctx.fillRect(5 * s, 2 * s, 1.5 * s, 1.5 * s);
        
        // 코/입
        ctx.fillStyle = '#E65100';
        ctx.fillRect(7 * s, 5 * s, 2 * s, 2 * s);
        ctx.restore();

        // 🦁 5. 앞다리 (Near Legs)
        ctx.fillStyle = '#FFA000';
        ctx.fillRect(-6 * s, (-4 + bounce + walk) * s, 4 * s, 8 * s);
        ctx.fillRect(6 * s, (-4 + bounce - walk) * s, 4 * s, 8 * s);

        ctx.restore();
    }
};
