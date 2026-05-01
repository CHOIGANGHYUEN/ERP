/**
 * 🐝 BeeRenderer
 * 벌집나무의 일꾼인 벌들을 고퀄리티 도트로 렌더링합니다.
 */
export const BeeRenderer = {
    draw(ctx, frameIdx, s, mode, entity) {
        const visual = entity ? entity.components.get('Visual') : null;
        const role = visual ? visual.role : 'worker';
        const time = performance.now();
        
        // 1. 날개 (Wings) - 엄청나게 빠른 날갯짓 (Flickering)
        const wingPulse = Math.sin(time * 0.05) > 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        if (role !== 'larva') {
            if (wingPulse) {
                ctx.fillRect(-2, -3, 1.5, 1.5);
                ctx.fillRect(0.5, -3, 1.5, 1.5);
            } else {
                ctx.fillRect(-2.5, -2, 1, 1);
                ctx.fillRect(1.5, -2, 1, 1);
            }
        }

        // 2. 몸통 (Body) - 노랑/검정 줄무늬
        if (role === 'larva') {
            // 애벌레: 하얀색 덩어리
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(-1, -1, 2, 2);
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(0, 0, 1, 1);
        } else if (role === 'queen') {
            // 여왕벌: 더 크고 긴 몸체
            ctx.fillStyle = '#fbc02d'; // Yellow
            ctx.fillRect(-1.5, -2, 3, 4);
            ctx.fillStyle = '#000000'; // Black Stripes
            ctx.fillRect(-1.5, -1, 3, 1);
            ctx.fillRect(-1.5, 1, 3, 1);
            // 머리 부분 포인트
            ctx.fillStyle = '#fbc02d';
            ctx.fillRect(-0.5, -3, 1, 1);
        } else {
            // 일벌: 작은 둥근 몸체
            ctx.fillStyle = '#ffeb3b'; // Yellow
            ctx.fillRect(-1, -1.5, 2, 3);
            ctx.fillStyle = '#212121'; // Black Stripe
            ctx.fillRect(-1, 0, 2, 1);
        }

        // 3. 꿀 채집 상태 표시 (Nectar)
        const animal = entity ? entity.components.get('Animal') : null;
        if (animal && animal.nectar > 5) {
            ctx.fillStyle = '#ffc107';
            ctx.fillRect(-0.5, 1, 1, 1);
        }
    }
};
