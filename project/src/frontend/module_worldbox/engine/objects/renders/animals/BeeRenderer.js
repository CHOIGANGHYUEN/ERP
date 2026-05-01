/**
 * 🐝 BeeRenderer
 * 벌집나무의 일꾼인 벌들을 고퀄리티 도트로 렌더링합니다.
 */
export const BeeRenderer = {
    draw(ctx, frameIdx, s, mode, entity) {
        const animal = entity ? entity.components.get('Animal') : null;
        const role = animal ? animal.role : 'worker';
        const time = performance.now();
        
        // 🚀 [Floating Effect] 땅에 붙어있지 않게 위로 띄우고 호버링 연출
        const hover = Math.sin(time * 0.008) * 2;
        ctx.translate(0, -6 + hover);

        const C = {
            out: '#1a1a1a',  
            body: '#ffeb3b', 
            stripe: '#212121', 
            wing: 'rgba(255, 255, 255, 0.6)',
            honey: '#ffc107',
            queen: '#fbc02d'
        };

        const dot = (x, y, w, h, c) => {
            ctx.fillStyle = c;
            ctx.fillRect(x, y, w, h);
        };

        // 1. 날개 (Wings) - 더 작고 빠른 진동
        if (role !== 'larva') {
            const wOsc = Math.sin(time * 0.15) * 1.5;
            dot(-2.5, -2 + wOsc, 2, 1, C.wing);
            dot(0.5, -2 - wOsc, 2, 1, C.wing);
        } else {
            return; // 🐛 애벌레는 렌더링하지 않음 (벌집 상태값으로만 존재)
        }

        // 2. 몸통 (Body) - 3~5px 타겟 초소형 디자인
        if (role === 'queen') {
            // 👑 여왕벌 (4x6 규모)
            dot(-2, -3, 4, 6, C.out); 
            dot(-1.5, -2.5, 3, 5, C.queen); 
            dot(-1.5, 0, 3, 1, C.stripe); // 한 줄만 선명하게
        } 
        else {
            // 🐝 일벌 (3x4 규모)
            dot(-1.5, -2, 3, 4, C.out);
            dot(-1, -1.5, 2, 3, C.body);
            dot(-1, 0, 2, 1, C.stripe);
        }

        // 3. 꿀 채집 상태 (Honey Spot) - 1픽셀 포인트
        if (animal && animal.nectar > 5) {
            dot(-0.5, 2, 1, 1, C.honey);
        }
    }
};
