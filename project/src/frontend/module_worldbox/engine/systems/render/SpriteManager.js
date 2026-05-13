import System from '../../core/System.js';
import { StateNames } from '../../components/behavior/State.js';

/**
 * 🎞️ SpriteManager System
 * 
 * 엔티티의 이동 방향과 애니메이션 프레임을 관리합니다.
 * 시각적 연산(반전, 프레임 전환)을 전담하여 렌더러의 부담을 줄입니다.
 */
export default class SpriteManager extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        const rBuffer = em.renderBuffer;
        const sBuffer = em.stateBuffer;
        const vBuffer = em.velocityBuffer;
        const tBuffer = em.transformBuffer;
        const animalIds = em.animalIds.items;
        
        const camera = this.engine.camera;
        const margin = 200;
        const viewX = camera.renderX - margin;
        const viewY = camera.renderY - margin;
        const zoom = camera.zoom;
        const viewW = (camera.width / zoom) + (margin * 2);
        const viewH = (camera.height / zoom) + (margin * 2);
        const frameCount = this.engine.frameCount || 0;

        for (let i = 0; i < animalIds.length; i++) {
            const id = animalIds[i];
            const tIdx = id * 2;
            const x = tBuffer[tIdx];
            const y = tBuffer[tIdx + 1];

            // 1. [Culling] 화면 흔들림 대응
            const isVisible = (x > viewX && x < viewX + viewW && y > viewY && y < viewY + viewH);
            if (!isVisible && (id + frameCount) % 10 !== 0) continue;

            const rIdx = id * 8;
            const sIdx = id * 2;
            const vIdx = id * 4;

            // 2. [Expert Fix] 좌우 반전(flipX) 및 방향 업데이트
            const vx = vBuffer[vIdx];
            if (Math.abs(vx) > 0.1) {
                rBuffer[rIdx + 3] = vx < 0 ? 1 : 0; // flipX (1: true, 0: false)
            }

            // 3. 애니메이션 상태 업데이트
            const modeIdx = sBuffer[sIdx];
            const mode = StateNames[modeIdx] || 'idle';

            const entity = em.entities.get(id);
            const visual = entity?.components.get('Visual');
            if (!visual) continue;

            const anim = visual.animations[mode];
            if (!anim || !anim.frames) continue;

            // 프레임 타이머 업데이트
            visual.frameTimer += dt * 1000;
            if (visual.frameTimer >= anim.speed) {
                visual.frameTimer = 0;
                
                const isLoop = anim.loop !== false;
                let currentFrame = rBuffer[rIdx + 2];
                const nextFrameIdx = currentFrame + 1;

                if (nextFrameIdx < anim.frames.length) {
                    rBuffer[rIdx + 2] = nextFrameIdx;
                } else if (isLoop) {
                    rBuffer[rIdx + 2] = 0;
                } else {
                    rBuffer[rIdx + 2] = anim.frames.length - 1;
                }
            }
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
