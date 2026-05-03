import { AnimalStates } from '../../../components/behavior/State.js';

/**
 * 🐘 ElephantRenderer — 육중한 덩치와 디테일한 파츠 애니메이션
 */
export const ElephantRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const bounce = Math.sin(frameIdx * 1.0) * 0.5;
        const t = frameIdx;
        const isMoving = mode === AnimalStates.WALK || mode === AnimalStates.RUN || mode === AnimalStates.HUNT;
        const walk = isMoving ? Math.sin(t * 1.2) * 2.5 : 0;

        ctx.save();
        
        // 🐘 1. 꼬리 (Tail) - Z-Order상 가장 뒤
        ctx.save();
        ctx.translate(-14 * s, (-18 + bounce) * s);
        ctx.rotate(Math.sin(t * 1.5) * 0.4);
        ctx.fillStyle = '#616161';
        ctx.fillRect(-2 * s, 0, 2 * s, 6 * s);
        ctx.restore();

        // 🐘 2. 뒷다리 (Far Legs)
        ctx.fillStyle = '#424242';
        ctx.fillRect(-10 * s, (-4 + bounce - walk) * s, 6 * s, 6 * s);
        ctx.fillRect(6 * s, (-4 + bounce + walk) * s, 6 * s, 6 * s);

        // 🐘 3. 거대한 몸체 (Main Body)
        ctx.fillStyle = '#9E9E9E'; 
        ctx.fillRect(-16 * s, (-24 + bounce) * s, 32 * s, 20 * s);
        
        // 몸체 하이라이트/그림자
        ctx.fillStyle = '#BDBDBD';
        ctx.fillRect(-16 * s, (-24 + bounce) * s, 32 * s, 4 * s); // 등 부분 밝게
        ctx.fillStyle = '#757575';
        ctx.fillRect(-16 * s, (-8 + bounce) * s, 32 * s, 4 * s);  // 배 부분 어둡게

        // 🐘 4. 머리와 귀
        ctx.save();
        ctx.translate(14 * s, (-20 + bounce) * s);
        
        // 귀 (Flapping Ears)
        const earFlap = Math.sin(t * 0.8) * 4;
        ctx.fillStyle = '#757575';
        ctx.beginPath();
        ctx.ellipse(-2 * s, 2 * s, (6 + Math.abs(earFlap)) * s, 10 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // 머리 뭉치
        ctx.fillStyle = '#9E9E9E';
        ctx.fillRect(-4 * s, -6 * s, 12 * s, 12 * s);
        
        // 코 (Trunk - 2단계 관절 애니메이션)
        const trunkSwing = Math.sin(t * 1.5) * 5;
        ctx.fillStyle = '#9E9E9E';
        ctx.fillRect(4 * s, 0, 4 * s, 8 * s); // 코 윗부분
        ctx.fillRect((4 + trunkSwing * 0.3) * s, 8 * s, 4 * s, 6 * s); // 코 아랫부분
        
        // 상아 (Tusks)
        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(4 * s, 2 * s, 6 * s, 2 * s); // 상아 베이스
        ctx.fillRect(10 * s, 0, 2 * s, 2 * s);    // 상아 끝부분 (위로 휨)

        // 👀 눈
        ctx.fillStyle = '#212121';
        ctx.fillRect(4 * s, -2 * s, 2 * s, 2 * s);
        ctx.restore();

        // 🐘 5. 앞다리 (Near Legs)
        ctx.fillStyle = '#616161';
        ctx.fillRect(-12 * s, (-4 + bounce + walk) * s, 7 * s, 7 * s);
        ctx.fillRect(8 * s, (-4 + bounce - walk) * s, 7 * s, 7 * s);

        ctx.restore();
    }
};
