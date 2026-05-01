import System from '../../core/System.js';

/**
 * 🕶️ CullingSystem (화면 밖 렌더링 차단 시스템)
 * 카메라의 시야 범위(Frustum)를 벗어난 개체들을 식별하여
 * 불필요한 렌더링 연산을 방지합니다.
 */
export default class CullingSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        const camera = this.engine.camera;
        
        if (!camera) return;

        // 🚀 [Optimization] 카메라 이동 감지
        const camMoved = this.lastCamX !== camera.x || this.lastCamY !== camera.y || this.lastZoom !== camera.zoom;
        this.lastCamX = camera.x;
        this.lastCamY = camera.y;
        this.lastZoom = camera.zoom;

        // 1. 카메라 시야 범위 가져오기 (약간의 여유 마진 50px 추가)
        const margin = 50;
        const camX = camera.x - margin;
        const camY = camera.y - margin;
        const camW = (camera.viewportWidth / camera.zoom) + (margin * 2);
        const camH = (camera.viewportHeight / camera.zoom) + (margin * 2);

        // 2. 그려야 할 모든 개체를 순회하며 화면 내 존재 여부 판별
        for (const [id, entity] of em.entities) {
            const visual = entity.components.get('Visual');
            if (!visual) continue;

            const animal = entity.components.get('Animal');
            
            // 🚀 [Optimization] 카메라가 고정된 상태라면 정적 개체(Resource)는 컬링 연산 생략
            // 단, 새로 생성된 개체(isCulled이 undefined인 경우)는 한 번 체크해야 함
            if (!camMoved && !animal && visual.isCulled !== undefined) continue;

            const transform = entity.components.get('Transform');
            if (transform) {
                const ex = transform.x;
                const ey = transform.y;

                // 📏 [Culling Fix] 개체의 높이를 고려하여 상단 마진을 더 넉넉하게 잡음
                const topMargin = 60; 
                const isOutside = (
                    ex < camX || 
                    ex > camX + camW || 
                    ey < camY - topMargin || 
                    ey > camY + camH
                );

                visual.isCulled = isOutside;
            }
        }
    }
}
