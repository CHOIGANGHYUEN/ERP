import { AnimalStates } from '../../../components/behavior/State.js';

/**
 * 🐊 CrocodileRenderer — 낮은 포복 자세와 강력한 꼬리 스윙 연출
 * [Expert Design] 다중 세그먼트 꼬리 애니메이션 및 사냥 시 턱 스냅 추가
 */
export const CrocodileRenderer = {
    draw(ctx, frameIdx, s, mode) {
        const t = frameIdx;
        const isMoving = mode === AnimalStates.WALK || mode === AnimalStates.RUN || mode === AnimalStates.HUNT;
        const isHunting = mode === AnimalStates.HUNT;
        
        // 🌀 기본 흔들림 및 걷기 애니메이션 수치
        const wiggle = isMoving ? Math.sin(t * 2.5) * 3 : Math.sin(t * 1.0) * 0.5;
        const walk = isMoving ? Math.sin(t * 2.5) * 2 : 0;
        
        // 👄 턱 애니메이션 (사냥 중일 때 더 크게 벌림)
        const jawOpen = isHunting ? Math.abs(Math.sin(t * 4.0)) * 6 : (isMoving ? Math.abs(Math.sin(t * 1.0)) * 1 : 0);

        ctx.save();
        
        // 🐊 1. 꼬리 (Multi-segment Tail Whip)
        // 꼬리를 세 부분으로 나누어 부드러운 곡선 연출
        ctx.save();
        ctx.translate(-14 * s, (-5 + wiggle) * s);
        for (let i = 0; i < 3; i++) {
            const tailWiggle = Math.sin(t * 2.5 - i * 0.8) * 0.3;
            ctx.rotate(tailWiggle);
            ctx.fillStyle = i === 0 ? '#2E7D32' : (i === 1 ? '#1B5E20' : '#143816');
            ctx.fillRect(-6 * s, -2 * s, 7 * s, (4 - i * 0.5) * s);
            
            // 꼬리 가시
            ctx.fillStyle = '#0a210b';
            ctx.fillRect(-4 * s, -3 * s, 2 * s, 1 * s);
            ctx.translate(-5 * s, 0);
        }
        ctx.restore();

        // 🐊 2. 뒷다리 (Far Legs)
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(-10 * s, (-2 + wiggle - walk) * s, 3.5 * s, 3.5 * s);
        ctx.fillRect(4 * s, (-2 + wiggle + walk) * s, 3.5 * s, 3.5 * s);

        // 🐊 3. 몸체 (Robust Body with Scales)
        const gradient = ctx.createLinearGradient(-14 * s, 0, 12 * s, 0);
        gradient.addColorStop(0, '#1B5E20');
        gradient.addColorStop(0.5, '#2E7D32');
        gradient.addColorStop(1, '#388E3C');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(-14 * s, (-8 + wiggle) * s, 26 * s, 6.5 * s);
        
        // 등 비늘 (Scale Ridges) - 입체감 부여
        ctx.fillStyle = '#0a210b';
        for(let i=0; i<6; i++) {
            const h = (1.5 + Math.sin(t * 0.5 + i) * 0.5) * s;
            ctx.fillRect((-12 + i * 4.5) * s, (-9.5 + wiggle) * s, 2.5 * s, h);
        }

        // 🐊 4. 머리와 주둥이 (Snapping Jaws)
        ctx.save();
        ctx.translate(12 * s, (-8 + wiggle) * s);
        
        // 윗턱
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(0, -2 * s, 12 * s, 2.5 * s); 
        
        // 아랫턱 (애니메이션 적용)
        ctx.save();
        ctx.translate(2 * s, 0.5 * s);
        ctx.rotate(jawOpen * 0.08);
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(0, 0, 10 * s, 2 * s);
        
        // 이빨 (사냥 중일 때만 살짝 보임)
        if (jawOpen > 2) {
            ctx.fillStyle = '#FFFFFF';
            for(let i=0; i<3; i++) {
                ctx.fillRect((2 + i*3) * s, -0.5 * s, 1 * s, 1 * s);
            }
        }
        ctx.restore();
        
        // 👀 날카로운 노란 눈
        ctx.fillStyle = '#FFD600';
        ctx.fillRect(1.5 * s, -3.5 * s, 2.5 * s, 1.8 * s);
        ctx.fillStyle = '#000000';
        ctx.fillRect(2.5 * s, -3 * s, 1 * s, 1 * s); // 눈동자
        
        // 콧구멍
        ctx.fillStyle = '#0a210b';
        ctx.fillRect(10 * s, -2.5 * s, 1 * s, 0.8 * s);
        ctx.restore();

        // 🐊 5. 앞다리 (Near Legs)
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(-8 * s, (-2 + wiggle + walk) * s, 4.5 * s, 4.5 * s);
        ctx.fillRect(6 * s, (-2 + wiggle - walk) * s, 4.5 * s, 4.5 * s);

        ctx.restore();
    }
};

