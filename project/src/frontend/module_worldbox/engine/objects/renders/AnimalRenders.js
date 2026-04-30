import { AnimalStates } from '../../components/behavior/State.js';

/**
 * 🎨 AnimalRenders Module
 * 
 * 동물의 상태별 디테일한 모션과 캔버스 변환(Transform)을 담당합니다.
 * 수학적 보간을 통해 생동감 있는 도트 애니메이션을 구현합니다.
 */
export const AnimalRenders = {
    /**
     * 동물의 몸체를 그립니다. (상태별 모션 포함)
     */
    drawAnimalBody(ctx, entity, time, drawSpriteFn) {
        const transform = entity.components.get('Transform');
        const visual = entity.components.get('Visual');
        const state = entity.components.get('AIState');

        if (!transform || !visual || !state) return;

        ctx.save();
        
        // 1. 기본 위치 및 반전 처리
        ctx.translate(transform.x, transform.y);
        if (visual.flipX) ctx.scale(-1, 1);

        // 2. 상태별 디테일 모션 적용
        const mode = state.mode;
        this.applyStateMotion(ctx, mode, time, visual, transform);

        // 3. 실제 스프라이트 그리기 (전달받은 그리기 함수 실행)
        // currentFrame을 활용하여 애니메이션 시퀀스 반영
        const frameIdx = visual.animations[mode]?.frames[visual.currentFrame] || 0;
        
        if (visual.alpha !== undefined) ctx.globalAlpha = visual.alpha;
        
        drawSpriteFn(ctx, frameIdx, visual.size);

        ctx.restore();
    },

    /**
     * 상태에 따른 수학적 보간 및 필터 적용
     */
    applyStateMotion(ctx, mode, time, visual, transform) {

        switch (mode) {
            case AnimalStates.SLEEP:
            case AnimalStates.IDLE:
            case 'wander':
                // 😤 숨쉬는 모션 (Y축 스케일 바운스)
                const breath = Math.sin(time * 0.003) * 0.05;
                ctx.scale(1, 1 + breath);
                break;

            case AnimalStates.WALK:
            case AnimalStates.FORAGE:
                // 🚶 걷는 모션 (가벼운 상하 흔들림)
                const bob = Math.sin(time * 0.01) * 1.5;
                ctx.translate(0, bob);
                break;


            case AnimalStates.RUN:
            case AnimalStates.FLEE:
            case AnimalStates.EVADE:
            case AnimalStates.HUNT:
                // 🏃 달리기 모션 (전진 방향으로 10도 기울기)
                ctx.rotate(0.15); // 약 8.5도
                // 먼지 파티클 생성 (랜덤 확률)
                if (Math.random() < 0.05) {
                    // EntityRenderer에서 접근 가능한 eventBus를 통해 파티클 생성
                    window.dispatchEvent(new CustomEvent('WORLD_SPAWN_DUST', { detail: { x: transform.x, y: transform.y } }));
                }
                break;


            case AnimalStates.EAT:
                // 🍎 고개 끄덕임 모션
                const peck = Math.abs(Math.sin(time * 0.01)) * 2;
                ctx.translate(0, peck);
                break;

            case AnimalStates.DIE:
                // 💀 사망 모션 (그레이스케일 + 가라앉기)
                ctx.filter = 'grayscale(100%)';
                const sink = (1.0 - (visual.alpha || 1.0)) * 5;
                ctx.translate(0, sink);
                break;
        }
    }
};
