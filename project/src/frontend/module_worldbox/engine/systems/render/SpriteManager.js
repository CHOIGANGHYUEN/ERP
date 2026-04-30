import System from '../../core/System.js';

/**
 * 🎞️ SpriteManager System
 * 
 * 엔티티의 이동 방향과 애니메이션 프레임을 관리합니다.
 * 시각적 연산(반전, 프레임 전환)을 전담하여 렌더러의 부담을 줄입니다.
 */
export default class SpriteManager extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
    }

    update(dt, time) {
        const em = this.entityManager;
        for (const [id, entity] of em.entities) {
            this.updateAnimations(entity, dt);
        }
    }

    /**
     * 애니메이션 프레임 및 방향성 업데이트
     */
    updateAnimations(entity, dt) {
        const visual = entity.components.get('Visual');
        const transform = entity.components.get('Transform');
        const state = entity.components.get('AIState');

        if (!visual || !state) return;

        // 1. 이동 방향에 따른 좌우 반전 (flipX) 처리
        if (transform && Math.abs(transform.vx) > 0.1) {
            visual.flipX = transform.vx < 0;
        }

        // 2. 현재 상태에 맞는 애니메이션 데이터 가져오기
        const anim = visual.animations[state.mode];
        if (!anim || !anim.frames) return;

        // 3. 프레임 타이머 누적 및 갱신
        visual.frameTimer += dt * 1000; // ms 단위 변환

        if (visual.frameTimer >= anim.speed) {
            visual.frameTimer = 0;
            
            // 루프 여부 확인
            const isLoop = anim.loop !== false;
            const nextFrameIdx = visual.currentFrame + 1;

            if (nextFrameIdx < anim.frames.length) {
                visual.currentFrame = nextFrameIdx;
            } else if (isLoop) {
                visual.currentFrame = 0; // 루프
            } else {
                // 루프가 아니면 마지막 프레임에 고정 (예: DIE)
                visual.currentFrame = anim.frames.length - 1;
            }
        }
    }
}
